import { normalizeCharacter } from '../data/defaults';
import { v4 as uuid } from 'uuid';
import { saveJsonFile } from './saveFile';
import { CURRENT_SCHEMA_VERSION, isFromNewerSchema } from '../data/migrations';
import { migrationNotes } from '../data/importCheck';
import type { ImportPreview } from '../data/importCheck';
import type { BackupFile, Character, CharacterExportFile, Encounter, Enemy, EnemyGroup, EquipItem, Group, GroupLogEntry, LootImage, PartyMember, TrayFile } from '../types';

async function readJson(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Файл повреждён или не является корректным JSON.');
  }
}

export function exportCharacter(character: Character): Promise<boolean> {
  const payload: CharacterExportFile = {
    fileType: 'trpg-sheet-character',
    version: 1,
    character: { ...character, schemaVersion: CURRENT_SCHEMA_VERSION },
  };
  const safeName = character.characterName.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'character';
  return saveJsonFile(`${safeName}.json`, payload);
}

const newerSchemaMessage = (version: number) =>
  `Файл создан более новой версией приложения (схема ${version}, у вас — ${CURRENT_SCHEMA_VERSION}). Закройте и заново откройте приложение (чтобы оно обновилось) и повторите импорт.`;

/** Читает файл персонажа и готовит предпросмотр: сам персонаж и что изменится при переносе со старой схемы. */
export async function readCharacterFile(file: File): Promise<ImportPreview> {
  const parsed = await readJson(file);

  if ((parsed as { fileType?: string })?.fileType === 'trpg-sheet-backup') {
    throw new Error('Это файл полной резервной копии — загрузите его кнопкой «Восстановить из копии».');
  }

  const data = parsed as Partial<CharacterExportFile> & { character?: Character };
  const character = data.character ?? (parsed as Character);

  if (!character || typeof character !== 'object' || !character.id || !character.baseStats) {
    throw new Error('Это не похоже на файл карточки персонажа.');
  }

  if (isFromNewerSchema(character)) throw new Error(newerSchemaMessage(character.schemaVersion ?? 0));

  const normalized = normalizeCharacter(character);
  return {
    character: normalized,
    fileVersion: character.schemaVersion ?? 0,
    notes: migrationNotes(character as unknown as Record<string, unknown>, normalized),
  };
}

export interface BackupExtras {
  groups?: Group[];
  enemies?: Enemy[];
  encounters?: Encounter[];
  members?: PartyMember[];
  enemyGroups?: EnemyGroup[];
  masterLoot?: EquipItem[];
  masterImages?: LootImage[];
  groupLogs?: Record<string, GroupLogEntry[]>;
}

export function exportBackup(characters: Character[], lootTray: EquipItem[], extras: BackupExtras = {}): Promise<boolean> {
  const payload: BackupFile = {
    fileType: 'trpg-sheet-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    characters,
    lootTray,
    ...extras,
  };
  const date = new Date().toISOString().slice(0, 10);
  return saveJsonFile(`trpg-backup-${date}.json`, payload);
}

export interface BackupPreview extends BackupExtras {
  characters: Character[];
  lootTray: EquipItem[];
  /** По каждому персонажу копии: что изменится при переносе со старой схемы. */
  notes: Map<string, string[]>;
}

export async function importBackupFromFile(file: File): Promise<BackupPreview> {
  const parsed = await readJson(file);
  const data = parsed as Partial<BackupFile>;

  if (data?.fileType !== 'trpg-sheet-backup' || !Array.isArray(data.characters)) {
    throw new Error('Это не файл резервной копии. Выберите файл, сохранённый кнопкой «Сохранить резервную копию».');
  }

  if (data.characters.some((c) => c && isFromNewerSchema(c))) {
    const newest = Math.max(...data.characters.map((c) => c?.schemaVersion ?? 0));
    throw new Error(`Копия создана более новой версией приложения (схема ${newest}, у вас — ${CURRENT_SCHEMA_VERSION}). Закройте и заново откройте приложение (чтобы оно обновилось) и повторите.`);
  }

  const raws = data.characters.filter((c): c is Character => !!c && typeof c === 'object' && !!c.id && !!c.baseStats);
  const notes = new Map<string, string[]>();
  const characters = raws.map((raw) => {
    const normalized = normalizeCharacter(raw);
    const list = migrationNotes(raw as unknown as Record<string, unknown>, normalized);
    if (list.length > 0) notes.set(raw.id, list);
    return normalized;
  });

  const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    characters,
    lootTray: list<EquipItem>(data.lootTray),
    groups: list<Group>(data.groups),
    enemies: list<Enemy>(data.enemies),
    encounters: list<Encounter>(data.encounters),
    members: list<PartyMember>(data.members),
    enemyGroups: list<EnemyGroup>(data.enemyGroups),
    masterLoot: list<EquipItem>(data.masterLoot),
    masterImages: list<LootImage>(data.masterImages),
    groupLogs: data.groupLogs && typeof data.groupLogs === 'object' ? (data.groupLogs as Record<string, GroupLogEntry[]>) : {},
    notes,
  };
}

/** Служебные пометки мастера (группа, дата, кому выдано) игроку не нужны. */
export function stripMasterFields(item: EquipItem): EquipItem {
  const { groupId: _g, addedAt: _a, givenTo: _t, givenAt: _ga, ...rest } = item;
  return rest;
}

/** Содержимое файла лута для игрока — текстом (чтобы отправить сообщением). */
export function trayFileText(items: EquipItem[]): string {
  const payload: TrayFile = { fileType: 'trpg-sheet-tray', version: 1, exportedAt: new Date().toISOString(), items: items.map(stripMasterFields) };
  return JSON.stringify(payload, null, 2);
}

export function exportTray(items: EquipItem[]): Promise<boolean> {
  const payload: TrayFile = {
    fileType: 'trpg-sheet-tray',
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map(stripMasterFields),
  };
  const date = new Date().toISOString().slice(0, 10);
  return saveJsonFile(`trpg-tray-${date}.json`, payload);
}

/** Читает файл трея; записи с битой структурой подтягиваются к валидному виду или отбрасываются. */
export async function importTrayFromFile(file: File): Promise<EquipItem[]> {
  const parsed = await readJson(file);
  const data = parsed as Partial<TrayFile>;

  if (data?.fileType !== 'trpg-sheet-tray' || !Array.isArray(data.items)) {
    throw new Error('Это не файл трея. Выберите файл, сохранённый кнопкой «Экспорт трея».');
  }

  return data.items
    .filter((i): i is EquipItem => !!i && typeof i === 'object' && typeof i.name === 'string')
    .map((i) => {
      const kind = i.kind === 'ability' ? 'ability' : 'item';
      return {
        ...i,
        id: i.id || uuid(),
        kind,
        statBonuses: i.statBonuses && typeof i.statBonuses === 'object' ? i.statBonuses : {},
        equipped: typeof i.equipped === 'boolean' ? i.equipped : kind === 'ability',
      };
    });
}
