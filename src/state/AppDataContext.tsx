import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  loadEncounters,
  loadEnemies,
  loadGroups,
  saveEncounters,
  saveEnemies,
  saveGroups,
  addToTrash,
  deleteCharacter,
  deleteSnapshots,
  loadAllCharacters,
  loadLootTray,
  loadMeta,
  loadSnapshots,
  loadTrash,
  pushSnapshot,
  removeFromTrash,
  saveCharacter,
  saveLootTray,
  saveMeta,
} from '../storage/db';
import type { AppMeta, Snapshot, TrashEntry } from '../storage/db';
import { createBlankCharacter, pruneEquippedSlots } from '../data/defaults';
import { applyExperience } from '../data/progression';
import { appendLog, appendNote, diffCharacter } from '../data/changeLog';
import { followMaxChange } from '../data/gameClock';
import { AppDataContext } from './useAppData';
import type { AppDataContextValue } from './useAppData';
import { createGroup, effectiveGroupId } from '../data/gm';
import type { Character, Encounter, Enemy, EquipItem, Group, Path, Roster } from '../types';

const formatStamp = (ms: number) =>
  new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const SAVE_DELAY_MS = 600;
const SNAPSHOT_EVERY_MS = 15 * 60 * 1000;

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [lootTray, setLootTray] = useState<EquipItem[]>([]);
  const [meta, setMeta] = useState<AppMeta>({});
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const groupsRef = useRef<Group[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const encountersRef = useRef<Encounter[]>([]);
  const metaRef = useRef<AppMeta>({});
  // Актуальное содержимое трея вне рендера — чтобы последовательные async-добавления не затирали друг друга.
  const lootRef = useRef<EquipItem[]>([]);
  const charactersRef = useRef<Character[]>([]);
  // Сохранение с задержкой: при вводе текста не переписываем весь объект (с картинками) на каждое нажатие клавиши.
  const pendingRef = useRef(new Map<string, Character>());
  const timerRef = useRef<number | undefined>(undefined);
  // Что сейчас лежит в базе — из этого берётся снимок «до правок».
  const persistedRef = useRef(new Map<string, Character>());
  const lastSnapshotRef = useRef(new Map<string, number>());
  // Только что удалённые персонажи: «Отменить» должно работать сразу, не дожидаясь записи в корзину.
  const recentlyDeletedRef = useRef(new Map<string, Character>());

  const setAll = useCallback((next: Character[]) => {
    charactersRef.current = next;
    setCharacters(next);
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    const pending = [...pendingRef.current.values()];
    pendingRef.current.clear();
    for (const character of pending) {
      const before = persistedRef.current.get(character.id);
      const lastSnap = lastSnapshotRef.current.get(character.id) ?? 0;
      if (before && Date.now() - lastSnap > SNAPSHOT_EVERY_MS) {
        lastSnapshotRef.current.set(character.id, Date.now());
        void pushSnapshot(before);
      }
      persistedRef.current.set(character.id, character);
      void saveCharacter(character);
    }
  }, []);

  const scheduleSave = useCallback(
    (character: Character) => {
      pendingRef.current.set(character.id, character);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    (async () => {
      const [chars, loot, loadedMeta, loadedTrash, loadedGroups, loadedEnemies, loadedEncounters] = await Promise.all([
        loadAllCharacters(),
        loadLootTray(),
        loadMeta(),
        loadTrash(),
        loadGroups(),
        loadEnemies(),
        loadEncounters(),
      ]);
      // Группа всегда есть хотя бы одна: записи без группы относятся к первой.
      const startGroups = loadedGroups.length > 0 ? loadedGroups : [createGroup('')];
      if (loadedGroups.length === 0) void saveGroups(startGroups);
      groupsRef.current = startGroups;
      setGroups(startGroups);
      enemiesRef.current = loadedEnemies;
      encountersRef.current = loadedEncounters;
      setEnemies(loadedEnemies);
      setEncounters(loadedEncounters);
      metaRef.current = loadedMeta;
      persistedRef.current = new Map(chars.map((c) => [c.id, c]));
      setAll(chars);
      lootRef.current = loot;
      setLootTray(loot);
      setMeta(loadedMeta);
      setTrash(loadedTrash);
      setLoading(false);
    })();
  }, [setAll]);

  // Незаписанные правки сохраняем, как только страница прячется или закрывается (на телефоне — при сворачивании).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  const createCharacter = useCallback(
    (path: Path, roster: Roster = 'personal') => {
      const blank = createBlankCharacter(path, roster);
      const character: Character =
        roster === 'personal' ? blank : { ...blank, groupId: effectiveGroupId(metaRef.current.activeGroupId, groupsRef.current) };
      setAll([character, ...charactersRef.current]);
      persistedRef.current.set(character.id, character);
      void saveCharacter(character);
      return character;
    },
    [setAll],
  );

  const updateCharacter = useCallback(
    (character: Character) => {
      const levelled = pruneEquippedSlots(applyExperience(character));
      // Журнал берём из сохранённого состояния, а не из переданного объекта: тот может нести устаревшую копию журнала.
      const prev = charactersRef.current.find((c) => c.id === levelled.id);
      // Повысили уровень или характеристику — вместе с максимумом растут и текущие здоровье, выносливость, ресурс.
      const leveled = prev ? followMaxChange(prev, levelled) : levelled;
      const changeLog = prev ? appendLog(prev.changeLog, diffCharacter(prev, leveled), leveled.level) : leveled.changeLog;
      const next: Character = { ...leveled, changeLog, updatedAt: Date.now() };
      setAll(charactersRef.current.map((c) => (c.id === next.id ? next : c)));
      scheduleSave(next);
    },
    [scheduleSave, setAll],
  );

  const removeCharacter = useCallback(
    (id: string) => {
      const existing = charactersRef.current.find((c) => c.id === id);
      pendingRef.current.delete(id);
      setAll(charactersRef.current.filter((c) => c.id !== id));
      persistedRef.current.delete(id);
      void deleteCharacter(id);
      void deleteSnapshots(id);
      if (existing) {
        recentlyDeletedRef.current.set(id, existing);
        // Удалённый персонаж уходит в корзину целиком — его можно вернуть в течение 30 дней.
        void addToTrash(existing).then(() => loadTrash().then(setTrash));
      }
    },
    [setAll],
  );

  const cloneCharacter = useCallback(
    (id: string) => {
      const source = charactersRef.current.find((c) => c.id === id);
      if (!source) return null;
      const fresh = createBlankCharacter(source.path, source.roster);
      // Копия получает новый id и новые id у предметов, умений и списков, чтобы не пересекаться с оригиналом.
      const renew = (items: EquipItem[]) => items.map((i) => ({ ...i, id: crypto.randomUUID() }));
      const idMap = new Map<string, string>();
      const items = source.items.map((i) => {
        const newId = crypto.randomUUID();
        idMap.set(i.id, newId);
        return { ...i, id: newId };
      });
      const equippedSlots = Object.fromEntries(
        Object.entries(source.equippedSlots).map(([slot, ids]) => [slot, ids.map((i) => idMap.get(i)).filter((i): i is string => !!i)]),
      );
      const copy: Character = {
        ...source,
        id: fresh.id,
        characterName: source.characterName ? `${source.characterName} (копия)` : '',
        items,
        abilities: renew(source.abilities),
        equippedSlots,
        dnaLists: source.dnaLists.map((l) => ({ ...l, id: crypto.randomUUID() })),
        speciesBonuses: { ...source.speciesBonuses, id: crypto.randomUUID() },
        systemWeapons: { ...source.systemWeapons, id: crypto.randomUUID() },
        systemGear: { ...source.systemGear, id: crypto.randomUUID() },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setAll([copy, ...charactersRef.current]);
      persistedRef.current.set(copy.id, copy);
      void saveCharacter(copy);
      return copy;
    },
    [setAll],
  );

  const importCharacter = useCallback(
    (character: Character, roster?: Roster, groupId?: string) => {
      const existing = charactersRef.current.find((c) => c.id === character.id);
      const note = existing
        ? `Импорт из файла: заменена версия от ${formatStamp(existing.updatedAt)}`
        : 'Импортировано из файла';
      const next: Character = {
        ...character,
        roster: roster ?? character.roster ?? 'personal',
        ...(groupId ? { groupId } : {}),
        changeLog: appendNote(character.changeLog, note, character.level),
        updatedAt: Date.now(),
      };
      if (existing) void pushSnapshot(existing); // перезапись при повторном импорте — можно откатить
      setAll(existing ? charactersRef.current.map((c) => (c.id === next.id ? next : c)) : [next, ...charactersRef.current]);
      persistedRef.current.set(next.id, next);
      void saveCharacter(next);
    },
    [setAll],
  );

  const updateLootTray = useCallback((items: EquipItem[]) => {
    lootRef.current = items;
    setLootTray(items);
    void saveLootTray(items);
  }, []);

  const addToLootTray = useCallback(
    (items: EquipItem[]) => updateLootTray([...items, ...lootRef.current]),
    [updateLootTray],
  );

  // Слияние по id: совпавшие записи перезаписываются данными из копии, остальные остаются/добавляются.
  const restoreBackup = useCallback(
    (backupCharacters: Character[], backupLoot: EquipItem[], extras: { groups?: Group[]; enemies?: Enemy[]; encounters?: Encounter[] } = {}) => {
      const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
        const incomingIds = new Set(incoming.map((i) => i.id));
        return [...incoming, ...current.filter((c) => !incomingIds.has(c.id))];
      };
      // Перезаписываемых персонажей сначала сохраняем в историю.
      for (const incoming of backupCharacters) {
        const existing = charactersRef.current.find((c) => c.id === incoming.id);
        if (existing) void pushSnapshot(existing);
      }
      const incomingWithNotes = backupCharacters.map((c) => {
        const existing = charactersRef.current.find((x) => x.id === c.id);
        const note = existing ? `Восстановлено из копии: заменена версия от ${formatStamp(existing.updatedAt)}` : 'Восстановлено из копии';
        return { ...c, changeLog: appendNote(c.changeLog, note, c.level) };
      });
      setAll(mergeById(charactersRef.current, incomingWithNotes));
      incomingWithNotes.forEach((c) => {
        persistedRef.current.set(c.id, c);
        void saveCharacter(c);
      });
      updateLootTray(mergeById(lootRef.current, backupLoot));
      if (extras.groups?.length) {
        const merged = mergeById(groupsRef.current, extras.groups);
        groupsRef.current = merged;
        setGroups(merged);
        void saveGroups(merged);
      }
      if (extras.enemies?.length) {
        const merged = mergeById(enemiesRef.current, extras.enemies);
        enemiesRef.current = merged;
        setEnemies(merged);
        void saveEnemies(merged);
      }
      if (extras.encounters?.length) {
        const merged = mergeById(encountersRef.current, extras.encounters);
        encountersRef.current = merged;
        setEncounters(merged);
        void saveEncounters(merged);
      }
    },
    [setAll, updateLootTray],
  );

  const updateMeta = useCallback((patch: Partial<AppMeta>) => {
    metaRef.current = { ...metaRef.current, ...patch };
    setMeta((prev) => ({ ...prev, ...patch }));
    void saveMeta(patch);
  }, []);

  const setActiveGroup = useCallback((id: string) => updateMeta({ activeGroupId: id }), [updateMeta]);

  const addGroup = useCallback(
    (name: string) => {
      const group = createGroup(name);
      const next = [...groupsRef.current, group];
      groupsRef.current = next;
      setGroups(next);
      void saveGroups(next);
      updateMeta({ activeGroupId: group.id });
      return group;
    },
    [updateMeta],
  );

  const renameGroup = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = groupsRef.current.map((g) => (g.id === id ? { ...g, name: trimmed } : g));
    groupsRef.current = next;
    setGroups(next);
    void saveGroups(next);
  }, []);

  const updateEnemies = useCallback((next: Enemy[]) => {
    enemiesRef.current = next;
    setEnemies(next);
    void saveEnemies(next);
  }, []);

  const updateEncounters = useCallback((next: Encounter[]) => {
    encountersRef.current = next;
    setEncounters(next);
    void saveEncounters(next);
  }, []);

  const restoreFromTrash = useCallback(
    (id: string) => {
      void (async () => {
        const character =
          recentlyDeletedRef.current.get(id) ?? (await loadTrash()).find((e) => e.character.id === id)?.character;
        if (!character) return;
        recentlyDeletedRef.current.delete(id);
        setAll([character, ...charactersRef.current.filter((c) => c.id !== id)]);
        persistedRef.current.set(id, character);
        void saveCharacter(character);
        await removeFromTrash(id);
        setTrash(await loadTrash());
      })();
    },
    [setAll],
  );

  const deleteGroup = useCallback(
    (id: string) => {
      const remaining = groupsRef.current.filter((g) => g.id !== id);
      if (remaining.length === 0) return; // последнюю группу удалить нельзя
      const target = remaining[0].id;
      // Записи без группы числились за первой группой: если удаляется именно она, они тоже переезжают.
      const wasFirst = groupsRef.current[0]?.id === id;
      groupsRef.current = remaining;
      setGroups(remaining);
      void saveGroups(remaining);
      // Всё, что лежало в группе, переезжает в первую из оставшихся.
      const belongs = (groupId?: string) => groupId === id || (wasFirst && !groupId);
      const before = charactersRef.current;
      const movedChars = before.map((c) => (c.roster !== 'personal' && belongs(c.groupId) ? { ...c, groupId: target } : c));
      setAll(movedChars);
      movedChars.forEach((c, i) => {
        if (c !== before[i]) void saveCharacter(c);
      });
      updateLootTray(lootRef.current.map((i) => (belongs(i.groupId) ? { ...i, groupId: target } : i)));
      updateEnemies(enemiesRef.current.map((e) => (belongs(e.groupId) ? { ...e, groupId: target } : e)));
      updateEncounters(encountersRef.current.filter((e) => e.groupId !== id));
      if (metaRef.current.activeGroupId === id) updateMeta({ activeGroupId: target });
    },
    [setAll, updateEncounters, updateEnemies, updateLootTray, updateMeta],
  );

  const getSnapshots = useCallback((id: string) => loadSnapshots(id), []);

  const restoreSnapshot = useCallback(
    (snapshot: Snapshot) => {
      const current = charactersRef.current.find((c) => c.id === snapshot.character.id);
      if (!current) return;
      flush();
      void pushSnapshot(current);
      // В снимках нет картинок: возвращаем их из текущей карточки тем записям, что остались в ней по id.
      const imageOf = (list: EquipItem[]) => new Map(list.map((i) => [i.id, i.image]));
      const itemImages = imageOf(current.items);
      const abilityImages = imageOf(current.abilities);
      const restored: Character = {
        ...snapshot.character,
        portrait: current.portrait,
        items: snapshot.character.items.map((i) => ({ ...i, image: itemImages.get(i.id) })),
        abilities: snapshot.character.abilities.map((i) => ({ ...i, image: abilityImages.get(i.id) })),
        // Журнал не откатывается вместе с версией: в нём остаётся всё, что было, плюс запись о возврате.
        changeLog: appendNote(current.changeLog, `Возврат к версии от ${formatStamp(snapshot.at)}`, snapshot.character.level),
        updatedAt: Date.now(),
      };
      setAll(charactersRef.current.map((c) => (c.id === restored.id ? restored : c)));
      persistedRef.current.set(restored.id, restored);
      void saveCharacter(restored);
    },
    [flush, setAll],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      loading,
      characters,
      lootTray,
      meta,
      trash,
      groups,
      activeGroupId: effectiveGroupId(meta.activeGroupId, groups),
      enemies,
      encounters,
      setActiveGroup,
      addGroup,
      renameGroup,
      deleteGroup,
      updateEnemies,
      updateEncounters,
      createCharacter,
      updateCharacter,
      removeCharacter,
      cloneCharacter,
      importCharacter,
      restoreBackup,
      updateLootTray,
      addToLootTray,
      updateMeta,
      restoreFromTrash,
      getSnapshots,
      restoreSnapshot,
    }),
    [
      loading,
      characters,
      lootTray,
      meta,
      trash,
      groups,
      enemies,
      encounters,
      setActiveGroup,
      addGroup,
      renameGroup,
      deleteGroup,
      updateEnemies,
      updateEncounters,
      createCharacter,
      updateCharacter,
      removeCharacter,
      cloneCharacter,
      importCharacter,
      restoreBackup,
      updateLootTray,
      addToLootTray,
      updateMeta,
      restoreFromTrash,
      getSnapshots,
      restoreSnapshot,
    ],
  );

  if (loading) return null;

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
