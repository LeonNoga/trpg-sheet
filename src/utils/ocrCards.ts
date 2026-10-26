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
  /** Средняя уверенность Tesseract (0–100) по основному проходу. */
  confidence?: number;
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
  // Воркер, ядро и языки берутся с нашего сайта (см. scripts/copy-ocr-assets.mjs): работает без внешнего CDN и офлайн.
  const base = `${import.meta.env.BASE_URL}ocr`;
  const worker = await createWorker('rus+eng', undefined, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
  });

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
      if (!/уровень\s*\d/i.test(text) && !/слот\s*[:：]/i.test(text)) {
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
        confidence: result.data.confidence,
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
  // У артефакта сетка «Активация/Откат/Каст/Длительность» принадлежит вложенной способности.
  const hasGrid = parsed.kind === 'ability' || parsed.kind === 'artifact';
  const grid = hasGrid ? extractAbilityGrid(result.words) : {};
  const slot = parsed.kind === 'ability' ? undefined : (parsed.slot ?? detectSlotType(parsed.name ?? ''));
  return { ...parsed, ...grid, slot };
}

export type CardFields = ReturnType<typeof parseCardFields>;

/** Поля записи конкретного вида; effect задан, только если его надо взять не из сырого текста карточки. */
export interface KindFields {
  name?: string;
  rarity?: CardFields['rarity'];
  path?: CardFields['path'];
  category?: string;
  level?: number;
  slot?: CardFields['slot'];
  flavorText?: string;
  effect?: string;
  activation?: string;
  cooldown?: string;
  cast?: string;
  duration?: string;
  statBonuses?: CardFields['statBonuses'];
  artifact: boolean;
}

/**
 * Артефакт на карточке — это две сущности: сам предмет (слот, свойства) и вложенная способность
 * (название, текст, сетка Активация/Откат). Здесь выбираем поля для нужной из них; обычные карточки отдаются как есть.
 */
export function fieldsForKind(f: CardFields, kind: 'item' | 'ability'): KindFields {
  if (f.kind !== 'artifact') return { ...f, artifact: false };
  const art = f.artifact ?? {};
  if (kind === 'ability') {
    return {
      name: art.abilityName ?? f.name,
      rarity: art.abilityRarity ?? f.rarity,
      path: f.path,
      category: f.name ? `Артефакт: ${f.name}` : 'Артефакт',
      effect: art.abilityEffect,
      activation: f.activation,
      cooldown: f.cooldown,
      cast: f.cast,
      duration: f.duration,
      artifact: true,
    };
  }
  return {
    name: f.name,
    rarity: f.rarity,
    path: f.path,
    slot: f.slot,
    flavorText: f.flavorText,
    effect: art.abilityName ? `Даёт способность «${art.abilityName}».` : undefined,
    statBonuses: f.statBonuses,
    artifact: true,
  };
}

/** Что на карточке не нашлось или распознано неуверенно — это игрок увидит значком «Проверьте». */
function reviewFlags(kind: 'item' | 'ability', f: KindFields, result: OcrResult): string[] {
  if (!result.text) return ['текст не распознан'];
  const flags: string[] = [];
  if (!f.name) flags.push('название');
  if (!f.rarity) flags.push('редкость');
  if (!f.path) flags.push('путь');
  if (!f.artifact && f.level == null) flags.push('уровень');
  if (kind === 'ability') {
    if (!f.activation) flags.push('активация');
    if (!f.cooldown) flags.push('откат');
    if (!f.cast) flags.push('каст');
    if (!f.duration) flags.push('длительность');
  } else if (/д[аa][её]т|свойств|защит[аы]\s*[:：]/i.test(result.text) && Object.keys(f.statBonuses ?? {}).length === 0) {
    flags.push('бонусы');
  }
  if ((result.confidence ?? 100) < 70) flags.push('качество распознавания');
  return flags;
}

function buildItem(
  kind: 'item' | 'ability',
  f: KindFields,
  result: OcrResult,
  image: string,
  fallbackName: string,
): EquipItem {
  const rawText = result.text;
  const flags = reviewFlags(kind, f, result);
  return {
    ...createBlankEquipItem(kind),
    name: f.name || fallbackName,
    path: f.path ?? 'none',
    slot: kind === 'item' ? f.slot : undefined,
    rarity: f.rarity,
    category: kind === 'ability' ? f.category : undefined,
    level: f.level,
    flavorText: f.flavorText,
    effect: f.effect ?? rawText,
    activation: f.activation,
    cooldown: f.cooldown,
    cast: f.cast,
    duration: f.duration,
    statBonuses: f.statBonuses ?? {},
    // Предмет «не надет» по умолчанию; умения всегда активны.
    equipped: kind === 'ability',
    artifact: f.artifact || undefined,
    review: flags.length > 0 ? flags : undefined,
    image,
  };
}

/**
 * Собирает записи из распознанной карточки. Обычная карточка — предмет или умение; артефакт — умение
 * (вложенная способность) и, если он даёт характеристики, ещё и предмет для снаряжения.
 */
export function itemsFromCard(result: OcrResult, image: string, fallbackName: string): EquipItem[] {
  const parsed = parseCardFields(result);
  if (parsed.kind === 'artifact') {
    const ability = buildItem('ability', fieldsForKind(parsed, 'ability'), result, image, fallbackName);
    const hasBonuses = Object.keys(parsed.statBonuses ?? {}).length > 0;
    return hasBonuses
      ? [buildItem('item', fieldsForKind(parsed, 'item'), result, image, fallbackName), ability]
      : [ability];
  }
  const kind = parsed.kind ?? 'item';
  return [buildItem(kind, fieldsForKind(parsed, kind), result, image, fallbackName)];
}

/**
 * Обновляет уже существующую карточку по результату нового распознавания её фото.
 * id, тип (предмет/умение), «надето» и картинка сохраняются; распознаваемые поля и бонусы
 * заменяются свежими, а то, что OCR найти не смогло, остаётся как было. Слот, выбранный руками, не трогаем.
 * Карточка артефакта обновляет ту часть, которой является запись (предмет или вложенная способность).
 */
export function reparsedItem(item: EquipItem, result: OcrResult): EquipItem {
  const f = fieldsForKind(parseCardFields(result), item.kind);
  const isAbility = item.kind === 'ability';
  return {
    ...item,
    name: f.name || item.name,
    path: f.path ?? item.path,
    slot: isAbility ? item.slot : (item.slot ?? f.slot),
    rarity: f.rarity ?? item.rarity,
    category: isAbility ? (f.category ?? item.category) : item.category,
    level: f.level ?? item.level,
    flavorText: f.flavorText ?? item.flavorText,
    effect: f.effect ?? (result.text || item.effect),
    activation: isAbility ? (f.activation ?? item.activation) : item.activation,
    cooldown: isAbility ? (f.cooldown ?? item.cooldown) : item.cooldown,
    cast: isAbility ? (f.cast ?? item.cast) : item.cast,
    duration: isAbility ? (f.duration ?? item.duration) : item.duration,
    statBonuses: f.statBonuses ?? {},
    artifact: f.artifact || item.artifact,
  };
}
