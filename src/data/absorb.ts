import { abilitySlotLimit } from './slots';
import type { Character, EquipItem } from '../types';

/**
 * «Впитанное» умение — то, чьё название стоит в одном из списков слотов (видовые/классовые/модели, обычные, артефактные).
 * Состояние не хранится отдельно: оно считается по спискам, поэтому уже вписанные умения сразу отмечены.
 */
const norm = (text: string) => text.trim().toLowerCase();

export function isAbsorbed(character: Character, item: Pick<EquipItem, 'name'>): boolean {
  const key = norm(item.name);
  if (!key) return false;
  return character.dnaLists.some((list) => list.slots.some((slot) => norm(slot) === key));
}

/** Индексы списков в Character.dnaLists: 0 — видовые/классовые/модели, 1 — обычные, 2 — артефактные. */
export type AbsorbTarget = 0 | 1 | 2;

/** Куда попадает артефактное умение — всегда в третий список; обычное игрок выбирает между 0 и 1. */
export function artifactTarget(): AbsorbTarget {
  return 2;
}

const BASE_LINES = 5;

/** Первый свободный слот списка; для обычного списка (1) — только среди открытых на уровне. −1, если мест нет. */
export function freeSlotIndex(character: Character, target: AbsorbTarget): number {
  const slots = character.dnaLists[target]?.slots ?? [];
  const open = target === 1 ? abilitySlotLimit(character.level) : Math.max(BASE_LINES, slots.length);
  for (let i = 0; i < open; i++) {
    if (!(slots[i] ?? '').trim()) return i;
  }
  return target === 1 ? -1 : open; // свободные списки растут: строка добавляется в конец
}

/** Вписывает название умения в свободный слот выбранного списка; null — если мест нет. */
export function absorbAbility(character: Character, item: Pick<EquipItem, 'name'>, target: AbsorbTarget): Character | null {
  const name = item.name.trim();
  if (!name) return null;
  const index = freeSlotIndex(character, target);
  if (index < 0) return null;
  const dnaLists = character.dnaLists.map((list, i) => {
    if (i !== target) return list;
    const slots = Array.from({ length: Math.max(list.slots.length, index + 1) }, (_, j) => list.slots[j] ?? '');
    slots[index] = name;
    return { ...list, slots };
  });
  return { ...character, dnaLists };
}

/** Освобождает все слоты с этим названием (слот остаётся пустой строкой — нумерация не сдвигается). */
export function releaseAbility(character: Character, item: Pick<EquipItem, 'name'>): Character {
  const key = norm(item.name);
  if (!key) return character;
  return {
    ...character,
    dnaLists: character.dnaLists.map((list) => ({ ...list, slots: list.slots.map((slot) => (norm(slot) === key ? '' : slot)) })),
  };
}
