import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  deleteGroupSnapshots,
  loadEnemyGroups,
  loadGroupLogs,
  loadGroupSnapshots,
  loadMasterImages,
  loadMasterLoot,
  loadMembers,
  pushGroupSnapshot,
  saveEnemyGroups,
  saveGroupLogs,
  saveMasterImages,
  saveMasterLoot,
  saveMembers,
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
import { buildGroupSnapshot, createGroup, effectiveGroupId, inGroup, memberFromCharacter, reattachImages, remapGroupBackup } from '../data/gm';
import { applyDrafts, diffEncounters, diffEnemies, diffEnemyGroups, diffLoot, diffMembers } from '../data/groupLog';
import type { LogDraft } from '../data/groupLog';
import type { Character, Encounter, Enemy, EnemyGroup, EquipItem, Group, GroupBackupFile, GroupLogEntry, GroupSnapshot, LootImage, PartyMember, Path, Roster } from '../types';

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
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [enemyGroups, setEnemyGroups] = useState<EnemyGroup[]>([]);
  const [masterLoot, setMasterLoot] = useState<EquipItem[]>([]);
  const [masterImages, setMasterImages] = useState<LootImage[]>([]);
  const [groupLogs, setGroupLogs] = useState<Record<string, GroupLogEntry[]>>({});
  const membersRef = useRef<PartyMember[]>([]);
  const enemyGroupsRef = useRef<EnemyGroup[]>([]);
  const masterLootRef = useRef<EquipItem[]>([]);
  const masterImagesRef = useRef<LootImage[]>([]);
  const groupLogsRef = useRef<Record<string, GroupLogEntry[]>>({});
  const lastGroupSnapRef = useRef(new Map<string, number>());
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
      const [chars0, loot, loadedMeta, loadedTrash, loadedGroups, loadedEnemies, loadedEncounters, loadedMembers, loadedEnemyGroups, loadedMasterLoot, loadedMasterImages, loadedLogs] = await Promise.all([
        loadAllCharacters(),
        loadLootTray(),
        loadMeta(),
        loadTrash(),
        loadGroups(),
        loadEnemies(),
        loadEncounters(),
        loadMembers(),
        loadEnemyGroups(),
        loadMasterLoot(),
        loadMasterImages(),
        loadGroupLogs(),
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
      // Полные карточки игроков в мастер-виде больше не нужны: прежние превращаются в мини-карточки (с тем же id, чтобы
      // сохранился порядок боя), а сами карточки остаются в обычном списке персонажей — их можно открыть там.
      let startMembers = loadedMembers;
      let chars = chars0;
      const legacy = chars0.filter((c) => c.roster === 'gm-player');
      if (legacy.length > 0) {
        const known = new Set(loadedMembers.map((m) => m.id));
        const created = legacy.filter((c) => !known.has(c.id)).map((c) => ({ ...memberFromCharacter(c, c.groupId), id: c.id }));
        startMembers = [...loadedMembers, ...created];
        if (created.length > 0) void saveMembers(startMembers);
        chars = chars0.map((c) => (c.roster === 'gm-player' ? { ...c, roster: 'personal' as const, groupId: undefined } : c));
        chars.filter((c, i) => c !== chars0[i]).forEach((c) => void saveCharacter(c));
      }
      membersRef.current = startMembers;
      setMembers(startMembers);
      enemyGroupsRef.current = loadedEnemyGroups;
      setEnemyGroups(loadedEnemyGroups);
      masterLootRef.current = loadedMasterLoot;
      setMasterLoot(loadedMasterLoot);
      masterImagesRef.current = loadedMasterImages;
      setMasterImages(loadedMasterImages);
      groupLogsRef.current = loadedLogs;
      setGroupLogs(loadedLogs);
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

  /** Записывает правки группы в журналы и, если давно не было, сохраняет снимок состояния ДО правки (история группы). */
  const recordGroupChange = useCallback((drafts: LogDraft[]) => {
    if (drafts.length === 0) return;
    const now = Date.now();
    for (const groupId of new Set(drafts.map((d) => d.groupId))) {
      if (now - (lastGroupSnapRef.current.get(groupId) ?? 0) > 15 * 60 * 1000) {
        lastGroupSnapRef.current.set(groupId, now);
        const groups = groupsRef.current;
        void pushGroupSnapshot(
          buildGroupSnapshot(groupId, {
            members: membersRef.current.filter((m) => inGroup(m, groupId, groups)),
            enemies: enemiesRef.current.filter((e) => inGroup(e, groupId, groups)),
            enemyGroups: enemyGroupsRef.current.filter((g) => inGroup(g, groupId, groups)),
            encounter: encountersRef.current.find((e) => e.groupId === groupId),
            loot: lootRef.current.filter((i) => inGroup(i, groupId, groups)),
            masterLoot: masterLootRef.current.filter((i) => inGroup(i, groupId, groups)),
          }),
        );
      }
    }
    const next = applyDrafts(groupLogsRef.current, drafts, now);
    groupLogsRef.current = next;
    setGroupLogs(next);
    void saveGroupLogs(next);
  }, []);

  const updateLootTray = useCallback(
    (incoming: EquipItem[]) => {
      // Новые записи получают дату добавления (по ней мастер фильтрует лут); старые остаются как были.
      const known = new Set(lootRef.current.map((i) => i.id));
      const now = Date.now();
      const items = incoming.map((i) => (!known.has(i.id) && !i.addedAt ? { ...i, addedAt: now } : i));
      recordGroupChange(diffLoot(lootRef.current, items, groupsRef.current));
      lootRef.current = items;
      setLootTray(items);
      void saveLootTray(items);
    },
    [recordGroupChange],
  );

  const updateMasterLoot = useCallback((incoming: EquipItem[]) => {
    const known = new Set(masterLootRef.current.map((i) => i.id));
    const now = Date.now();
    const items = incoming.map((i) => (!known.has(i.id) && !i.addedAt ? { ...i, addedAt: now } : i));
    masterLootRef.current = items;
    setMasterLoot(items);
    void saveMasterLoot(items);
  }, []);

  const updateMasterImages = useCallback((images: LootImage[]) => {
    masterImagesRef.current = images;
    setMasterImages(images);
    void saveMasterImages(images);
  }, []);

  const addToLootTray = useCallback(
    (items: EquipItem[]) => updateLootTray([...items, ...lootRef.current]),
    [updateLootTray],
  );

  // Слияние по id: совпавшие записи перезаписываются данными из копии, остальные остаются/добавляются.
  const restoreBackup = useCallback(
    (backupCharacters: Character[], backupLoot: EquipItem[], extras: {
        groups?: Group[];
        enemies?: Enemy[];
        encounters?: Encounter[];
        members?: PartyMember[];
        enemyGroups?: EnemyGroup[];
        masterLoot?: EquipItem[];
        masterImages?: LootImage[];
        groupLogs?: Record<string, GroupLogEntry[]>;
      } = {}) => {
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
      if (extras.members?.length) {
        const merged = mergeById(membersRef.current, extras.members);
        membersRef.current = merged;
        setMembers(merged);
        void saveMembers(merged);
      }
      if (extras.enemyGroups?.length) {
        const merged = mergeById(enemyGroupsRef.current, extras.enemyGroups);
        enemyGroupsRef.current = merged;
        setEnemyGroups(merged);
        void saveEnemyGroups(merged);
      }
      if (extras.masterLoot?.length) {
        const merged = mergeById(masterLootRef.current, extras.masterLoot);
        masterLootRef.current = merged;
        setMasterLoot(merged);
        void saveMasterLoot(merged);
      }
      if (extras.masterImages?.length) {
        const merged = mergeById(masterImagesRef.current, extras.masterImages);
        masterImagesRef.current = merged;
        setMasterImages(merged);
        void saveMasterImages(merged);
      }
      if (extras.groupLogs) {
        const merged = { ...groupLogsRef.current };
        for (const [gid, entries] of Object.entries(extras.groupLogs)) {
          const have = new Set((merged[gid] ?? []).map((e) => e.id));
          merged[gid] = [...(merged[gid] ?? []), ...entries.filter((e) => !have.has(e.id))].sort((a, b) => a.at - b.at).slice(-500);
        }
        groupLogsRef.current = merged;
        setGroupLogs(merged);
        void saveGroupLogs(merged);
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

  const updateEnemies = useCallback(
    (next: Enemy[]) => {
      recordGroupChange(diffEnemies(enemiesRef.current, next, groupsRef.current));
      enemiesRef.current = next;
      setEnemies(next);
      void saveEnemies(next);
    },
    [recordGroupChange],
  );

  const updateMembers = useCallback(
    (next: PartyMember[]) => {
      recordGroupChange(diffMembers(membersRef.current, next, groupsRef.current));
      membersRef.current = next;
      setMembers(next);
      void saveMembers(next);
    },
    [recordGroupChange],
  );

  const updateEnemyGroups = useCallback(
    (next: EnemyGroup[]) => {
      recordGroupChange(diffEnemyGroups(enemyGroupsRef.current, next, groupsRef.current));
      enemyGroupsRef.current = next;
      setEnemyGroups(next);
      void saveEnemyGroups(next);
    },
    [recordGroupChange],
  );

  const updateEncounters = useCallback(
    (next: Encounter[]) => {
      const nameOf = (p: { kind: string; refId: string }) =>
        (p.kind === 'player' ? membersRef.current.find((m) => m.id === p.refId)?.name : enemiesRef.current.find((e) => e.id === p.refId)?.name) || 'без имени';
      recordGroupChange(diffEncounters(encountersRef.current, next, nameOf));
      encountersRef.current = next;
      setEncounters(next);
      void saveEncounters(next);
    },
    [recordGroupChange],
  );

  const getGroupSnapshots = useCallback((groupId: string) => loadGroupSnapshots(groupId), []);

  /** Возврат группы к снимку: текущее состояние само попадает в историю, картинки возвращаются записям по id. */
  const restoreGroupSnapshot = useCallback(
    (snapshot: GroupSnapshot) => {
      const groupId = snapshot.groupId;
      const groups = groupsRef.current;
      const mine = <T extends { groupId?: string }>(list: T[]) => list.filter((x) => inGroup(x, groupId, groups));
      const rest = <T extends { groupId?: string }>(list: T[]) => list.filter((x) => !inGroup(x, groupId, groups));
      void pushGroupSnapshot(
        buildGroupSnapshot(groupId, {
          members: mine(membersRef.current),
          enemies: mine(enemiesRef.current),
          enemyGroups: mine(enemyGroupsRef.current),
          encounter: encountersRef.current.find((e) => e.groupId === groupId),
          loot: mine(lootRef.current),
          masterLoot: mine(masterLootRef.current),
        }),
      );
      const stamp = <T extends { groupId?: string }>(list: T[]) => list.map((x) => ({ ...x, groupId }));
      const nextMembers = [...stamp(snapshot.members), ...rest(membersRef.current)];
      membersRef.current = nextMembers;
      setMembers(nextMembers);
      void saveMembers(nextMembers);
      const nextEnemies = [...stamp(reattachImages(snapshot.enemies, mine(enemiesRef.current))), ...rest(enemiesRef.current)];
      enemiesRef.current = nextEnemies;
      setEnemies(nextEnemies);
      void saveEnemies(nextEnemies);
      const nextEnemyGroups = [...stamp(snapshot.enemyGroups), ...rest(enemyGroupsRef.current)];
      enemyGroupsRef.current = nextEnemyGroups;
      setEnemyGroups(nextEnemyGroups);
      void saveEnemyGroups(nextEnemyGroups);
      const nextEncounters = [...encountersRef.current.filter((e) => e.groupId !== groupId), ...(snapshot.encounter ? [snapshot.encounter] : [])];
      encountersRef.current = nextEncounters;
      setEncounters(nextEncounters);
      void saveEncounters(nextEncounters);
      const nextLoot = [...stamp(reattachImages(snapshot.loot, mine(lootRef.current))), ...rest(lootRef.current)];
      lootRef.current = nextLoot;
      setLootTray(nextLoot);
      void saveLootTray(nextLoot);
      if (snapshot.masterLoot) {
        const nextMaster = [...stamp(reattachImages(snapshot.masterLoot, mine(masterLootRef.current))), ...rest(masterLootRef.current)];
        masterLootRef.current = nextMaster;
        setMasterLoot(nextMaster);
        void saveMasterLoot(nextMaster);
      }
      const logs = applyDrafts(
        groupLogsRef.current,
        [{ groupId, entry: { kind: 'note', text: `Возврат группы к версии от ${new Date(snapshot.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` } }],
      );
      groupLogsRef.current = logs;
      setGroupLogs(logs);
      void saveGroupLogs(logs);
    },
    [],
  );

  const importGroupBackup = useCallback(
    (original: GroupBackupFile, mode: 'replace' | 'copy') => {
      const data = mode === 'copy' ? remapGroupBackup(original, groupsRef.current.map((g) => g.name)) : original;
      const groupId = data.group.id;
      const existed = groupsRef.current.some((g) => g.id === groupId);
      if (existed) {
        // Заменяемая группа сначала сохраняется в историю — импорт можно откатить.
        const current = groupsRef.current;
        const mineNow = <T extends { groupId?: string }>(list: T[]) => list.filter((x) => inGroup(x, groupId, current));
        void pushGroupSnapshot(
          buildGroupSnapshot(groupId, {
            members: mineNow(membersRef.current),
            enemies: mineNow(enemiesRef.current),
            enemyGroups: mineNow(enemyGroupsRef.current),
            encounter: encountersRef.current.find((e) => e.groupId === groupId),
            loot: mineNow(lootRef.current),
            masterLoot: mineNow(masterLootRef.current),
          }),
        );
      } else {
        const nextGroups = [...groupsRef.current, data.group];
        groupsRef.current = nextGroups;
        setGroups(nextGroups);
        void saveGroups(nextGroups);
      }
      const groups = groupsRef.current;
      const rest = <T extends { groupId?: string }>(list: T[]) => list.filter((x) => !inGroup(x, groupId, groups));
      const stamp = <T extends { groupId?: string }>(list: T[]) => list.map((x) => ({ ...x, groupId }));

      const nextMembers = [...stamp(data.members), ...rest(membersRef.current)];
      membersRef.current = nextMembers;
      setMembers(nextMembers);
      void saveMembers(nextMembers);
      const nextEnemies = [...stamp(data.enemies), ...rest(enemiesRef.current)];
      enemiesRef.current = nextEnemies;
      setEnemies(nextEnemies);
      void saveEnemies(nextEnemies);
      const nextEnemyGroups = [...stamp(data.enemyGroups), ...rest(enemyGroupsRef.current)];
      enemyGroupsRef.current = nextEnemyGroups;
      setEnemyGroups(nextEnemyGroups);
      void saveEnemyGroups(nextEnemyGroups);
      const nextEncounters = [...encountersRef.current.filter((e) => e.groupId !== groupId), ...(data.encounter ? [{ ...data.encounter, groupId }] : [])];
      encountersRef.current = nextEncounters;
      setEncounters(nextEncounters);
      void saveEncounters(nextEncounters);
      const nextLoot = [...stamp(data.loot), ...rest(lootRef.current)];
      lootRef.current = nextLoot;
      setLootTray(nextLoot);
      void saveLootTray(nextLoot);
      if (data.masterLoot) {
        const nextMaster = [...stamp(data.masterLoot), ...rest(masterLootRef.current)];
        masterLootRef.current = nextMaster;
        setMasterLoot(nextMaster);
        void saveMasterLoot(nextMaster);
      }
      if (data.masterImages) {
        const nextImages = [...stamp(data.masterImages), ...rest(masterImagesRef.current)];
        masterImagesRef.current = nextImages;
        setMasterImages(nextImages);
        void saveMasterImages(nextImages);
      }

      // Персонажи мастера группы: совпавшие по id заменяются, остальные добавляются.
      if (data.characters.length > 0) {
        const incoming = data.characters.map((c) => ({ ...c, roster: 'gm-master' as const, groupId }));
        const ids = new Set(incoming.map((c) => c.id));
        incoming.forEach((c) => {
          const old = charactersRef.current.find((x) => x.id === c.id);
          if (old) void pushSnapshot(old);
          persistedRef.current.set(c.id, c);
          void saveCharacter(c);
        });
        setAll([...incoming, ...charactersRef.current.filter((c) => !ids.has(c.id))]);
      }

      const stampText = new Date(data.exportedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
      const log = [...data.log, { id: crypto.randomUUID(), at: Date.now(), kind: 'note' as const, text: `Группа ${existed ? 'заменена данными' : 'импортирована'} из файла копии от ${stampText}` }];
      groupLogsRef.current = { ...groupLogsRef.current, [groupId]: log.slice(-500) };
      setGroupLogs(groupLogsRef.current);
      void saveGroupLogs(groupLogsRef.current);
      updateMeta({ activeGroupId: groupId });
    },
    [setAll, updateMeta],
  );

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
      updateMembers(membersRef.current.map((m) => (belongs(m.groupId) ? { ...m, groupId: target } : m)));
      updateMasterLoot(masterLootRef.current.map((i) => (belongs(i.groupId) ? { ...i, groupId: target } : i)));
      updateMasterImages(masterImagesRef.current.map((i) => (belongs(i.groupId) ? { ...i, groupId: target } : i)));
      updateEnemyGroups(enemyGroupsRef.current.map((g) => (belongs(g.groupId) ? { ...g, groupId: target } : g)));
      const { [id]: _droppedLog, ...keptLogs } = groupLogsRef.current;
      groupLogsRef.current = keptLogs;
      setGroupLogs(keptLogs);
      void saveGroupLogs(keptLogs);
      void deleteGroupSnapshots(id);
      updateEncounters(encountersRef.current.filter((e) => e.groupId !== id));
      if (metaRef.current.activeGroupId === id) updateMeta({ activeGroupId: target });
    },
    [setAll, updateEncounters, updateEnemies, updateEnemyGroups, updateLootTray, updateMasterImages, updateMasterLoot, updateMembers, updateMeta],
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
      members,
      updateMembers,
      enemyGroups,
      updateEnemyGroups,
      masterLoot,
      updateMasterLoot,
      masterImages,
      updateMasterImages,
      groupLogs,
      getGroupSnapshots,
      restoreGroupSnapshot,
      importGroupBackup,
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
      members,
      updateMembers,
      enemyGroups,
      updateEnemyGroups,
      masterLoot,
      updateMasterLoot,
      masterImages,
      updateMasterImages,
      groupLogs,
      getGroupSnapshots,
      restoreGroupSnapshot,
      importGroupBackup,
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
