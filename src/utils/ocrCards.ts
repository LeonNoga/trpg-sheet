import { createBlankEquipItem } from '../data/defaults';
import { parseCardText } from './ocrParse';
import type { ParsedCard } from './ocrParse';
import { extractAbilityGrid, wordsFromTsv } from './ocrLayout';
import type { OcrWord } from './ocrLayout';
import { detectSlotType } from './slotDetect';
import { adaptiveBinarize, canvasToJpeg, cropToSheet, enhanceContrast, loadCanvas, rotateCanvas, scaleToLongSide } from './ocrPrepare';
import type { EquipItem } from '../types';

export interface OcrResult {
  text: string;
  words: OcrWord[];
  /** Текст второго прохода с локальной бинаризацией — читает бледные строки (путь, уровень, описание), которые теряются в первом. */
  altText?: string;
  /** Фото после обрезки по листу и поворота (если они понадобились) — его и стоит хранить в карточке. */
  image?: string;
}

// Слова, по которым понимаем, что карточка повёрнута правильно и распознаётся осмысленно.
const CARD_KEYWORDS = /уровень|путь|даёт|дает|защит|активаци|откат|длительност|каст|эффект|необычная|обычная|редкая|эпическая|легендарная|уникальная/gi;

export interface OcrSession {
  recognize(image: string): Promise<OcrResult>;
  terminate(): Promise<void>;
}

/** Один воркер Tesseract на всю пачку карточек: язык грузится один раз, а не на каждый файл. */
export async function createOcrSession(): Promise<OcrSession> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('rus+eng');

  /** Быстрый прогон уменьшенной копии: сколько «карточных» слов нашлось и насколько уверенно. */
  async function probe(canvas: HTMLCanvasElement) {
    const r = await worker.recognize(enhanceContrast(scaleToLongSide(canvas, 1000)));
    return { hits: (r.data.text.match(CARD_KEYWORDS) ?? []).length, conf: r.data.confidence };
  }

  return {
    async recognize(image) {
      // 1. Фото со стола → только сам лист; скриншот карточки остаётся как есть.
      const source = await loadCanvas(image);
      const { canvas: cropped, cropped: wasCropped } = cropToSheet(source);

      // 2. Ориентация: карточки альбомные, так что у «стоячего» кадра пробуем повороты на 90°/270° первыми.
      const landscape = cropped.width >= cropped.height;
      const order = landscape ? [0, 2, 1, 3] : [1, 3, 0, 2];
      let turns = order[0];
      let best = { hits: -1, conf: -1 };
      for (const t of order) {
        const score = await probe(rotateCanvas(cropped, t));
        if (score.hits > best.hits || (score.hits === best.hits && score.conf > best.conf)) {
          best = score;
          turns = t;
        }
        if (score.hits >= 2) break;
      }
      const upright = rotateCanvas(cropped, turns);

      // 3. Основной проход: достаточный размер текста + выровненный контраст.
      const longSide = Math.max(upright.width, upright.height);
      const sized = longSide < 1800 || longSide > 2400 ? scaleToLongSide(upright, 2000) : upright;
      // tsv даёт координаты слов — по ним разбирается сетка «Активация/Откат/Каст/Длительность».
      const result = await worker.recognize(enhanceContrast(sized), {}, { text: true, tsv: true });
      const text = result.data.text.trim();

      // Бледные серые строки (путь, уровень, описание) после общего контраста бывают потеряны:
      // тогда читаем ещё раз с локальной бинаризацией и берём из неё недостающее.
      let altText: string | undefined;
      if (!/уровень\s*\d/i.test(text)) {
        const alt = await worker.recognize(adaptiveBinarize(sized, 1 / 12, 0.92));
        altText = alt.data.text.trim();
      }

      const display =
        wasCropped || turns !== 0
          ? canvasToJpeg(upright)
          : Math.max(source.width, source.height) > 1600
            ? canvasToJpeg(source, 1600)
            : image;
      return {
        text,
        altText,
        words: result.data.tsv ? wordsFromTsv(result.data.tsv) : [],
        image: display,
      };
    },
    async terminate() {
      await worker.terminate();
    },
  };
}

/** Распознаёт одну картинку и сразу закрывает воркер (для одиночной загрузки в редакторе). */
export async function recognizeOnce(image: string): Promise<OcrResult> {
  const session = await createOcrSession();
  try {
    return await session.recognize(image);
  } finally {
    await session.terminate();
  }
}

/** Основной разбор + недостающие поля из второго прохода (основной всегда в приоритете). */
function mergeParsed(main: ParsedCard, alt?: ParsedCard): ParsedCard {
  if (!alt) return main;
  return {
    ...main,
    category: main.category ?? alt.category,
    level: main.level ?? alt.level,
    path: main.path ?? alt.path,
    flavorText: main.flavorText ?? alt.flavorText,
    rarity: main.rarity ?? alt.rarity,
    statBonuses: main.statBonuses ?? alt.statBonuses,
  };
}

/** Поля, которые удалось извлечь из карточки (без id и без самого изображения). */
export function parseCardFields(result: OcrResult) {
  const parsed = mergeParsed(parseCardText(result.text), result.altText ? parseCardText(result.altText) : undefined);
  const grid = parsed.kind === 'ability' ? extractAbilityGrid(result.words) : {};
  const slot = parsed.kind === 'ability' ? undefined : detectSlotType(parsed.name ?? '');
  return { ...parsed, ...grid, slot };
}

/** Собирает предмет или умение из распознанной карточки; полный текст остаётся в «Эффекте». */
export function itemFromCard(result: OcrResult, image: string, fallbackName: string): EquipItem {
  const parsed = parseCardFields(result);
  const kind = parsed.kind ?? 'item';
  const base = createBlankEquipItem(kind);
  return {
    ...base,
    name: parsed.name || fallbackName,
    path: parsed.path ?? 'none',
    slot: parsed.slot,
    rarity: parsed.rarity,
    category: kind === 'ability' ? parsed.category : undefined,
    level: parsed.level,
    flavorText: parsed.flavorText,
    effect: result.text,
    activation: parsed.activation,
    cooldown: parsed.cooldown,
    cast: parsed.cast,
    duration: parsed.duration,
    statBonuses: parsed.statBonuses ?? {},
    // Предмет «не надет» по умолчанию; умения всегда активны.
    equipped: kind === 'ability',
    image,
  };
}

/**
 * Обновляет уже существующую карточку по результату нового распознавания её фото.
 * id, тип (предмет/умение), «надето» и картинка сохраняются; распознаваемые поля и бонусы
 * заменяются свежими, а то, что OCR найти не смог, остаётся как было. Слот, выбранный руками, не трогаем.
 */
export function reparsedItem(item: EquipItem, result: OcrResult): EquipItem {
  const parsed = parseCardFields(result);
  const isAbility = item.kind === 'ability';
  return {
    ...item,
    name: parsed.name || item.name,
    path: parsed.path ?? item.path,
    slot: isAbility ? item.slot : (item.slot ?? parsed.slot),
    rarity: parsed.rarity ?? item.rarity,
    category: isAbility ? (parsed.category ?? item.category) : item.category,
    level: parsed.level ?? item.level,
    flavorText: parsed.flavorText ?? item.flavorText,
    effect: result.text || item.effect,
    activation: isAbility ? (parsed.activation ?? item.activation) : item.activation,
    cooldown: isAbility ? (parsed.cooldown ?? item.cooldown) : item.cooldown,
    cast: isAbility ? (parsed.cast ?? item.cast) : item.cast,
    duration: isAbility ? (parsed.duration ?? item.duration) : item.duration,
    statBonuses: parsed.statBonuses ?? {},
  };
}
