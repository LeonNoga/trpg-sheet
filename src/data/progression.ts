import type { Character, ProgressionConfig } from '../types';

export const MAX_LEVEL = 100;

export function defaultProgressionConfig(): ProgressionConfig {
  return {
    // Плейсхолдер: 100 опыта на каждый уровень. Отредактируйте на экране
    // "Памятка и прогрессия", когда появится точная формула баланса.
    xpToNextLevel: Array.from({ length: MAX_LEVEL - 1 }, () => 100),
    pointsPerLevel: 2,
  };
}

export function xpRequiredFor(level: number, config: ProgressionConfig): number | null {
  if (level < 1 || level >= MAX_LEVEL) return null;
  return config.xpToNextLevel[level - 1] ?? null;
}

/** Applies the current experience wallet against the progression table,
 * levelling up as many times as the banked XP allows. Mutates a copy. */
export function applyExperience(character: Character, config: ProgressionConfig): Character {
  let { level, experience, statPointsBudget } = character;

  while (level < MAX_LEVEL) {
    const required = xpRequiredFor(level, config);
    if (required == null || experience < required) break;
    experience -= required;
    level += 1;
    statPointsBudget += config.pointsPerLevel;
  }

  if (level === character.level && experience === character.experience) {
    return character;
  }

  return { ...character, level, experience, statPointsBudget };
}
