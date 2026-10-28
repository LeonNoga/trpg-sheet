import type { BonusKey, DerivedKey, ItemPath, Path, PoolKey, Rarity, ResistanceSource, StatKey } from '../types';

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

export const PATH_TRAIT_LABELS: Record<Path, { bonuses: string; dnaA: string; dnaB: string; artifact: string }> = {
  genetic: { bonuses: 'Видовые бонусы', dnaA: 'Видовые ДНК', dnaB: 'ДНК', artifact: 'Артефактные ДНК' },
  magic: { bonuses: 'Классовые бонусы', dnaA: 'Классовые умения', dnaB: 'Умения', artifact: 'Артефактные умения' },
  tech: { bonuses: 'Бонусы Модели', dnaA: 'Технологии Модели', dnaB: 'Технологии', artifact: 'Артефактные технологии' },
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
export function levelPointsRate(classRarity?: Rarity, uniqueRate?: number): number {
  if (classRarity === 'unique' && uniqueRate != null) return uniqueRate;
  return CLASS_RARITY_LEVEL_POINTS[classRarity ?? 'common'];
}

/** Неизменяемые бонусы блока «Видовые/Классовые бонусы»: первая строка зависит от редкости класса. */
export function classBonusLines(classRarity?: Rarity, uniqueRate?: number, classLevel?: number): string[] {
  const rarity = classRarity ? ` (${CLASS_RARITY_LABELS[classRarity]})` : '';
  const from = Math.max(10, classLevel ?? 10);
  const points = classRarity
    ? `Очки характеристик: +2 за уровень до ${from}-го, дальше +${levelPointsRate(classRarity, uniqueRate)} за уровень${rarity}`
    : 'Очки характеристик: +2 за уровень. Класс выбирается на 10 уровне — с 11-го появляется бонус редкости';
  return [points, 'Откат классовых способностей уменьшается', 'Стоимость классовых умений уменьшается на 50%'];
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

const byRussianName = (a: string, b: string) => a.localeCompare(b, 'ru');

// Категории навыков; внутри категории — по алфавиту. Вместе дают тот же список из 25 навыков, что и SKILLS.
export const SKILL_CATEGORIES: { title: string; skills: string[] }[] = [
  {
    title: 'Боевые',
    skills: ['Борьба', 'Дальнобойное оружие', 'Драка', 'Огнестрельное оружие', 'Холодное оружие'].sort(byRussianName),
  },
  {
    title: 'Физические',
    skills: ['Акробатика', 'Атлетика', 'Ловкость рук', 'Скрытность'].sort(byRussianName),
  },
  {
    title: 'Социальные',
    skills: ['Выступление', 'Запугивание', 'Обман', 'Проницательность', 'Убеждение'].sort(byRussianName),
  },
  {
    title: 'Знания',
    skills: ['Анализ', 'История', 'Медицина', 'Наука', 'Природа'].sort(byRussianName),
  },
  {
    title: 'Практические',
    skills: ['Выживание', 'Механизмы', 'Ремесло', 'Транспорт', 'Уход за животными', 'Электроника'].sort(byRussianName),
  },
];

// Как называется «умения» у каждого пути: Умения (магия), ДНК (генетика), Технологии (техника).
export const PATH_ABILITY_LABELS: Record<Path, { tab: string; add: string; empty: string }> = {
  magic: { tab: 'Умения', add: '+ Добавить умение', empty: 'Умений пока нет.' },
  genetic: { tab: 'ДНК', add: '+ Добавить ДНК', empty: 'ДНК пока нет.' },
  tech: { tab: 'Технологии', add: '+ Добавить технологию', empty: 'Технологий пока нет.' },
};

// Правила, вынесенные в отдельные файлы, остаются доступны из этого модуля.
export * from './milestones';
export * from './slots';
