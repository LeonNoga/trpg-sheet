import { v4 as uuid } from 'uuid';
import { STAT_MIN, STAT_ORDER, STARTING_STAT_POINTS } from './statsConfig';
import type {
  Character,
  EquipItem,
  KeyStat,
  Path,
  ReferenceSheetData,
  Roster,
  StatKey,
  TraitList,
} from '../types';

export function blankBaseStats(): Record<StatKey, number> {
  const stats = {} as Record<StatKey, number>;
  for (const key of STAT_ORDER) stats[key] = STAT_MIN;
  return stats;
}

function blankTraitList(title: string, slotCount: number): TraitList {
  return { id: uuid(), title, slots: Array.from({ length: slotCount }, () => '') };
}

export function createBlankCharacter(
  path: Path,
  keyStat: KeyStat,
  roster: Roster = 'personal',
): Character {
  const now = Date.now();
  return {
    id: uuid(),
    roster,
    playerName: '',
    characterName: '',
    species: '',
    path,
    keyStat,
    level: 1,
    experience: 0,
    statPointsBudget: STARTING_STAT_POINTS,
    baseStats: blankBaseStats(),
    pools: {
      hp: STAT_MIN + 1, // Живучесть(база) + уровень(1) на старте
      staminaPoints: STAT_MIN,
      resourcePoints: STAT_MIN,
    },
    skills: {},
    items: [],
    abilities: [],
    speciesBonuses: blankTraitList('Видовые бонусы', 3),
    dnaLists: [blankTraitList('Видовые ДНК', 5), blankTraitList('ДНК', 5)],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Заполняет отсутствующие поля у персонажа, сохранённого/импортированного
 * до появления пулов, видовых блоков и заметок — чтобы старые файлы и записи
 * в IndexedDB не ломали карточку после обновления схемы. */
export function normalizeCharacter(raw: Character): Character {
  return {
    ...raw,
    pools: raw.pools ?? {
      hp: raw.baseStats.vitality + raw.level,
      staminaPoints: raw.baseStats.endurance,
      resourcePoints: raw.baseStats.resource,
    },
    speciesBonuses: raw.speciesBonuses ?? blankTraitList('Видовые бонусы', 3),
    dnaLists: raw.dnaLists ?? [blankTraitList('Видовые ДНК', 5), blankTraitList('ДНК', 5)],
    notes: raw.notes ?? '',
  };
}

export function createBlankEquipItem(kind: 'item' | 'ability'): EquipItem {
  return {
    id: uuid(),
    kind,
    name: '',
    statBonuses: {},
    equipped: true,
  };
}

export function defaultReferenceSheet(): ReferenceSheetData {
  return {
    mode: 'structured',
    updatedAt: Date.now(),
    sections: [
      {
        id: uuid(),
        title: '0 действий (бесплатно)',
        rows: [
          { id: uuid(), action: 'Пассивная защита', cost: '0д', effect: 'Работает автоматически, 18 + Стойкость + Броня' },
          { id: uuid(), action: 'Что-то сказать', cost: '0д', effect: 'Короткая реплика' },
        ],
      },
      {
        id: uuid(),
        title: '1 действие',
        rows: [
          { id: uuid(), action: 'Атака', cost: '1д', effect: '3д10 (взрывные) + Модификатор характеристики + Навык' },
          { id: uuid(), action: 'Перемещение', cost: '1д', effect: 'До 5м + Мод. Ловкости' },
          { id: uuid(), action: 'Встать', cost: '1д', effect: 'Снять статус «лёжа/сбит с ног»' },
          { id: uuid(), action: 'Сбить с ног', cost: '1д', effect: 'Противостояние Силы против Стойкости/Силы' },
          { id: uuid(), action: 'Защитная стойка', cost: '1д', effect: '+3 к Показателю защиты до следующего хода' },
        ],
      },
      {
        id: uuid(),
        title: '2 действия',
        rows: [
          { id: uuid(), action: 'Мощный удар', cost: '2д', effect: 'Холодное оружие: урон x2' },
          { id: uuid(), action: 'Отступление', cost: '2д', effect: 'Отойти без провокации атаки' },
        ],
      },
      {
        id: uuid(),
        title: 'Боевые расчёты',
        rows: [
          { id: uuid(), action: 'Атака', cost: '', effect: '3д10 + Мод + Навык' },
          { id: uuid(), action: 'Пассивная защита', cost: '', effect: '18 + Стойкость + Бонус брони' },
          { id: uuid(), action: 'Крит', cost: '', effect: 'Итог >= TN + 10 (удвоение количества кубов)' },
        ],
      },
    ],
  };
}
