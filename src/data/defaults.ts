import { v4 as uuid } from 'uuid';
import { STAT_MIN, STAT_ORDER } from './statsConfig';
import { levelStatPoints } from './progression';
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
    roster,
    playerName: '',
    characterName: '',
    species: '',
    path,
    resistanceSource: 'auto',
    initiativeSource: 'auto',
    level: 1,
    experience: 0,
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
    speciesBonuses: blankTraitList(3),
    dnaLists: [blankTraitList(5), blankTraitList(5)],
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
export function normalizeCharacter(raw: Character): Character {
  const legacy = raw as Character & { keyStat?: string; statPointsBudget?: number };
  // Раньше бюджет хранился числом (и пересчитывался при смене уровня). Всё, что сверх
  // положенного по уровню, переезжает в "доп. очки", чтобы существующие карточки не изменились.
  const { statPointsBudget: legacyBudget, ...rest } = legacy;
  return {
    ...rest,
    bonusStatPoints:
      raw.bonusStatPoints ?? (legacyBudget !== undefined ? legacyBudget - levelStatPoints(raw.level) : 0),
    resistanceSource: raw.resistanceSource ?? (legacy.keyStat as Character['resistanceSource']) ?? 'auto',
    initiativeSource: raw.initiativeSource ?? 'auto',
    pools: raw.pools ?? {
      hp: raw.baseStats.vitality + raw.level,
      staminaPoints: raw.baseStats.endurance,
      resourcePoints: raw.baseStats.resource,
    },
    skillTrainingDays: raw.skillTrainingDays ?? {},
    equippedSlots: raw.equippedSlots ?? {},
    speciesBonuses: raw.speciesBonuses ?? blankTraitList(3),
    dnaLists: raw.dnaLists ?? [blankTraitList(5), blankTraitList(5)],
    group: raw.group ?? '',
    points: raw.points ?? 0,
    developmentPoints: raw.developmentPoints ?? 0,
    systemWeapons: raw.systemWeapons ?? blankTraitList(0),
    systemGear: raw.systemGear ?? blankTraitList(0),
    inspirationPoints: raw.inspirationPoints ?? [false, false, false],
    infectionStatus: raw.infectionStatus ?? { success: [false, false, false], fail: [false, false, false] },
    notes: raw.notes ?? '',
  };
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
