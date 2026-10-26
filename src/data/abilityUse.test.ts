import { describe, expect, it } from 'vitest';
import {
  applyUse,
  checkShortage,
  clearUsage,
  hasCooldown,
  isDailyLimited,
  longRest,
  parseActivationCost,
  reduceResourceCost,
  startNewDay,
} from './abilityUse';
import { createBlankCharacter } from './defaults';
import { computeDerivedStats } from './formulas';
import type { Character } from '../types';

const character = (patch: Partial<Character> = {}): Character => ({ ...createBlankCharacter('magic'), ...patch });

describe('стоимость способностей', () => {
  it('разбирает «Потребляет N единиц …» для ресурса и выносливости', () => {
    expect(parseActivationCost('Потребляет 10 единиц Духа и 5 единиц Выносливости.')).toEqual({ resource: 10, stamina: 5 });
    expect(parseActivationCost('Потребляет 10 единиц Энергии.')).toEqual({ resource: 10, stamina: 0 });
    expect(parseActivationCost('часть атаки, 1 Выносливости')).toEqual({ resource: 0, stamina: 1 });
    expect(parseActivationCost('Не требует затрат.')).toEqual({ resource: 0, stamina: 0 });
    expect(parseActivationCost(undefined)).toEqual({ resource: 0, stamina: 0 });
  });

  it('скидка Интеллекта: 25% на 50+ (вверх), 50% на 100+ (вниз), минимум 1', () => {
    const base = character();
    const withInt = (intellect: number) => ({ ...base, baseStats: { ...base.baseStats, intellect } });
    expect(reduceResourceCost(withInt(49), 10).value).toBe(10);
    expect(reduceResourceCost(withInt(50), 10).value).toBe(8); // 7.5 → 8
    expect(reduceResourceCost(withInt(100), 10).value).toBe(5);
    expect(reduceResourceCost(withInt(100), 5).value).toBe(2); // 2.5 → 2
    expect(reduceResourceCost(withInt(100), 1).value).toBe(1);
    expect(reduceResourceCost(withInt(100), 0).value).toBe(0);
  });

  it('дневной лимит и откат определяются по тексту карточки', () => {
    expect(isDailyLimited({ activation: '1 действие, 1 раз за день.' })).toBe(true);
    expect(isDailyLimited({ cooldown: '1 раз в сутки' })).toBe(true);
    expect(isDailyLimited({ activation: 'Потребляет 10 единиц Духа.', cooldown: '5 минут.' })).toBe(false);
    expect(hasCooldown({ cooldown: '5 минут.' })).toBe(true);
    expect(hasCooldown({ cooldown: 'Отсутствует' })).toBe(false);
    expect(hasCooldown({})).toBe(false);
  });
});

describe('применение, день и отдых', () => {
  it('«Применить» списывает пулы и отмечает откат; снятие отметки чистит запись', () => {
    const c = character({ pools: { hp: 5, staminaPoints: 20, resourcePoints: 12 } });
    const used = applyUse(c, 'a1', { resource: 8, stamina: 5 }, { cooldown: true });
    expect(used.pools).toEqual({ hp: 5, staminaPoints: 15, resourcePoints: 4 });
    expect(used.usage).toEqual({ a1: { cooldown: true } });
    expect(clearUsage(used, 'a1', 'cooldown').usage).toEqual({});
  });

  it('предупреждает о нехватке', () => {
    const c = character({ pools: { hp: 5, staminaPoints: 2, resourcePoints: 12 } });
    expect(checkShortage(c, { resource: 8, stamina: 5 })).toHaveLength(1);
    expect(checkShortage(c, { resource: 20, stamina: 5 })).toHaveLength(2);
    expect(checkShortage(c, { resource: 1, stamina: 1 })).toEqual([]);
  });

  it('новый день снимает отметки, но не трогает пулы', () => {
    const c = applyUse(character({ pools: { hp: 5, staminaPoints: 20, resourcePoints: 12 } }), 'a1', { resource: 0, stamina: 0 }, { daily: true });
    const next = startNewDay(c);
    expect(next.usage).toEqual({});
    expect(next.pools).toEqual(c.pools);
  });

  it('длительный отдых восстанавливает пулы до максимума и снимает отметки', () => {
    const c = applyUse(character({ pools: { hp: 1, staminaPoints: 0, resourcePoints: 0 } }), 'a1', { resource: 0, stamina: 0 }, { daily: true });
    const rested = longRest(c);
    const max = computeDerivedStats(c);
    expect(rested.pools).toEqual({ hp: max.hp, staminaPoints: max.staminaPoints, resourcePoints: max.resourcePoints });
    expect(rested.usage).toEqual({});
  });
});
