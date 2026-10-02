import type { Character } from '../types';

export const MAX_LEVEL = 100;

/** Очков характеристик, которые персонаж получает за каждый новый уровень (мастер может выдать больше вручную). */
export const POINTS_PER_LEVEL = 2;

// Опыт для перехода с уровня N на N+1, N = 1..49 — значения из официальной таблицы (1→2 … 49→50).
const XP_TABLE_1_TO_50 = [
  100, 210, 320, 450, 580, 720, 870, 1020, 1190, 1360, 1540, 1730, 1920, 2120, 2320, 2530, 2740, 2960, 3180, 3400,
  3630, 3860, 4100, 4340, 4580, 4830, 5080, 5330, 5580, 5840, 6100, 6370, 6640, 6920, 7200, 7480, 7770, 8060, 8360,
  8660, 8960, 9270, 9580, 9900, 10220, 10550, 10880, 11220, 11560,
];

// Для уровней выше 50 официальной таблицы пока нет: продолжаем тренд приростов
// (прирост ≈ 90.6 + 18.18·N^0.67, подобран по таблице 1–50), с округлением до десятков.
// Когда появится точная формула/таблица — заменить это место.
function extendTable(base: number[]): number[] {
  const table = [...base];
  while (table.length < MAX_LEVEL - 1) {
    const n = table.length; // следующий переход N = n + 1; прирост считаем от предыдущего шага
    const increment = 90.6 + 18.18 * Math.pow(n, 0.67);
    table.push(Math.round((table[table.length - 1] + increment) / 10) * 10);
  }
  return table;
}

const XP_TO_NEXT_LEVEL = extendTable(XP_TABLE_1_TO_50);

export function xpRequiredFor(level: number): number | null {
  if (level < 1 || level >= MAX_LEVEL) return null;
  return XP_TO_NEXT_LEVEL[level - 1] ?? null;
}

/** Applies the current experience wallet against the progression table,
 * levelling up as many times as the banked XP allows. */
export function applyExperience(character: Character): Character {
  let { level, experience, statPointsBudget } = character;

  while (level < MAX_LEVEL) {
    const required = xpRequiredFor(level);
    if (required == null || experience < required) break;
    experience -= required;
    level += 1;
    statPointsBudget += POINTS_PER_LEVEL;
  }

  if (level === character.level && experience === character.experience) {
    return character;
  }

  return { ...character, level, experience, statPointsBudget };
}
