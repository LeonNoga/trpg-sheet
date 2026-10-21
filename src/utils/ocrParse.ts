import type { BonusKey, ItemPath, Rarity, SlotType } from '../types';

const RARITY_WORDS: Record<string, Rarity> = {
  'ОБЫЧНАЯ': 'common',
  'НЕОБЫЧНАЯ': 'uncommon',
  'РЕДКАЯ': 'rare',
  'ЭПИЧЕСКАЯ': 'epic',
  'ЛЕГЕНДАРНАЯ': 'legendary',
  'УНИКАЛЬНАЯ': 'unique',
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

/** Убирает OCR-мусор перед названием: «а | Шкура», «| Название», одиночные символы и разделители. */
function cleanName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/^([A-Za-zА-Яа-я0-9]{1,2}\s*[|¦!]\s*)+/, '');
  name = name.replace(/^[^A-Za-zА-Яа-яЁё«"]+/, '');
  return name.trim() || raw.trim();
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

/** Данные карточки артефакта: сам артефакт — предмет, а «Вложенная способность» — отдельное умение. */
export interface ParsedArtifact {
  abilityName?: string;
  /** «ДНК-способность», «умение», «технология» — как написано на карточке. */
  abilityKindWord?: string;
  abilityRarity?: Rarity;
  abilityEffect?: string;
}

export interface ParsedCard {
  kind?: 'item' | 'ability' | 'artifact';
  /** Название слота с карточки артефакта («Руки», «Шея», «Щит»). */
  slotLabel?: string;
  slot?: SlotType;
  artifact?: ParsedArtifact;
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
function detectKind(text: string, category: string | undefined, name: string | undefined): 'item' | 'ability' | 'artifact' {
  const lower = text.toLowerCase();
  // Артефакт: плашка «АРТЕФАКТ • …» или блок «Вложенная …-способность «…»» (у него тоже есть сетка Активация/Откат).
  if (/артефакт/.test((category ?? '').toLowerCase()) || /вложенн[а-яё]*\s+[^«\n]{0,40}«/.test(lower)) return 'artifact';
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
      .split(/\s+[•·.\-–—+*»|]\s+/)
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
      result.name = cleanName(name);
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
  if (!result.flavorText) {
    // На фото кавычки описания часто теряются: берём строки между «Уровень N» и блоком «Защита/Даёт/…».
    const levelLine = lines.findIndex((l) => /Уровень\s*\d/i.test(l));
    if (levelLine >= 0) {
      const body: string[] = [];
      for (const line of lines.slice(levelLine + 1)) {
        if (/^\W{0,3}(защит|д[аa][её]т|активаци|эффект|откат)/i.test(line)) break;
        body.push(line);
      }
      const flavor = body
        .join(' ')
        .replace(/["«»]/g, '')
        .replace(/(^|\s)[^\wА-Яа-яЁё]+(?=\s|$)/g, ' ') // одиночные символы-мусор между словами
        .replace(/\s+/g, ' ')
        .trim();
      if (flavor.length >= 10) result.flavorText = flavor;
    }
  }

  // Бонусы берём только из строки-итога: у предметов это «Даёт +N к X», у артефактов — «Свойства: …».
  // В прозе эффекта тоже бывают "+N к ..." (условные, в определённом состоянии) — они не должны становиться постоянными.
  const bonuses: Partial<Record<BonusKey, number>> = {};
  // «Защита: 12 ПЗ» — пункты защиты самого предмета; «ПЗ» OCR нередко читает как «П3»/«ПЗ.».
  // Если «ПЗ» распознано криво, достаточно «Защита: N» с двоеточием (в прозе умений двоеточия там нет).
  const defenseMatch =
    text.match(/Защит[аы]\s*[:：]?\s*([+-]?\d+)\s*(?:П\s?[З3Ззз3]|пз)/i) ?? text.match(/Защит[аы]\s*[:：]\s*([+-]?\d+)/i);
  if (defenseMatch) bonuses.defense = Number(defenseMatch[1]);
  const propsIndex = result.kind === 'artifact' ? text.search(/Свойств[аы]/i) : -1;
  const giveIndex = propsIndex >= 0 ? propsIndex : text.search(/Д[аa][её]т/i);
  if (giveIndex >= 0) {
    const bonusText = text.slice(giveIndex);
    // У артефактов защита пишется в той же строке: «Свойства: + 2 ПЗ: +9 к Стойкости, …».
    const propsDefense = propsIndex >= 0 ? bonusText.match(/([+-]\s?\d+)\s*П\s?[З3Ззз3]/i) : null;
    if (propsDefense) bonuses.defense = Number(propsDefense[1].replace(/\s/g, ''));
    const bonusPattern = /([+-]\s?\d+)\s*к\s+([А-Яа-яЁё]+(?:\s+[А-Яа-яЁё]+)?)/g;
    let m: RegExpExecArray | null;
    while ((m = bonusPattern.exec(bonusText))) {
      const value = Number(m[1].replace(/\s/g, ''));
      const key = statKeyForPhrase(m[2]);
      if (key && !Number.isNaN(value)) bonuses[key] = value;
    }
  }
  if (Object.keys(bonuses).length > 0) result.statBonuses = bonuses;

  if (result.kind === 'artifact') parseArtifactExtras(text, lines, result);

  return result;
}

/** Слот артефакта по подписи «Слот: Руки» → тип слота схемы экипировки (если он там есть). */
const SLOT_LABEL_WORDS: [RegExp, SlotType][] = [
  [/^щит/, 'shield'],
  [/^двуруч/, 'twohanded'],
  [/^(оруж|меч)/, 'weapon'],
  [/^(рук|кист|ладон)/, 'gloves'],
  [/^(шея|ше[июе]|груд)/, 'amulets'],
  [/^(голов|шлем)/, 'headwear'],
  [/^(глаз|лиц|очки)/, 'glasses'],
  [/^(уш|серьг)/, 'earrings'],
  [/^плеч/, 'shoulders'],
  [/^(тел|торс|корпус|брон)/, 'armor'],
  [/^(пояс|талия)/, 'belt'],
  [/^(спин|плащ)/, 'cloak'],
  [/^(запяст|браслет)/, 'bracelets'],
  [/^(предплеч|наруч)/, 'bracers'],
  [/^локт/, 'elbows'],
  [/^бедр/, 'thigh'],
  [/^колен/, 'knees'],
  [/^голен/, 'shins'],
  [/^(ног|ступн|обув)/, 'boots'],
  [/^(палец|пальц|кольц)/, 'rings'],
];

export function slotFromLabel(label: string): SlotType | undefined {
  const lower = label.trim().toLowerCase();
  return SLOT_LABEL_WORDS.find(([pattern]) => pattern.test(lower))?.[1];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Слот, флейвор в «ёлочках» и вложенная способность артефакта. */
function parseArtifactExtras(text: string, lines: string[], result: ParsedCard): void {
  const slotMatch = text.match(/Слот\s*[:：]\s*([А-Яа-яЁё]+)/i);
  if (slotMatch) {
    result.slotLabel = slotMatch[1];
    result.slot = slotFromLabel(slotMatch[1]);
  }

  // Флейвор артефакта: строки между «… Слот: X» и блоком «Вложенная …».
  const slotLine = lines.findIndex((l) => /Слот\s*[:：]/i.test(l));
  const embeddedLine = lines.findIndex((l) => /вложенн/i.test(l));
  if (slotLine >= 0) {
    const body = lines.slice(slotLine + 1, embeddedLine > slotLine ? embeddedLine : undefined);
    const flavor = clean(body.join(' ')).replace(/^[«"]\s*/, '').replace(/[»"]\.?$/, '').trim();
    if (flavor.length >= 10) result.flavorText = flavor;
  }

  // «Вложенная ДНК-способность «Название» (Редкость)» + текст способности до сетки «Активация/Откат».
  const embedded = text.match(/Вложенн[а-яё]*\s+([^«\n]{0,40}?)«([\s\S]{2,90}?)»\s*\(([А-Яа-яЁё]+)\)/i);
  const artifact: ParsedArtifact = {};
  if (embedded) {
    artifact.abilityKindWord = clean(embedded[1]) || undefined;
    artifact.abilityName = clean(embedded[2]);
    const rarityWord = findRarityWord(embedded[3]);
    if (rarityWord) artifact.abilityRarity = RARITY_WORDS[rarityWord];
    const rest = text.slice((embedded.index ?? 0) + embedded[0].length);
    const gridIndex = rest.search(/АКТИВАЦ/i);
    const effect = clean(gridIndex >= 0 ? rest.slice(0, gridIndex) : rest)
      .replace(/(\s[^А-Яа-яЁёA-Za-z0-9]{1,2})+$/, '') // обрывок иконки перед подписью «Активация»
      .trim();
    if (effect) artifact.abilityEffect = effect;
  }
  result.artifact = artifact;
}
