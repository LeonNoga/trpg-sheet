import { computeDerivedStats } from './formulas';
import { activeEffects, gameClock } from './effects';
import type { ActiveEffect, Character } from '../types';

/** Текущие значения здоровья, выносливости и ресурса не могут быть выше расчётного максимума (пониженного после окончания эффекта). */
export function clampPools(character: Character): Character {
  const max = computeDerivedStats(character);
  const pools = {
    hp: Math.min(character.pools.hp, max.hp),
    staminaPoints: Math.min(character.pools.staminaPoints, max.staminaPoints),
    resourcePoints: Math.min(character.pools.resourcePoints, max.resourcePoints),
  };
  const same =
    pools.hp === character.pools.hp &&
    pools.staminaPoints === character.pools.staminaPoints &&
    pools.resourcePoints === character.pools.resourcePoints;
  return same ? character : { ...character, pools };
}

/**
 * Двигает игровые часы: убирает истёкшие эффекты и откаты. Эффекты «до конца боя» и откаты «раз в бой» заканчиваются,
 * если время прошло в отдыхе (endCombat). После окончания эффектов пулы подрезаются до нового максимума.
 */
export function advanceClock(character: Character, seconds: number, options: { endCombat?: boolean } = {}): Character {
  const clock = gameClock(character) + Math.max(0, seconds);
  const before = character.effects ?? [];
  const stepped: Character = { ...character, clock };
  const effects = activeEffects(stepped).filter((e) => !(options.endCombat && e.until === 'combat'));

  const usage = { ...(character.usage ?? {}) };
  for (const [key, entry] of Object.entries(usage)) {
    const next = { ...entry };
    if (next.readyAt !== undefined && next.readyAt <= clock) delete next.readyAt;
    if (options.endCombat) delete next.combat;
    if (!next.cooldown && !next.daily && !next.combat && next.readyAt === undefined) delete usage[key];
    else usage[key] = next;
  }

  const moved: Character = { ...stepped, effects, usage };
  return effects.length !== before.length ? clampPools(moved) : moved;
}

/** «Конец боя»: заканчиваются эффекты «до конца боя» и откаты «раз в бой»; время не идёт. */
export function endCombat(character: Character): Character {
  return advanceClock(character, 0, { endCombat: true });
}

/** Добавляет эффект; эффект того же умения заменяется (повторное применение обновляет, а не складывает). */
export function addEffect(character: Character, effect: ActiveEffect): Character {
  const others = (character.effects ?? []).filter((e) => !effect.sourceId || e.sourceId !== effect.sourceId);
  return { ...character, effects: [...others, effect] };
}

/** Снимает эффект досрочно; пулы подрезаются до нового максимума. */
export function removeEffect(character: Character, id: string): Character {
  return clampPools({ ...character, effects: (character.effects ?? []).filter((e) => e.id !== id) });
}
