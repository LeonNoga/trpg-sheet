import { v4 as uuid } from 'uuid';
import { STAT_MIN, STAT_ORDER, STARTING_STAT_POINTS } from './statsConfig';
import type { Character, EquipItem, KeyStat, Path, ReferenceSheetData, Roster, StatKey } from '../types';

export function blankBaseStats(): Record<StatKey, number> {
  const stats = {} as Record<StatKey, number>;
  for (const key of STAT_ORDER) stats[key] = STAT_MIN;
  return stats;
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
    skills: {},
    items: [],
    abilities: [],
    createdAt: now,
    updatedAt: now,
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
