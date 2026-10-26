import { createContext, useContext } from 'react';
import type { AppMeta, Snapshot, TrashEntry } from '../storage/db';
import type { Character, EquipItem, Path, Roster } from '../types';

export interface AppDataContextValue {
  loading: boolean;
  characters: Character[];
  lootTray: EquipItem[];
  meta: AppMeta;
  /** Недавно удалённые персонажи (хранятся 30 дней, не больше 5). */
  trash: TrashEntry[];
  createCharacter: (path: Path, roster?: Roster) => Character;
  updateCharacter: (character: Character) => void;
  removeCharacter: (id: string) => void;
  /** Копия персонажа с новым id (для «Клонировать»). */
  cloneCharacter: (id: string) => Character | null;
  importCharacter: (character: Character, roster?: Roster) => void;
  restoreBackup: (characters: Character[], lootTray: EquipItem[]) => void;
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
