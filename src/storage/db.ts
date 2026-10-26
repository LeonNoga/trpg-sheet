import { createStore, get, set, del, keys } from 'idb-keyval';
import { normalizeCharacter } from '../data/defaults';
import type { Character, EquipItem } from '../types';

const charactersStore = createStore('trpg-sheet-characters', 'characters');
const settingsStore = createStore('trpg-sheet-settings', 'settings');

const LOOT_TRAY_KEY = 'lootTray';

export async function loadAllCharacters(): Promise<Character[]> {
  const allKeys = await keys(charactersStore);
  const characters = await Promise.all(
    allKeys.map((k) => get<Character>(k, charactersStore)),
  );
  return characters
    .filter((c): c is Character => !!c)
    .map(normalizeCharacter)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCharacter(character: Character): Promise<void> {
  await set(character.id, character, charactersStore);
}

export async function deleteCharacter(id: string): Promise<void> {
  await del(id, charactersStore);
}

export async function loadLootTray(): Promise<EquipItem[]> {
  const data = await get<EquipItem[]>(LOOT_TRAY_KEY, settingsStore);
  return data ?? [];
}

export async function saveLootTray(items: EquipItem[]): Promise<void> {
  await set(LOOT_TRAY_KEY, items, settingsStore);
}

// ---------- служебные данные (напоминания о копии, подсказки) ----------

export interface AppMeta {
  /** Когда последний раз сохраняли резервную копию/экспорт (мс). */
  lastBackupAt?: number;
  /** До какого момента не напоминать о резервной копии (мс). */
  backupSnoozeUntil?: number;
  /** Скрыта ли подсказка «Добавить на экран Домой». */
  installHintDismissed?: boolean;
}

const META_KEY = 'meta';

export async function loadMeta(): Promise<AppMeta> {
  return (await get<AppMeta>(META_KEY, settingsStore)) ?? {};
}

export async function saveMeta(patch: Partial<AppMeta>): Promise<AppMeta> {
  const next = { ...(await loadMeta()), ...patch };
  await set(META_KEY, next, settingsStore);
  return next;
}

// ---------- история версий и корзина ----------

const historyStore = createStore('trpg-sheet-history', 'snapshots');

export interface Snapshot {
  at: number;
  /** Версия персонажа без картинок (портрет и фото карточек) — они слишком тяжёлые, чтобы хранить копии. */
  character: Character;
}

export interface TrashEntry {
  deletedAt: number;
  /** Удалённый персонаж целиком, с картинками. */
  character: Character;
}

const MAX_SNAPSHOTS = 8;
const MAX_TRASH = 5;
const TRASH_TTL_MS = 30 * 24 * 3600 * 1000;

function stripImages(character: Character): Character {
  const strip = (items: EquipItem[]) => items.map(({ image: _image, ...rest }) => rest);
  const { portrait: _portrait, ...rest } = character;
  return { ...rest, items: strip(character.items), abilities: strip(character.abilities) };
}

export async function loadSnapshots(characterId: string): Promise<Snapshot[]> {
  return (await get<Snapshot[]>(`snap:${characterId}`, historyStore)) ?? [];
}

export async function pushSnapshot(previous: Character): Promise<void> {
  const list = await loadSnapshots(previous.id);
  const next = [{ at: Date.now(), character: stripImages(previous) }, ...list].slice(0, MAX_SNAPSHOTS);
  await set(`snap:${previous.id}`, next, historyStore);
}

export async function deleteSnapshots(characterId: string): Promise<void> {
  await del(`snap:${characterId}`, historyStore);
}

export async function loadTrash(): Promise<TrashEntry[]> {
  const list = (await get<TrashEntry[]>('trash', historyStore)) ?? [];
  const fresh = list.filter((e) => Date.now() - e.deletedAt < TRASH_TTL_MS);
  return fresh;
}

export async function addToTrash(character: Character): Promise<void> {
  const list = await loadTrash();
  const next = [{ deletedAt: Date.now(), character }, ...list.filter((e) => e.character.id !== character.id)].slice(0, MAX_TRASH);
  await set('trash', next, historyStore);
}

export async function removeFromTrash(characterId: string): Promise<void> {
  const list = await loadTrash();
  await set('trash', list.filter((e) => e.character.id !== characterId), historyStore);
}
