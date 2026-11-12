import { createContext, useContext } from 'react';
import type { AppMeta, Snapshot, TrashEntry } from '../storage/db';
import type { Character, Encounter, Enemy, EnemyGroup, EquipItem, Group, GroupBackupFile, GroupLogEntry, GroupSnapshot, LootImage, PartyMember, Path, Roster } from '../types';

export interface AppDataContextValue {
  loading: boolean;
  characters: Character[];
  lootTray: EquipItem[];
  meta: AppMeta;
  /** Недавно удалённые персонажи (хранятся 30 дней, не больше 5). */
  trash: TrashEntry[];
  /** Группы игроков мастер-вида (всегда есть хотя бы одна). */
  groups: Group[];
  /** Выбранная сейчас группа. */
  activeGroupId: string;
  enemies: Enemy[];
  encounters: Encounter[];
  setActiveGroup: (id: string) => void;
  addGroup: (name: string) => Group;
  renameGroup: (id: string, name: string) => void;
  /** Удаляет группу: персонажи, противники и лут переходят в первую из оставшихся, бой группы сбрасывается. */
  deleteGroup: (id: string) => void;
  /** Мини-карточки игроков мастер-вида. */
  members: PartyMember[];
  updateMembers: (members: PartyMember[]) => void;
  enemyGroups: EnemyGroup[];
  updateEnemyGroups: (groups: EnemyGroup[]) => void;
  /** Общий лут мастера (не привязан к группе) и его картинки. */
  masterLoot: EquipItem[];
  updateMasterLoot: (items: EquipItem[]) => void;
  masterImages: LootImage[];
  updateMasterImages: (images: LootImage[]) => void;
  /** Журналы и история групп. */
  groupLogs: Record<string, GroupLogEntry[]>;
  getGroupSnapshots: (groupId: string) => Promise<GroupSnapshot[]>;
  restoreGroupSnapshot: (snapshot: GroupSnapshot) => void;
  /** Импорт копии группы: replace — заменить данные группы с тем же id (или добавить её), copy — добавить как новую группу. */
  importGroupBackup: (file: GroupBackupFile, mode: 'replace' | 'copy') => void;
  updateEnemies: (enemies: Enemy[]) => void;
  updateEncounters: (encounters: Encounter[]) => void;
  createCharacter: (path: Path, roster?: Roster) => Character;
  updateCharacter: (character: Character) => void;
  removeCharacter: (id: string) => void;
  /** Копия персонажа с новым id (для «Клонировать»). */
  cloneCharacter: (id: string) => Character | null;
  importCharacter: (character: Character, roster?: Roster, groupId?: string) => void;
  restoreBackup: (
    characters: Character[],
    lootTray: EquipItem[],
    extras?: {
      groups?: Group[];
      enemies?: Enemy[];
      encounters?: Encounter[];
      members?: PartyMember[];
      enemyGroups?: EnemyGroup[];
      masterLoot?: EquipItem[];
      masterImages?: LootImage[];
      groupLogs?: Record<string, GroupLogEntry[]>;
    },
  ) => void;
  updateLootTray: (items: EquipItem[]) => void;
  /** Добавляет в начало трея (безопасно вызывать подряд из асинхронного цикла). */
  addToLootTray: (items: EquipItem[]) => void;
  updateMeta: (patch: Partial<AppMeta>) => void;
  restoreFromTrash: (id: string) => void;
  getSnapshots: (id: string) => Promise<Snapshot[]>;
  /** Откатывает персонажа к снимку; текущее состояние само сохраняется как ещё один снимок. */
  restoreSnapshot: (snapshot: Snapshot) => void;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
