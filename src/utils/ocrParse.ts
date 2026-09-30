import type { BonusKey, ItemPath, Rarity } from '../types';

const RARITY_WORDS: Record<string, Rarity> = {
  'ОБЫЧНАЯ': 'common',
  'НЕОБЫЧНАЯ': 'uncommon',
  'РЕДКАЯ': 'rare',
  'ЭПИЧЕСКАЯ': 'epic',
  'ЛЕГЕНДАРНАЯ': 'legendary',
};

// Стем (корень слова в любом падеже) -> ключ бонуса. Порядок не важен — стемы не пересекаются.
const STAT_STEMS: [string, BonusKey][] = [
  ['биоэнерг', 'resource'],
  ['энерг', 'resource'],
  ['дух', 'resource'],
  ['живучест', 'vitality'],
  ['стойкост', 'fortitude'],
  ['ловкост', 'agility'],
  ['сопротивлен', 'resistance'],
  ['пассивн', 'passivePerception'],
  ['восприят', 'perception'],
  ['интеллект', 'intellect'],
  ['сил', 'strength'],
  ['вынослив', 'endurance'],
  ['мудрост', 'wisdom'],
  ['харизм', 'charisma'],
  ['защит', 'defense'],
  ['скорост', 'speed'],
  ['инициатив', 'initiative'],
  ['здоровь', 'hp'],
];

// Длиннее слово — приоритетнее: "НЕОБЫЧНАЯ" содержит "ОБЫЧНАЯ" как подстроку,
// поэтому нельзя просто брать первое совпадение по порядку объекта.
const RARITY_WORDS_BY_LENGTH = Object.keys(RARITY_WORDS).sort((a, b) => b.length - a.length);

function findRarityWord(line: string): string | null {
  const upper = line.toUpperCase();
  return RARITY_WORDS_BY_LENGTH.find((w) => upper.includes(w)) ?? null;
}

function statKeyForWord(word: string): BonusKey | null {
  const lower = word.toLowerCase();
  for (const [stem, key] of STAT_STEMS) {
    if (lower.includes(stem)) return key;
  }
  return null;
}

function detectPath(text: string): ItemPath | null {
  const lower = text.toLowerCase();
  if (/магическ/.test(lower)) return 'magic';
  if (/генетическ/.test(lower)) return 'genetic';
  if (/техническ|технологическ/.test(lower)) return 'tech';
  if (/сыворотка\s*днк|днк\s*мутаци/.test(lower)) return 'genetic';
  if (/книга умения/.test(lower)) return 'magic';
  if (/технолог/.test(lower)) return 'tech';
  return null;
}

export interface ParsedCard {
  name?: string;
  rarity?: Rarity;
  category?: string;
  level?: number;
  path?: ItemPath;
  flavorText?: string;
  statBonuses?: Partial<Record<BonusKey, number>>;
}

/**
 * Лучшее-из-возможного извлечение полей из сырого OCR-текста карточки предмета/умения.
 * Активация/Откат/Каст/Длительность сюда сознательно не входят: на карточках это
 * двухколоночная вёрстка, и Tesseract сливает обе колонки в одну строку почти всегда —
 * извлечь их оттуда надёжно нельзя. Всё остальное (в т.ч. полный текст) остаётся в
 * поле "Эффект" как раньше, так что при необходимости их можно перенести руками.
 */
export function parseCardText(raw: string): ParsedCard {
  const text = raw.replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const result: ParsedCard = {};

  // Строка-плашка: "РЕДКОСТЬ" или "КАТЕГОРИЯ <разделитель> РЕДКОСТЬ" (разделитель — «•», «-», «.», в
  // зависимости от того, как OCR распознал иконку-точку).
  const badgeIndex = lines.findIndex((l) => findRarityWord(l) !== null);
  if (badgeIndex >= 0) {
    const badgeLine = lines[badgeIndex];
    const rarityWord = findRarityWord(badgeLine)!;
    result.rarity = RARITY_WORDS[rarityWord];

    const parts = badgeLine
      .split(/\s+[•·.\-–—]\s+/)
      .map((p) => p.replace(/^[^\wа-яёА-ЯЁ]+/, '').trim())
      .filter(Boolean);
    const categoryPart = parts.find((p) => !RARITY_WORDS_BY_LENGTH.includes(p.toUpperCase()));
    if (categoryPart) result.category = categoryPart;

    // Название — первая содержательная строка после плашки (пропускаем однобуквенный OCR-мусор).
    const nameLine = lines.slice(badgeIndex + 1).find((l) => l.length >= 3);
    if (nameLine) result.name = nameLine;
  } else if (lines[0]?.length >= 3) {
    result.name = lines[0];
  }

  const levelMatch = text.match(/Уровень\s*(\d+)/i);
  if (levelMatch) result.level = Number(levelMatch[1]);

  const path = detectPath(`${result.category ?? ''} ${result.name ?? ''} ${text}`);
  if (path) result.path = path;

  const flavorMatch = text.match(/"([^"]{10,400})"/s);
  if (flavorMatch) result.flavorText = flavorMatch[1].trim().replace(/\s+/g, ' ');

  const bonuses: Partial<Record<BonusKey, number>> = {};
  const bonusPattern = /([+-]\s?\d+)\s*к\s+([А-Яа-яЁё]+)/g;
  let m: RegExpExecArray | null;
  while ((m = bonusPattern.exec(text))) {
    const value = Number(m[1].replace(/\s/g, ''));
    const key = statKeyForWord(m[2]);
    if (key && !Number.isNaN(value)) bonuses[key] = value;
  }
  if (Object.keys(bonuses).length > 0) result.statBonuses = bonuses;

  return result;
}
