import { createStore, get, set, del, keys } from 'idb-keyval';
import { defaultProgressionConfig } from '../data/progression';
import { defaultReferenceSheet } from '../data/defaults';
import type { Character, EquipItem, ProgressionConfig, ReferenceSheetData } from '../types';

const charactersStore = createStore('trpg-sheet-characters', 'characters');
const settingsStore = createStore('trpg-sheet-settings', 'settings');

const REFERENCE_KEY = 'referenceSheet';
const PROGRESSION_KEY = 'progressionConfig';
const LOOT_TRAY_KEY = 'lootTray';

export async function loadAllCharacters(): Promise<Character[]> {
  const allKeys = await keys(charactersStore);
  const characters = await Promise.all(
    allKeys.map((k) => get<Character>(k, charactersStore)),
  );
  return characters.filter((c): c is Character => !!c).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCharacter(character: Character): Promise<void> {
  await set(character.id, character, charactersStore);
}

export async function deleteCharacter(id: string): Promise<void> {
  await del(id, charactersStore);
}

export async function loadReferenceSheet(): Promise<ReferenceSheetData> {
  const data = await get<ReferenceSheetData>(REFERENCE_KEY, settingsStore);
  return data ?? defaultReferenceSheet();
}

export async function saveReferenceSheet(data: ReferenceSheetData): Promise<void> {
  await set(REFERENCE_KEY, data, settingsStore);
}

export async function loadProgressionConfig(): Promise<ProgressionConfig> {
  const data = await get<ProgressionConfig>(PROGRESSION_KEY, settingsStore);
  return data ?? defaultProgressionConfig();
}

export async function saveProgressionConfig(data: ProgressionConfig): Promise<void> {
  await set(PROGRESSION_KEY, data, settingsStore);
}

export async function loadLootTray(): Promise<EquipItem[]> {
  const data = await get<EquipItem[]>(LOOT_TRAY_KEY, settingsStore);
  return data ?? [];
}

export async function saveLootTray(items: EquipItem[]): Promise<void> {
  await set(LOOT_TRAY_KEY, items, settingsStore);
}
