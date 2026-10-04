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

function statKeyForPhrase(phrase: string): BonusKey | null {
  const lower = phrase.toLowerCase();
  // "Пассивная защита" и "Пассивное восприятие" начинаются одинаково — различаем по второму слову.
  if (/пассивн/.test(lower)) {
    if (/восприят/.test(lower)) return 'passivePerception';
    if (/защит/.test(lower)) return 'defense';
    return null;
  }
  if (/(^|\s)пз(\s|$)/.test(lower)) return 'defense';
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
  kind?: 'item' | 'ability';
  name?: string;
  rarity?: Rarity;
  category?: string;
  level?: number;
  path?: ItemPath;
  flavorText?: string;
  statBonuses?: Partial<Record<BonusKey, number>>;
}

// Умения опознаём по сетке "Активация/Откат", подписи "Эффект умения/мутации/технологии"
// или по типу в плашке/названии (Сыворотка ДНК, ДНК Мутация, Книга умения, Технология, Шар технологий).
function detectKind(text: string, category: string | undefined, name: string | undefined): 'item' | 'ability' {
  const lower = text.toLowerCase();
  if (/активаци/.test(lower) && /откат/.test(lower)) return 'ability';
  if (/эффект\s+(умения|мутации|технологии)/.test(lower)) return 'ability';
  const header = `${category ?? ''} ${name ?? ''}`.toLowerCase();
  if (/сыворотка\s*днк|днк[\s-]*мутаци|книга умения|шар технологий/.test(header)) return 'ability';
  if (/^технологи[яи]$/.test((category ?? '').trim().toLowerCase())) return 'ability';
  return 'item';
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
    const nameIndex = lines.findIndex((l, i) => i > badgeIndex && l.length >= 3);
    if (nameIndex >= 0) {
      let name = lines[nameIndex];
      // Длинное название в «ёлочках» переносится на вторую строку — дособираем до закрывающей »,
      // пропуская строки OCR-мусора без слов. Если » не нашлась — оставляем первую строку.
      if (name.includes('«') && !name.includes('»')) {
        let joined = name;
        for (let j = nameIndex + 1; j < Math.min(nameIndex + 4, lines.length); j++) {
          if (!/[А-Яа-яA-Za-z]{3,}/.test(lines[j])) continue;
          joined += ` ${lines[j]}`;
          if (lines[j].includes('»')) {
            name = joined;
            break;
          }
        }
      }
      result.name = name;
    }
  } else if (lines[0]?.length >= 3) {
    result.name = lines[0];
  }

  result.kind = detectKind(text, result.category, result.name);

  const levelMatch = text.match(/Уровень\s*(\d+)/i);
  if (levelMatch) result.level = Number(levelMatch[1]);

  const path = detectPath(`${result.category ?? ''} ${result.name ?? ''} ${text}`);
  if (path) result.path = path;

  const flavorMatch = text.match(/"([^"]{10,400})"/s);
  if (flavorMatch) {
    // Открывающая кавычка описания может потеряться при OCR, и тогда совпадение цепляет хвост названия («"Шмель"»).
    const flavor = flavorMatch[1].replace(/\s+/g, ' ').replace(/^[^А-Яа-яA-Za-z0-9]+/, '').trim();
    if (flavor) result.flavorText = flavor;
  }

  // Бонусы берём только из фразы "Даёт +N к X, +M к Y": в прозе эффекта умений тоже бывают
  // "+N к ...", но они условные (в определённом состоянии) и не должны становиться постоянными.
  const bonuses: Partial<Record<BonusKey, number>> = {};
  const giveIndex = text.search(/Д[аa][её]т/i);
  if (giveIndex >= 0) {
    const bonusText = text.slice(giveIndex);
    const bonusPattern = /([+-]\s?\d+)\s*к\s+([А-Яа-яЁё]+(?:\s+[А-Яа-яЁё]+)?)/g;
    let m: RegExpExecArray | null;
    while ((m = bonusPattern.exec(bonusText))) {
      const value = Number(m[1].replace(/\s/g, ''));
      const key = statKeyForPhrase(m[2]);
      if (key && !Number.isNaN(value)) bonuses[key] = value;
    }
  }
  if (Object.keys(bonuses).length > 0) result.statBonuses = bonuses;

  return result;
}
