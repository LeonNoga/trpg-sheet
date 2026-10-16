export type Path = 'genetic' | 'magic' | 'tech';

export type StatKey =
  | 'vitality'
  | 'fortitude'
  | 'agility'
  | 'perception'
  | 'intellect'
  | 'strength'
  | 'endurance'
  | 'wisdom'
  | 'charisma'
  | 'resource';

export type DerivedKey =
  | 'hp'
  | 'defense'
  | 'speed'
  | 'passivePerception'
  | 'initiative'
  | 'resistance'
  | 'staminaPoints'
  | 'resourcePoints';

export type BonusKey = StatKey | DerivedKey;

export type InitiativeSource = 'auto' | 'agility' | 'intellect' | 'perception';
export type ResistanceSource = 'auto' | 'agility' | 'strength' | 'intellect';

export type SkillLevel = 0 | 5 | 10 | 15;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'unique';

/** Тип снаряжения по слоту, в который оно надевается (не размещает предмет, а лишь описывает его). */
export type SlotType =
  | 'glasses'
  | 'headwear'
  | 'earrings'
  | 'cloak'
  | 'amulets'
  | 'shoulders'
  | 'armor'
  | 'elbows'
  | 'belt'
  | 'bracers'
  | 'gloves'
  | 'bracelets'
  | 'rings'
  | 'thigh'
  | 'knees'
  | 'shins'
  | 'boots';

/** Путь, к которому привязан предмет/умение — 'none' = общий, без привязки. */
export type ItemPath = Path | 'none';

export interface EquipItem {
  id: string;
  kind: 'item' | 'ability';
  name: string;
  path?: ItemPath;
  /** Для снаряжения: к какому слоту относится (головной убор, серьги…). */
  slot?: SlotType;
  rarity?: Rarity;
  category?: string;
  level?: number;
  flavorText?: string;
  effect?: string;
  activation?: string;
  cooldown?: string;
  cast?: string;
  duration?: string;
  statBonuses: Partial<Record<BonusKey, number>>;
  equipped: boolean;
  image?: string; // base64 data URL
}

export type Roster = 'personal' | 'gm-player' | 'gm-master';

export type PoolKey = 'hp' | 'staminaPoints' | 'resourcePoints';

export interface TraitList {
  id: string;
  slots: string[];
}

export interface InfectionStatus {
  success: [boolean, boolean, boolean];
  fail: [boolean, boolean, boolean];
}

export interface Character {
  id: string;
  roster: Roster;
  playerName: string;
  characterName: string;
  /** Вид / Класс / Модель (зависит от пути); по игровой механике — класс персонажа. */
  species: string;
  /** Редкость класса; пока класс не выбран — undefined. Определяет очки характеристик за новые уровни. */
  classRarity?: Rarity;
  /** Очки за новый уровень для «Уникального» класса — у него ставка не стандартная, её сообщает Мастер. */
  uniqueLevelPoints?: number;
  path: Path;
  resistanceSource: ResistanceSource;
  initiativeSource: InitiativeSource;
  level: number;
  experience: number;
  /** Очки характеристик, накопленные за уровни (начисляются по редкости класса на момент получения уровня). */
  levelPoints: number;
  /** Дополнительные очки сверх уровневых (награда мастера); может быть отрицательным. */
  bonusStatPoints: number;
  baseStats: Record<StatKey, number>;
  /** Текущие (изменяемые в игре) значения пулов — отдельно от расчётного максимума. */
  pools: Record<PoolKey, number>;
  skills: Record<string, SkillLevel>;
  /** Дни тренировки, накопленные к следующей степени владения навыком. */
  skillTrainingDays: Record<string, number>;
  items: EquipItem[];
  abilities: EquipItem[];
  equippedSlots: Record<string, string[]>; // slotKey -> equipItem id[], только для силуэта экипировки
  speciesBonuses: TraitList; // свободный список строк, для генетического — "Видовые бонусы"
  dnaLists: TraitList[]; // фиксированные списки по 5 слотов, для генетического — "Видовые ДНК" и "ДНК"
  group: string;
  points: number;
  developmentPoints: number;
  systemWeapons: TraitList;
  systemGear: TraitList;
  inspirationPoints: boolean[];
  infectionStatus: InfectionStatus;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface BackupFile {
  fileType: 'trpg-sheet-backup';
  version: 1;
  exportedAt: string;
  characters: Character[];
  lootTray: EquipItem[];
}

export interface TrayFile {
  fileType: 'trpg-sheet-tray';
  version: 1;
  exportedAt: string;
  items: EquipItem[];
}

export interface CharacterExportFile {
  fileType: 'trpg-sheet-character';
  version: 1;
  character: Character;
}
