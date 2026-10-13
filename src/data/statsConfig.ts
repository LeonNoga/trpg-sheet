import type { BonusKey, DerivedKey, ItemPath, Path, PoolKey, Rarity, ResistanceSource, SlotType, StatKey } from '../types';

export const STAT_ORDER: StatKey[] = [
  'vitality',
  'fortitude',
  'agility',
  'perception',
  'intellect',
  'strength',
  'endurance',
  'wisdom',
  'charisma',
  'resource',
];

// Пара "характеристика -> показатель" для наглядного построчного отображения
// на карточке (как в бумажном образце: строка со статом и стрелкой к производному).
export const STAT_TO_DERIVED: Partial<Record<StatKey, DerivedKey>> = {
  vitality: 'hp',
  fortitude: 'defense',
  agility: 'speed',
  perception: 'passivePerception',
  intellect: 'initiative',
  strength: 'resistance',
  endurance: 'staminaPoints',
  resource: 'resourcePoints',
};

// Показатели-"пулы": у них помимо расчётного максимума есть текущее
// значение, которое меняется по ходу игры (хиты падают и т.п.).
export const POOL_DERIVED_KEYS: DerivedKey[] = ['hp', 'staminaPoints', 'resourcePoints'];

export function poolKeyFor(key: DerivedKey): PoolKey | null {
  return (POOL_DERIVED_KEYS as string[]).includes(key) ? (key as PoolKey) : null;
}

export const STAT_LABELS: Record<StatKey, string> = {
  vitality: 'Живучесть',
  fortitude: 'Стойкость',
  agility: 'Ловкость',
  perception: 'Восприятие',
  intellect: 'Интеллект',
  strength: 'Сила',
  endurance: 'Выносливость',
  wisdom: 'Мудрость',
  charisma: 'Харизма',
  resource: 'Ресурс',
};

export const DERIVED_LABELS: Record<DerivedKey, string> = {
  hp: 'Пункты здоровья',
  defense: 'Показатель защиты',
  speed: 'Скорость',
  passivePerception: 'Пассивное восприятие',
  initiative: 'Инициатива',
  resistance: 'Сложность сопротивления',
  staminaPoints: 'Пункты выносливости',
  resourcePoints: 'Пункты ресурса',
};

export const PATH_LABELS: Record<Path, string> = {
  genetic: 'Генетический',
  magic: 'Магический',
  tech: 'Технический',
};

export const ITEM_PATH_LABELS: Record<ItemPath, string> = {
  ...PATH_LABELS,
  none: 'Без пути',
};

export const PATH_RESOURCE_LABEL: Record<Path, string> = {
  genetic: 'Биоэнергия',
  magic: 'Дух',
  tech: 'Энергия',
};

export const PATH_RESOURCE_POINTS_LABEL: Record<Path, string> = {
  genetic: 'Пункты биоэнергии',
  magic: 'Пункты духа',
  tech: 'Пункты энергии',
};

// Из каких характеристик выбирается Сложность Сопротивления (кроме 'auto').
export const RESISTANCE_ALLOWED_STATS: Record<Path, Exclude<ResistanceSource, 'auto'>[]> = {
  genetic: ['agility', 'strength'],
  magic: ['intellect'],
  tech: ['intellect'],
};

export const PATH_SPECIES_FIELD_LABEL: Record<Path, string> = {
  genetic: 'Вид',
  magic: 'Класс',
  tech: 'Модель',
};

export const PATH_TRAIT_LABELS: Record<Path, { bonuses: string; dnaA: string; dnaB: string }> = {
  genetic: { bonuses: 'Видовые бонусы', dnaA: 'Видовые ДНК', dnaB: 'ДНК' },
  magic: { bonuses: 'Классовые бонусы', dnaA: 'Классовые умения', dnaB: 'Умения' },
  tech: { bonuses: 'Бонусы Модели', dnaA: 'Технологии Модели', dnaB: 'Технологии' },
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'unique'];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Обычная',
  uncommon: 'Необычная',
  rare: 'Редкая',
  epic: 'Эпическая',
  legendary: 'Легендарная',
  unique: 'Уникальная',
};

// Редкость класса (в мужском роде, как на карточке: «Обычный класс»).
export const CLASS_RARITY_LABELS: Record<Rarity, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
  unique: 'Уникальный',
};

// Сколько очков характеристик даёт каждый НОВЫЙ уровень в зависимости от редкости класса.
export const CLASS_RARITY_LEVEL_POINTS: Record<Rarity, number> = {
  common: 2,
  uncommon: 3,
  rare: 5,
  epic: 10,
  legendary: 15,
  unique: 15,
};

/** До выбора класса (редкость не задана) уровень даёт +2, как у обычного класса. */
export function levelPointsRate(classRarity?: Rarity): number {
  return CLASS_RARITY_LEVEL_POINTS[classRarity ?? 'common'];
}

// Пороги суммарного значения характеристики (база + снаряжение). На 50 открывается именной
// бонус; на 150 — второй уровень подсветки, сами бонусы автор пропишет позже.
export const STAT_MILESTONE_BONUS = 50;
export const STAT_MILESTONE_HIGH = 150;

export function statMilestone(total: number): 50 | 150 | null {
  if (total >= STAT_MILESTONE_HIGH) return 150;
  if (total >= STAT_MILESTONE_BONUS) return 50;
  return null;
}

export interface MilestoneEffect {
  title: string;
  text: string;
}

// Бонусы порога 50. У Мудрости и Харизмы бонуса пока нет — они только подсвечиваются.
const MILESTONE_EFFECTS: Partial<Record<StatKey, MilestoneEffect>> = {
  strength: { title: 'Сокрушительная мощь', text: 'удвоение кубов урона и атаки в ближнем бою' },
  agility: { title: 'Танец клинков', text: 'две атаки за одно действие без штрафа за многократность' },
  endurance: { title: 'Второе дыхание', text: '1/длительный отдых: полное восстановление Выносливости' },
  vitality: { title: 'Отказ умирать', text: '1/длительный отдых: при смерти остаётесь с 1 хитом' },
  fortitude: {
    title: 'Каменная кожа',
    text: 'постоянно: половина физического урона (колющий, рубящий, режущий, дробящий)',
  },
  intellect: { title: 'Когнитивный прорыв', text: '1 раз в час: способность выполняется бесплатно (0 действий)' },
  perception: { title: 'Абсолютный уклонист', text: 'бесплатная контратака при промахе врага' },
  resource: {
    title: 'Энергетический синдикат',
    text: '1/длительный отдых: полное восстановление ресурса и снятие Ментального Истощения',
  },
};

/** Бонус порога 50 для характеристики, если он достигнут (на 150 и выше он продолжает действовать). */
export function milestoneEffect(stat: StatKey, total: number): MilestoneEffect | null {
  return total >= STAT_MILESTONE_BONUS ? (MILESTONE_EFFECTS[stat] ?? null) : null;
}

// Сколько слотов в списке ДНК / Технологии / Умения открыто на данном уровне.
export const ABILITY_SLOT_STEPS: { level: number; slots: number }[] = [
  { level: 1, slots: 3 },
  { level: 25, slots: 4 },
  { level: 50, slots: 5 },
  { level: 100, slots: 6 },
];

export function abilitySlotLimit(level: number): number {
  return ABILITY_SLOT_STEPS.filter((s) => level >= s.level).at(-1)!.slots;
}

/** Ближайший следующий порог расширения лимита (или null на максимуме). */
export function nextAbilitySlotStep(level: number): { level: number; slots: number } | null {
  return ABILITY_SLOT_STEPS.find((s) => s.level > level) ?? null;
}

// Пороги дней успешной тренировки и справочные TN для перехода между степенями владения навыком.
export const SKILL_TRAINING_TIERS: { from: 0 | 5 | 10; to: 5 | 10 | 15; tn: number; days: number }[] = [
  { from: 0, to: 5, tn: 18, days: 10 },
  { from: 5, to: 10, tn: 25, days: 30 },
  { from: 10, to: 15, tn: 30, days: 90 },
];

export function bonusLabel(key: BonusKey, path?: Path): string {
  if (path && key === 'resource') return PATH_RESOURCE_LABEL[path];
  if (path && key === 'resourcePoints') return PATH_RESOURCE_POINTS_LABEL[path];
  if (key in STAT_LABELS) return STAT_LABELS[key as StatKey];
  return DERIVED_LABELS[key as DerivedKey];
}

export const ALL_BONUS_KEYS: BonusKey[] = [
  ...STAT_ORDER,
  'hp',
  'defense',
  'speed',
  'passivePerception',
  'initiative',
  'resistance',
  'staminaPoints',
  'resourcePoints',
];

export const STAT_MIN = 5;
export const STAT_MAX = 20;
export const STARTING_STAT_POINTS = 100;

export const SKILLS: string[] = [
  'Акробатика',
  'Анализ',
  'Атлетика',
  'Борьба',
  'Выживание',
  'Выступление',
  'Дальнобойное оружие',
  'Драка',
  'Запугивание',
  'История',
  'Ловкость рук',
  'Медицина',
  'Механизмы',
  'Наука',
  'Обман',
  'Огнестрельное оружие',
  'Природа',
  'Проницательность',
  'Ремесло',
  'Скрытность',
  'Транспорт',
  'Убеждение',
  'Уход за животными',
  'Холодное оружие',
  'Электроника',
];

export const SKILL_LEVELS: { level: 0 | 5 | 10 | 15; label: string; cost: number }[] = [
  { level: 0, label: 'Не владеет', cost: 0 },
  { level: 5, label: 'Обученный', cost: 1 },
  { level: 10, label: 'Опытный', cost: 3 },
  { level: 15, label: 'Эксперт', cost: 5 },
];

export const SKILL_POINTS_BUDGET = 15;

export const SLOT_TYPES: { key: SlotType; label: string }[] = [
  { key: 'headwear', label: 'Головной убор' },
  { key: 'glasses', label: 'Очки/линзы' },
  { key: 'earrings', label: 'Серьги' },
  { key: 'amulets', label: 'Амулеты' },
  { key: 'cloak', label: 'Плащ' },
  { key: 'shoulders', label: 'Наплечники' },
  { key: 'armor', label: 'Броня' },
  { key: 'elbows', label: 'Налокотники' },
  { key: 'bracers', label: 'Наручи' },
  { key: 'bracelets', label: 'Браслеты' },
  { key: 'gloves', label: 'Перчатки' },
  { key: 'rings', label: 'Кольца' },
  { key: 'belt', label: 'Пояс' },
  { key: 'thigh', label: 'Набедренник' },
  { key: 'knees', label: 'Наколенники' },
  { key: 'shins', label: 'Поножи' },
  { key: 'boots', label: 'Обувь' },
];

export const SLOT_TYPE_LABELS = Object.fromEntries(SLOT_TYPES.map((t) => [t.key, t.label])) as Record<SlotType, string>;

const byRussianName = (a: string, b: string) => a.localeCompare(b, 'ru');

// Категории навыков; внутри категории — по алфавиту. Вместе дают тот же список из 25 навыков, что и SKILLS.
export const SKILL_CATEGORIES: { title: string; skills: string[] }[] = [
  {
    title: 'Боевые',
    skills: [
      'Акробатика',
      'Атлетика',
      'Борьба',
      'Дальнобойное оружие',
      'Драка',
      'Огнестрельное оружие',
      'Холодное оружие',
    ].sort(byRussianName),
  },
  {
    title: 'Социальные',
    skills: ['Выступление', 'Запугивание', 'История', 'Обман', 'Проницательность', 'Убеждение'].sort(byRussianName),
  },
  {
    title: 'Общие',
    skills: [
      'Анализ',
      'Выживание',
      'Ловкость рук',
      'Медицина',
      'Механизмы',
      'Наука',
      'Природа',
      'Ремесло',
      'Скрытность',
      'Транспорт',
      'Уход за животными',
      'Электроника',
    ].sort(byRussianName),
  },
];

// Как называется «умения» у каждого пути: Умения (магия), ДНК (генетика), Технологии (техника).
export const PATH_ABILITY_LABELS: Record<Path, { tab: string; add: string; empty: string }> = {
  magic: { tab: 'Умения', add: '+ Добавить умение', empty: 'Умений пока нет.' },
  genetic: { tab: 'ДНК', add: '+ Добавить ДНК', empty: 'ДНК пока нет.' },
  tech: { tab: 'Технологии', add: '+ Добавить технологию', empty: 'Технологий пока нет.' },
};
