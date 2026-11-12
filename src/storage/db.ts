import { createStore, get, set, del, keys } from 'idb-keyval';
import { normalizeCharacter } from '../data/defaults';
import type { Character, Encounter, Enemy, EnemyGroup, EquipItem, Group, GroupLogEntry, GroupSnapshot, LootImage, PartyMember } from '../types';

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

// ---------- мастер-вид: группы, противники, бои ----------

export async function loadGroups(): Promise<Group[]> {
  return (await get<Group[]>('gmGroups', settingsStore)) ?? [];
}

export async function saveGroups(groups: Group[]): Promise<void> {
  await set('gmGroups', groups, settingsStore);
}

export async function loadEnemies(): Promise<Enemy[]> {
  return (await get<Enemy[]>('gmEnemies', settingsStore)) ?? [];
}

export async function saveEnemies(enemies: Enemy[]): Promise<void> {
  await set('gmEnemies', enemies, settingsStore);
}

export async function loadEncounters(): Promise<Encounter[]> {
  return (await get<Encounter[]>('gmEncounters', settingsStore)) ?? [];
}

export async function saveEncounters(encounters: Encounter[]): Promise<void> {
  await set('gmEncounters', encounters, settingsStore);
}

export async function loadMembers(): Promise<PartyMember[]> {
  return (await get<PartyMember[]>('gmMembers', settingsStore)) ?? [];
}

export async function saveMembers(members: PartyMember[]): Promise<void> {
  await set('gmMembers', members, settingsStore);
}

export async function loadEnemyGroups(): Promise<EnemyGroup[]> {
  return (await get<EnemyGroup[]>('gmEnemyGroups', settingsStore)) ?? [];
}

export async function saveEnemyGroups(groups: EnemyGroup[]): Promise<void> {
  await set('gmEnemyGroups', groups, settingsStore);
}

export async function loadMasterLoot(): Promise<EquipItem[]> {
  return (await get<EquipItem[]>('gmMasterLoot', settingsStore)) ?? [];
}

export async function saveMasterLoot(items: EquipItem[]): Promise<void> {
  await set('gmMasterLoot', items, settingsStore);
}

export async function loadMasterImages(): Promise<LootImage[]> {
  return (await get<LootImage[]>('gmMasterImages', settingsStore)) ?? [];
}

export async function saveMasterImages(images: LootImage[]): Promise<void> {
  await set('gmMasterImages', images, settingsStore);
}

export async function loadGroupLogs(): Promise<Record<string, GroupLogEntry[]>> {
  return (await get<Record<string, GroupLogEntry[]>>('gmLogs', settingsStore)) ?? {};
}

export async function saveGroupLogs(logs: Record<string, GroupLogEntry[]>): Promise<void> {
  await set('gmLogs', logs, settingsStore);
}

// ---------- служебные данные (напоминания о копии, подсказки) ----------

export interface AppMeta {
  /** Когда последний раз сохраняли резервную копию/экспорт (мс). */
  lastBackupAt?: number;
  /** До какого момента не напоминать о резервной копии (мс). */
  backupSnoozeUntil?: number;
  /** Скрыта ли подсказка «Добавить на экран Домой». */
  installHintDismissed?: boolean;
  /** Выбранная группа в мастер-виде. */
  activeGroupId?: string;
  /** Когда последний раз сохраняли общую копию мастер-вида (мс). */
  lastMasterBackupAt?: number;
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

// ---------- история групп мастер-вида ----------

const MAX_GROUP_SNAPSHOTS = 8;

export async function loadGroupSnapshots(groupId: string): Promise<GroupSnapshot[]> {
  return (await get<GroupSnapshot[]>(`gsnap:${groupId}`, historyStore)) ?? [];
}

export async function pushGroupSnapshot(snapshot: GroupSnapshot): Promise<void> {
  const list = await loadGroupSnapshots(snapshot.groupId);
  await set(`gsnap:${snapshot.groupId}`, [snapshot, ...list].slice(0, MAX_GROUP_SNAPSHOTS), historyStore);
}

export async function deleteGroupSnapshots(groupId: string): Promise<void> {
  await del(`gsnap:${groupId}`, historyStore);
}
