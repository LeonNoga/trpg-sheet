import { v4 as uuid } from 'uuid';
import { STAT_MIN, STAT_ORDER } from './statsConfig';
import { CURRENT_SCHEMA_VERSION, migrateCharacter } from './migrations';
import type { Character, EquipItem, Path, Roster, StatKey, TraitList } from '../types';

export function blankBaseStats(): Record<StatKey, number> {
  const stats = {} as Record<StatKey, number>;
  for (const key of STAT_ORDER) stats[key] = STAT_MIN;
  return stats;
}

function blankTraitList(slotCount: number): TraitList {
  return { id: uuid(), slots: Array.from({ length: slotCount }, () => '') };
}

export function createBlankCharacter(path: Path, roster: Roster = 'personal'): Character {
  const now = Date.now();
  return {
    id: uuid(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    roster,
    playerName: '',
    characterName: '',
    species: '',
    path,
    resistanceSource: 'auto',
    initiativeSource: 'auto',
    level: 1,
    experience: 0,
    levelPoints: 0,
    bonusStatPoints: 0,
    baseStats: blankBaseStats(),
    pools: {
      hp: STAT_MIN + 1, // Живучесть(база) + уровень(1) на старте
      staminaPoints: STAT_MIN,
      resourcePoints: STAT_MIN,
    },
    skills: {},
    skillTrainingDays: {},
    items: [],
    abilities: [],
    equippedSlots: {},
    speciesBonuses: blankTraitList(0),
    dnaLists: [blankTraitList(5), blankTraitList(5), blankTraitList(5)],
    group: '',
    points: 0,
    developmentPoints: 0,
    systemWeapons: blankTraitList(0),
    systemGear: blankTraitList(0),
    inspirationPoints: [false, false, false],
    infectionStatus: { success: [false, false, false], fail: [false, false, false] },
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Заполняет отсутствующие поля у персонажа, сохранённого/импортированного до
 * появления новых блоков — чтобы старые файлы и записи в IndexedDB не ломали
 * карточку после обновления схемы. */
export function normalizeCharacter(input: Character): Character {
  const raw = migrateCharacter(input);
  return pruneEquippedSlots({
    ...raw,
    initiativeSource: raw.initiativeSource ?? 'auto',
    resistanceSource: raw.resistanceSource ?? 'auto',
    levelPoints: raw.levelPoints ?? 2 * (raw.level - 1),
    bonusStatPoints: raw.bonusStatPoints ?? 0,
    pools: raw.pools ?? {
      hp: raw.baseStats.vitality + raw.level,
      staminaPoints: raw.baseStats.endurance,
      resourcePoints: raw.baseStats.resource,
    },
    skillTrainingDays: raw.skillTrainingDays ?? {},
    equippedSlots: raw.equippedSlots ?? {},
    speciesBonuses: raw.speciesBonuses ?? blankTraitList(0),
    // Третий список — артефактные ДНК/умения/технологии; у старых карточек его не было.
    dnaLists: [
      ...(raw.dnaLists ?? [blankTraitList(5), blankTraitList(5)]),
      ...Array.from({ length: Math.max(0, 3 - (raw.dnaLists?.length ?? 2)) }, () => blankTraitList(5)),
    ],
    group: raw.group ?? '',
    points: raw.points ?? 0,
    developmentPoints: raw.developmentPoints ?? 0,
    systemWeapons: raw.systemWeapons ?? blankTraitList(0),
    systemGear: raw.systemGear ?? blankTraitList(0),
    inspirationPoints: raw.inspirationPoints ?? [false, false, false],
    infectionStatus: raw.infectionStatus ?? { success: [false, false, false], fail: [false, false, false] },
    notes: raw.notes ?? '',
  });
}

/**
 * Убирает из слотов экипировки id предметов, которых больше нет у персонажа (удалённых),
 * иначе слот остаётся «занятым» невидимым предметом.
 */
export function pruneEquippedSlots<T extends Pick<Character, 'items' | 'equippedSlots'>>(character: T): T {
  const ids = new Set(character.items.map((i) => i.id));
  const slots = character.equippedSlots ?? {};
  let changed = false;
  const next: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(slots)) {
    const kept = list.filter((id) => ids.has(id));
    if (kept.length !== list.length) changed = true;
    next[key] = kept;
  }
  return changed ? { ...character, equippedSlots: next } : character;
}

export function createBlankEquipItem(kind: 'item' | 'ability'): EquipItem {
  return {
    id: uuid(),
    kind,
    name: '',
    path: 'none',
    statBonuses: {},
    equipped: true,
  };
}
