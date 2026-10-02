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

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Путь, к которому привязан предмет/умение — 'none' = общий, без привязки. */
export type ItemPath = Path | 'none';

export interface EquipItem {
  id: string;
  kind: 'item' | 'ability';
  name: string;
  path?: ItemPath;
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
  species: string;
  path: Path;
  resistanceSource: ResistanceSource;
  initiativeSource: InitiativeSource;
  level: number;
  experience: number;
  /** Дополнительные очки характеристик сверх 100 + 2 за уровень (поощрение от мастера); может быть отрицательным. */
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

export interface CharacterExportFile {
  fileType: 'trpg-sheet-character';
  version: 1;
  character: Character;
}
