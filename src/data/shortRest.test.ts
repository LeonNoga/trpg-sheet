import { describe, expect, it } from 'vitest';
import { shortRest, shortRestGains } from './abilityUse';
import { createBlankCharacter } from './defaults';
import { computeDerivedStats } from './formulas';

const base = createBlankCharacter('magic');

describe('короткий отдых', () => {
  it('за каждые полные 10 минут — модификатор Выносливости и Ресурса (минимум 1)', () => {
    const c = {
      ...base,
      baseStats: { ...base.baseStats, endurance: 30, resource: 20 }, // моды +4 и +2
      pools: { hp: 5, staminaPoints: 0, resourcePoints: 0 },
    };
    const gains = shortRestGains(c, 35); // три полные десятиминутки, 5 минут не считаются
    expect(gains).toMatchObject({ periods: 3, staminaPerPeriod: 4, resourcePerPeriod: 2, stamina: 12, resource: 6 });
    expect(shortRest(c, 35).pools).toEqual({ hp: 5, staminaPoints: 12, resourcePoints: 6 });
  });

  it('меньше 10 минут — ничего не восстанавливается', () => {
    const c = { ...base, pools: { hp: 5, staminaPoints: 0, resourcePoints: 0 } };
    expect(shortRestGains(c, 9).periods).toBe(0);
    expect(shortRest(c, 9).pools).toEqual(c.pools);
    expect(shortRestGains(c, Number.NaN).periods).toBe(0);
  });

  it('при модификаторе ≤ 0 даёт +1 за период', () => {
    const weak = { ...base, pools: { hp: 5, staminaPoints: 0, resourcePoints: 0 } }; // базовые 5 → мод −1
    expect(shortRestGains(weak, 20)).toMatchObject({ staminaPerPeriod: 1, resourcePerPeriod: 1, stamina: 2, resource: 2 });
  });

  it('не поднимает пулы выше максимума', () => {
    const max = computeDerivedStats(base);
    const nearFull = {
      ...base,
      pools: { hp: 5, staminaPoints: max.staminaPoints - 1, resourcePoints: max.resourcePoints },
    };
    expect(shortRestGains(nearFull, 600)).toMatchObject({ stamina: 1, resource: 0 });
  });
});
