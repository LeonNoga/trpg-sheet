import { computeDerivedStats } from './formulas';
import { activeEffects, gameClock } from './effects';
import type { ActiveEffect, Character } from '../types';

/** Постоянные бонусы-напоминания переживают сброс таймера, новый день и отдых. */
export const keepPermanent = (effects: ActiveEffect[] = []): ActiveEffect[] => effects.filter((e) => e.until === 'permanent');

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
 * «Сбросить таймер»: новый цикл отсчёта. Таймер становится 0:00, все эффекты снимаются (кроме постоянных бонусов), а откаты способностей идут дальше —
 * у них сохраняется прежнее оставшееся время (отметки времени сдвигаются на текущее значение часов).
 */
export function resetTimer(character: Character): Character {
  const shift = gameClock(character);
  const usage = Object.fromEntries(
    Object.entries(character.usage ?? {}).map(([key, u]) => [key, u.readyAt !== undefined ? { ...u, readyAt: u.readyAt - shift } : u]),
  );
  return clampPools({ ...character, clock: 0, effects: keepPermanent(character.effects), usage });
}

/**
 * Двигает игровые часы: убирает истёкшие эффекты и откаты. С endCombat (конец боя, любой отдых) заканчиваются эффекты
 * «до конца боя» и откаты «раз в бой». После окончания эффектов пулы подрезаются до нового максимума. Таймер не сбрасывается.
 */
export function advanceClock(
  character: Character,
  seconds: number,
  options: { endCombat?: boolean; endRest?: boolean } = {},
): Character {
  const clock = gameClock(character) + Math.max(0, seconds);
  const before = character.effects ?? [];
  const stepped: Character = { ...character, clock };
  const effects = activeEffects(stepped).filter(
    (e) => !(options.endCombat && e.until === 'combat') && !(options.endRest && e.until === 'rest'),
  );

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

/** «Конец боя»: заканчиваются эффекты «до конца боя» и откаты «раз в бой». Таймер не сбрасывается, остальные эффекты идут дальше. */
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

/**
 * Рост уровня или характеристики двигает вместе с максимумом и текущие значения здоровья, выносливости и ресурса:
 * на сколько вырос (или упал) максимум из-за уровня и базовых характеристик, на столько же меняется текущее.
 * Снаряжение и временные эффекты в расчёте остаются прежними — они текущее значение не двигают.
 * Меняется текущее зеркально и при понижении: поэтому, пока число в поле характеристики вводится по цифрам
 * («3» → «36»), промежуточные значения друг друга гасят и итог равен разнице начального и конечного.
 */
export function followMaxChange(prev: Character, next: Character): Character {
  if (prev.level === next.level && prev.baseStats === next.baseStats) return next;
  const before = computeDerivedStats(prev);
  const after = computeDerivedStats({ ...prev, level: next.level, baseStats: next.baseStats });
  const dHp = after.hp - before.hp;
  const dStamina = after.staminaPoints - before.staminaPoints;
  const dResource = after.resourcePoints - before.resourcePoints;
  if (!dHp && !dStamina && !dResource) return next;
  return {
    ...next,
    pools: {
      hp: next.pools.hp + dHp,
      staminaPoints: next.pools.staminaPoints + dStamina,
      resourcePoints: next.pools.resourcePoints + dResource,
    },
  };
}
