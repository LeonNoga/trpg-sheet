import { createBlankEquipItem } from '../data/defaults';
import { parseCardText } from './ocrParse';
import { extractAbilityGrid, wordsFromTsv } from './ocrLayout';
import type { OcrWord } from './ocrLayout';
import { detectSlotType } from './slotDetect';
import type { EquipItem } from '../types';

export interface OcrResult {
  text: string;
  words: OcrWord[];
}

export interface OcrSession {
  recognize(image: string): Promise<OcrResult>;
  terminate(): Promise<void>;
}

/** Один воркер Tesseract на всю пачку карточек: язык грузится один раз, а не на каждый файл. */
export async function createOcrSession(): Promise<OcrSession> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('rus+eng');
  return {
    async recognize(image) {
      // tsv даёт координаты слов — по ним разбирается сетка «Активация/Откат/Каст/Длительность».
      const result = await worker.recognize(image, {}, { text: true, tsv: true });
      return { text: result.data.text.trim(), words: result.data.tsv ? wordsFromTsv(result.data.tsv) : [] };
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

/** Поля, которые удалось извлечь из карточки (без id и без самого изображения). */
export function parseCardFields(result: OcrResult) {
  const parsed = parseCardText(result.text);
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
