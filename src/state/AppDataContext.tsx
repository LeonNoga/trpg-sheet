import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  deleteCharacter,
  loadAllCharacters,
  loadLootTray,
  saveCharacter,
  saveLootTray,
} from '../storage/db';
import { applyExperience } from '../data/progression';
import { createBlankCharacter } from '../data/defaults';
import type { Character, EquipItem, Path, Roster } from '../types';

interface AppDataContextValue {
  loading: boolean;
  characters: Character[];
  lootTray: EquipItem[];
  createCharacter: (path: Path, roster?: Roster) => Character;
  updateCharacter: (character: Character) => void;
  removeCharacter: (id: string) => void;
  importCharacter: (character: Character, roster?: Roster) => void;
  updateLootTray: (items: EquipItem[]) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [lootTray, setLootTray] = useState<EquipItem[]>([]);

  useEffect(() => {
    (async () => {
      const [chars, loot] = await Promise.all([loadAllCharacters(), loadLootTray()]);
      setCharacters(chars);
      setLootTray(loot);
      setLoading(false);
    })();
  }, []);

  const createCharacter = useCallback((path: Path, roster: Roster = 'personal') => {
    const character = createBlankCharacter(path, roster);
    setCharacters((prev) => [character, ...prev]);
    void saveCharacter(character);
    return character;
  }, []);

  const updateCharacter = useCallback((character: Character) => {
    const leveled = applyExperience(character);
    const next: Character = { ...leveled, updatedAt: Date.now() };
    setCharacters((prev) => prev.map((c) => (c.id === next.id ? next : c)));
    void saveCharacter(next);
  }, []);

  const removeCharacter = useCallback((id: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    void deleteCharacter(id);
  }, []);

  const importCharacter = useCallback((character: Character, roster?: Roster) => {
    const next: Character = { ...character, roster: roster ?? character.roster ?? 'personal', updatedAt: Date.now() };
    setCharacters((prev) => {
      const exists = prev.some((c) => c.id === next.id);
      return exists ? prev.map((c) => (c.id === next.id ? next : c)) : [next, ...prev];
    });
    void saveCharacter(next);
  }, []);

  const updateLootTray = useCallback((items: EquipItem[]) => {
    setLootTray(items);
    void saveLootTray(items);
  }, []);

  const value = useMemo<AppDataContextValue>(
    () => ({
      loading,
      characters,
      lootTray,
      createCharacter,
      updateCharacter,
      removeCharacter,
      importCharacter,
      updateLootTray,
    }),
    [loading, characters, lootTray, createCharacter, updateCharacter, removeCharacter, importCharacter, updateLootTray],
  );

  if (loading) return null;

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
