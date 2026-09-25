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

export type KeyStat = 'agility' | 'strength' | 'intellect';

export type SkillLevel = 0 | 5 | 10 | 15;

export interface EquipItem {
  id: string;
  kind: 'item' | 'ability';
  name: string;
  rarity?: string;
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

export interface Character {
  id: string;
  roster: Roster;
  playerName: string;
  characterName: string;
  species: string;
  path: Path;
  keyStat: KeyStat;
  level: number;
  experience: number;
  statPointsBudget: number;
  baseStats: Record<StatKey, number>;
  skills: Record<string, SkillLevel>;
  items: EquipItem[];
  abilities: EquipItem[];
  createdAt: number;
  updatedAt: number;
}

export interface ProgressionConfig {
  xpToNextLevel: number[]; // length 99: index i -> xp needed to go from level i+1 to i+2
  pointsPerLevel: number;
}

export interface ReferenceRow {
  id: string;
  action: string;
  cost: string;
  effect: string;
}

export interface ReferenceSection {
  id: string;
  title: string;
  rows: ReferenceRow[];
}

export interface ReferenceSheetData {
  mode: 'structured' | 'image';
  sections: ReferenceSection[];
  image?: string; // base64 data URL
  updatedAt: number;
}

export interface CharacterExportFile {
  fileType: 'trpg-sheet-character';
  version: 1;
  character: Character;
}
