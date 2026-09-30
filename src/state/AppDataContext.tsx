import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  deleteCharacter,
  loadAllCharacters,
  loadLootTray,
  loadProgressionConfig,
  saveCharacter,
  saveLootTray,
  saveProgressionConfig,
} from '../storage/db';
import { applyExperience } from '../data/progression';
import { createBlankCharacter } from '../data/defaults';
import type { Character, EquipItem, Path, ProgressionConfig, Roster } from '../types';

interface AppDataContextValue {
  loading: boolean;
  characters: Character[];
  progressionConfig: ProgressionConfig;
  lootTray: EquipItem[];
  createCharacter: (path: Path, roster?: Roster) => Character;
  updateCharacter: (character: Character) => void;
  removeCharacter: (id: string) => void;
  importCharacter: (character: Character, roster?: Roster) => void;
  updateProgressionConfig: (data: ProgressionConfig) => void;
  updateLootTray: (items: EquipItem[]) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [progressionConfig, setProgressionConfig] = useState<ProgressionConfig | null>(null);
  const [lootTray, setLootTray] = useState<EquipItem[]>([]);

  useEffect(() => {
    (async () => {
      const [chars, prog, loot] = await Promise.all([
        loadAllCharacters(),
        loadProgressionConfig(),
        loadLootTray(),
      ]);
      setCharacters(chars);
      setProgressionConfig(prog);
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

  const updateCharacter = useCallback(
    (character: Character) => {
      const config = progressionConfig ?? { xpToNextLevel: [], pointsPerLevel: 2 };
      const leveled = applyExperience(character, config);
      const next: Character = { ...leveled, updatedAt: Date.now() };
      setCharacters((prev) => prev.map((c) => (c.id === next.id ? next : c)));
      void saveCharacter(next);
    },
    [progressionConfig],
  );

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

  const updateProgressionConfig = useCallback((data: ProgressionConfig) => {
    setProgressionConfig(data);
    void saveProgressionConfig(data);
  }, []);

  const updateLootTray = useCallback((items: EquipItem[]) => {
    setLootTray(items);
    void saveLootTray(items);
  }, []);

  const value = useMemo<AppDataContextValue | null>(() => {
    if (!progressionConfig) return null;
    return {
      loading,
      characters,
      progressionConfig,
      lootTray,
      createCharacter,
      updateCharacter,
      removeCharacter,
      importCharacter,
      updateProgressionConfig,
      updateLootTray,
    };
  }, [
    loading,
    characters,
    progressionConfig,
    lootTray,
    createCharacter,
    updateCharacter,
    removeCharacter,
    importCharacter,
    updateProgressionConfig,
    updateLootTray,
  ]);

  if (!value) return null;

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
