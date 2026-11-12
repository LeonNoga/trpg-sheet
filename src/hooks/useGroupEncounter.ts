import { useCallback } from 'react';
import { useAppData } from '../state/useAppData';
import { createEncounter } from '../data/gm';
import type { Encounter } from '../types';

/** Бой выбранной группы: если его ещё не было, создаётся пустой (сохраняется при первом изменении). */
export function useGroupEncounter(groupId: string): [Encounter, (next: Encounter) => void] {
  const { encounters, updateEncounters } = useAppData();
  const existing = encounters.find((e) => e.groupId === groupId);
  const encounter = existing ?? createEncounter(groupId);

  const save = useCallback(
    (next: Encounter) => {
      const rest = encounters.filter((e) => e.groupId !== groupId);
      updateEncounters([...rest, next]);
    },
    [encounters, groupId, updateEncounters],
  );

  return [encounter, save];
}
