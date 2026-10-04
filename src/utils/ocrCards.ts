import { createBlankEquipItem } from '../data/defaults';
import { parseCardText } from './ocrParse';
import type { EquipItem } from '../types';

export interface OcrSession {
  recognize(image: string): Promise<string>;
  terminate(): Promise<void>;
}

/** Один воркер Tesseract на всю пачку карточек: язык грузится один раз, а не на каждый файл. */
export async function createOcrSession(): Promise<OcrSession> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('rus+eng');
  return {
    async recognize(image) {
      const result = await worker.recognize(image);
      return result.data.text.trim();
    },
    async terminate() {
      await worker.terminate();
    },
  };
}

/** Собирает предмет или умение из распознанного текста карточки; полный текст остаётся в «Эффекте». */
export function itemFromCardText(text: string, image: string, fallbackName: string): EquipItem {
  const parsed = parseCardText(text);
  const kind = parsed.kind ?? 'item';
  const base = createBlankEquipItem(kind);
  return {
    ...base,
    name: parsed.name || fallbackName,
    path: parsed.path ?? 'none',
    rarity: parsed.rarity,
    category: kind === 'ability' ? parsed.category : undefined,
    level: parsed.level,
    flavorText: parsed.flavorText,
    effect: text,
    statBonuses: parsed.statBonuses ?? {},
    // Предмет в трее не «надет»; умения всегда активны.
    equipped: kind === 'ability',
    image,
  };
}
