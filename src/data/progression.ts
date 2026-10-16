import { STARTING_STAT_POINTS, levelPointsRate } from './statsConfig';
import type { Character } from '../types';

export const MAX_LEVEL = 100;

/**
 * Опыт для перехода с уровня N на N+1: XP(N) = 4N·(N+24), округление до ближайших 10.
 * Формула автора системы; совпадает с официальной таблицей (1→2 = 100, 49→50 = 14310, 50→51 = 14800).
 */
export function xpRequiredFor(level: number): number | null {
  if (level < 1 || level >= MAX_LEVEL) return null;
  return Math.round((4 * level * (level + 24)) / 10) * 10;
}

/** Весь бюджет очков характеристик: 100 на старте + накопленные за уровни + награда мастера. */
export function statPointsBudget(character: Pick<Character, 'levelPoints' | 'bonusStatPoints'>): number {
  return STARTING_STAT_POINTS + character.levelPoints + character.bonusStatPoints;
}

/**
 * Как изменятся очки за уровни при ручной смене уровня: каждый добавленный/убранный уровень
 * считается по текущей редкости класса (прошлые уровни задним числом не пересчитываются).
 */
export function levelPointsAfterManualLevel(character: Character, newLevel: number): number {
  const delta = (newLevel - character.level) * levelPointsRate(character.classRarity, character.uniqueLevelPoints);
  return Math.max(0, character.levelPoints + delta);
}

/** Applies the current experience wallet against the progression table,
 * levelling up as many times as the banked XP allows. */
export function applyExperience(character: Character): Character {
  let { level, experience, levelPoints } = character;
  const rate = levelPointsRate(character.classRarity, character.uniqueLevelPoints);

  while (level < MAX_LEVEL) {
    const required = xpRequiredFor(level);
    if (required == null || experience < required) break;
    experience -= required;
    level += 1;
    levelPoints += rate;
  }

  if (level === character.level && experience === character.experience) {
    return character;
  }

  return { ...character, level, experience, levelPoints };
}
