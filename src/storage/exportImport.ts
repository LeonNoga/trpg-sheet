import { normalizeCharacter } from '../data/defaults';
import { v4 as uuid } from 'uuid';
import type { BackupFile, Character, CharacterExportFile, EquipItem, TrayFile } from '../types';

function downloadJson(fileName: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function readJson(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Файл повреждён или не является корректным JSON.');
  }
}

export function exportCharacter(character: Character): void {
  const payload: CharacterExportFile = {
    fileType: 'trpg-sheet-character',
    version: 1,
    character,
  };
  const safeName = character.characterName.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'character';
  downloadJson(`${safeName}.json`, payload);
}

export async function importCharacterFromFile(file: File): Promise<Character> {
  const parsed = await readJson(file);

  if ((parsed as { fileType?: string })?.fileType === 'trpg-sheet-backup') {
    throw new Error('Это файл полной резервной копии — загрузите его кнопкой «Восстановить из копии».');
  }

  const data = parsed as Partial<CharacterExportFile> & { character?: Character };
  const character = data.character ?? (parsed as Character);

  if (!character || typeof character !== 'object' || !character.id || !character.baseStats) {
    throw new Error('Это не похоже на файл карточки персонажа.');
  }

  return normalizeCharacter(character);
}

export function exportBackup(characters: Character[], lootTray: EquipItem[]): void {
  const payload: BackupFile = {
    fileType: 'trpg-sheet-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    characters,
    lootTray,
  };
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(`trpg-backup-${date}.json`, payload);
}

export async function importBackupFromFile(file: File): Promise<{ characters: Character[]; lootTray: EquipItem[] }> {
  const parsed = await readJson(file);
  const data = parsed as Partial<BackupFile>;

  if (data?.fileType !== 'trpg-sheet-backup' || !Array.isArray(data.characters)) {
    throw new Error('Это не файл резервной копии. Выберите файл, сохранённый кнопкой «Сохранить резервную копию».');
  }

  const characters = data.characters
    .filter((c): c is Character => !!c && typeof c === 'object' && !!c.id && !!c.baseStats)
    .map(normalizeCharacter);

  return { characters, lootTray: Array.isArray(data.lootTray) ? data.lootTray : [] };
}

export function exportTray(items: EquipItem[]): void {
  const payload: TrayFile = {
    fileType: 'trpg-sheet-tray',
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  };
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(`trpg-tray-${date}.json`, payload);
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
