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

/** Класс можно получить не раньше этого уровня; до него очки за уровень всегда +2. */
export const CLASS_MIN_LEVEL = 10;
/** Очки характеристик за уровень без класса (и до получения класса). */
export const BASE_LEVEL_POINTS = 2;

/**
 * Уровень получения класса: null — класса нет. Если класс выбран, а уровень не указан (старые карточки),
 * временно считаем, что он получен на минимальном (10-м), пока игрок не укажет точный.
 */
export function effectiveClassLevel(character: Pick<Character, 'classRarity' | 'classLevel'>): number | null {
  if (!character.classRarity) return null;
  return Math.max(CLASS_MIN_LEVEL, character.classLevel ?? CLASS_MIN_LEVEL);
}

/**
 * Очки характеристик за все уровни: +2 за каждый уровень до получения класса (включительно) и по ставке редкости
 * класса за каждый уровень выше него. Считается по формуле, поэтому ручная смена уровня и смена редкости
 * всегда дают согласованный результат.
 */
export function calcLevelPoints(
  character: Pick<Character, 'level' | 'classRarity' | 'classLevel' | 'uniqueLevelPoints'>,
): number {
  const classLevel = effectiveClassLevel(character);
  if (classLevel === null) return BASE_LEVEL_POINTS * Math.max(0, character.level - 1);
  const before = Math.max(0, Math.min(character.level, classLevel) - 1);
  const after = Math.max(0, character.level - classLevel);
  return BASE_LEVEL_POINTS * before + levelPointsRate(character.classRarity, character.uniqueLevelPoints) * after;
}

/** Сколько очков даст следующий уровень (для подписи в шапке). */
export function nextLevelPoints(
  character: Pick<Character, 'level' | 'classRarity' | 'classLevel' | 'uniqueLevelPoints'>,
): number {
  const classLevel = effectiveClassLevel(character);
  if (classLevel === null || character.level < classLevel) return BASE_LEVEL_POINTS;
  return levelPointsRate(character.classRarity, character.uniqueLevelPoints);
}

/** Сколько очков характеристик ещё можно потратить (отрицательное — перебор у старых карточек). */
export function statPointsRoom(character: Pick<Character, 'levelPoints' | 'bonusStatPoints' | 'baseStats'>): number {
  const spent = Object.values(character.baseStats).reduce((sum, v) => sum + (v ?? 0), 0);
  return statPointsBudget(character) - spent;
}

/**
 * Жёсткий потолок для базового значения одной характеристики: повысить можно только на остаток очков;
 * у карточки с перебором (старые данные) повышать нельзя совсем, но понижать можно всегда.
 */
export function maxBaseStat(
  character: Pick<Character, 'levelPoints' | 'bonusStatPoints' | 'baseStats'>,
  key: keyof Character['baseStats'],
): number {
  const current = character.baseStats[key] ?? 0;
  return current + Math.max(0, statPointsRoom(character));
}

/** Applies the current experience wallet against the progression table,
 * levelling up as many times as the banked XP allows; очки за уровни пересчитываются по формуле. */
export function applyExperience(character: Character): Character {
  let { level, experience } = character;

  while (level < MAX_LEVEL) {
    const required = xpRequiredFor(level);
    if (required == null || experience < required) break;
    experience -= required;
    level += 1;
  }

  const levelPoints = calcLevelPoints({ ...character, level });
  if (level === character.level && experience === character.experience && levelPoints === character.levelPoints) {
    return character;
  }

  return { ...character, level, experience, levelPoints };
}
