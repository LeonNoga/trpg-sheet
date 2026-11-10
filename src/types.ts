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
  | 'boots'
  | 'weapon'
  | 'twohanded'
  | 'shield';

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
  /** Для умений: бонусы (и штрафы), которые действуют только пока активно умение (временный эффект после применения). */
  activeBonuses?: Partial<Record<BonusKey, number>>;
  equipped: boolean;
  /** Запись создана из карточки артефакта: либо сам предмет, либо вложенная в него способность. */
  artifact?: boolean;
  /** Что распознано неуверенно или не найдено — показывается значком «Проверьте», пока игрок не подтвердит. */
  review?: string[];
  image?: string; // base64 data URL
}

/** Временный эффект от умения (или добавленный вручную): бонусы действуют, пока не наступит конец. */
export interface ActiveEffect {
  id: string;
  name: string;
  /** Умение, которое его запустило (повторное применение обновляет эффект, а не складывает). */
  sourceId?: string;
  bonuses: Partial<Record<BonusKey, number>>;
  /** Игровое время (секунды) начала и конца. */
  startedAt: number;
  endsAt?: number;
  /**
   * time — до endsAt; combat — до конца боя; rest — до длительного отдыха; manual — пока не снимут вручную (кончается
   * сбросом таймера и новым днём); permanent — постоянный бонус-напоминание, его не сбрасывает ни таймер, ни отдых.
   */
  until: 'time' | 'combat' | 'rest' | 'manual' | 'permanent';
}

export type Roster = 'personal' | 'gm-player' | 'gm-master';

export type PoolKey = 'hp' | 'staminaPoints' | 'resourcePoints';

export interface TraitList {
  id: string;
  slots: string[];
}

/** Жемчужина развития: накопитель очков развития, из которого их можно «всосать» (и обратно). */
export interface DevelopmentPearl {
  id: string;
  points: number;
}

/** Пыль развития: запас с дробным объёмом. */
export interface DevelopmentDust {
  id: string;
  volume: number;
}

/** Запись журнала изменений карточки (см. data/changeLog.ts): хранится структура, текст собирается при показе. */
export interface ChangeEntry {
  id: string;
  /** Время последней правки (для слитых записей — последней из них). */
  at: number;
  /** Уровень персонажа в этот момент. */
  lv: number;
  kind:
    | 'level'
    | 'experience'
    | 'levelPoints'
    | 'bonusStatPoints'
    | 'stat'
    | 'skill'
    | 'classRarity'
    | 'classLevel'
    | 'itemAdded'
    | 'itemRemoved'
    | 'abilityAdded'
    | 'abilityRemoved'
    | 'equipped'
    | 'slot'
    | 'developmentPoints'
    | 'points'
    | 'pearl'
    | 'pearlAdded'
    | 'pearlRemoved'
    | 'pearlAbsorb'
    | 'pearlFill'
    | 'dust'
    | 'dustAdded'
    | 'dustRemoved'
    | 'effectStart'
    | 'effectEnd'
    | 'note';
  /** Что именно изменено (ключ характеристики, название навыка, id жемчужины…) — по нему сливаются правки и отменяется запись. */
  key?: string;
  label?: string;
  from?: number | string | boolean;
  to?: number | string | boolean;
}

export interface InfectionStatus {
  success: [boolean, boolean, boolean];
  fail: [boolean, boolean, boolean];
}

export interface Character {
  id: string;
  /** Версия схемы данных (см. data/migrations.ts); у карточек, созданных до её введения, отсутствует. */
  schemaVersion?: number;
  roster: Roster;
  playerName: string;
  characterName: string;
  /** Вид / Класс / Модель (зависит от пути); по игровой механике — класс персонажа. */
  species: string;
  /** Редкость класса; пока класс не выбран — undefined. Определяет очки характеристик за новые уровни. */
  classRarity?: Rarity;
  /** Очки за новый уровень для «Уникального» класса — у него ставка не стандартная, её сообщает Мастер. */
  uniqueLevelPoints?: number;
  /** Уровень, на котором получен класс (не меньше 10). Бонус редкости применяется только к уровням выше него. */
  classLevel?: number;
  /** Свободное описание класса (вкладка «Доп. информация»). */
  classDescription?: string;
  /** Портрет персонажа (data URL, уменьшенный) — показывается в списке и на вкладке «Персонаж». */
  portrait?: string;
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
  groupName?: string;
  group: string;
  /** «Очки умений» (вверху вкладки умений); игроки заполняют вручную. */
  points: number;
  developmentPoints: number;
  pearls?: DevelopmentPearl[];
  dust?: DevelopmentDust[];
  /** Журнал изменений карточки (до 300 последних записей); едет вместе с файлом экспорта. */
  changeLog?: ChangeEntry[];
  systemWeapons: TraitList;
  systemGear: TraitList;
  inspirationPoints: boolean[];
  infectionStatus: InfectionStatus;
  notes: string;
  /** Учёт применения способностей: откаты и дневные лимиты (ключ — id записи или «m:стат:порог»). */
  usage?: Record<string, { cooldown?: boolean; daily?: boolean; readyAt?: number; combat?: boolean }>;
  /** Игровое время в секундах: двигается «Тиком боя» (15 с), отдыхами и кнопкой «+ время»; по нему истекают эффекты и откаты. */
  clock?: number;
  /** Действующие временные эффекты. */
  effects?: ActiveEffect[];
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
