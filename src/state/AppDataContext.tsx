import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  deleteCharacter,
  loadAllCharacters,
  loadLootTray,
  loadProgressionConfig,
  loadReferenceSheet,
  saveCharacter,
  saveLootTray,
  saveProgressionConfig,
  saveReferenceSheet,
} from '../storage/db';
import { applyExperience } from '../data/progression';
import { createBlankCharacter } from '../data/defaults';
import type {
  Character,
  EquipItem,
  KeyStat,
  Path,
  ProgressionConfig,
  ReferenceSheetData,
  Roster,
} from '../types';

interface AppDataContextValue {
  loading: boolean;
  characters: Character[];
  referenceSheet: ReferenceSheetData;
  progressionConfig: ProgressionConfig;
  lootTray: EquipItem[];
  createCharacter: (path: Path, keyStat: KeyStat, roster?: Roster) => Character;
  updateCharacter: (character: Character) => void;
  removeCharacter: (id: string) => void;
  importCharacter: (character: Character, roster?: Roster) => void;
  updateReferenceSheet: (data: ReferenceSheetData) => void;
  updateProgressionConfig: (data: ProgressionConfig) => void;
  updateLootTray: (items: EquipItem[]) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [referenceSheet, setReferenceSheet] = useState<ReferenceSheetData | null>(null);
  const [progressionConfig, setProgressionConfig] = useState<ProgressionConfig | null>(null);
  const [lootTray, setLootTray] = useState<EquipItem[]>([]);

  useEffect(() => {
    (async () => {
      const [chars, ref, prog, loot] = await Promise.all([
        loadAllCharacters(),
        loadReferenceSheet(),
        loadProgressionConfig(),
        loadLootTray(),
      ]);
      setCharacters(chars);
      setReferenceSheet(ref);
      setProgressionConfig(prog);
      setLootTray(loot);
      setLoading(false);
    })();
  }, []);

  const createCharacter = useCallback((path: Path, keyStat: KeyStat, roster: Roster = 'personal') => {
    const character = createBlankCharacter(path, keyStat, roster);
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

  const updateReferenceSheet = useCallback((data: ReferenceSheetData) => {
    const next = { ...data, updatedAt: Date.now() };
    setReferenceSheet(next);
    void saveReferenceSheet(next);
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
    if (!referenceSheet || !progressionConfig) return null;
    return {
      loading,
      characters,
      referenceSheet,
      progressionConfig,
      lootTray,
      createCharacter,
      updateCharacter,
      removeCharacter,
      importCharacter,
      updateReferenceSheet,
      updateProgressionConfig,
      updateLootTray,
    };
  }, [
    loading,
    characters,
    referenceSheet,
    progressionConfig,
    lootTray,
    createCharacter,
    updateCharacter,
    removeCharacter,
    importCharacter,
    updateReferenceSheet,
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
