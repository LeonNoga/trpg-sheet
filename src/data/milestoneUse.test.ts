import { describe, expect, it } from 'vitest';
import { applyMilestoneRestore, computeAbilityCost, isClassAbility } from './abilityUse';
import { createBlankCharacter } from './defaults';
import { computeDerivedStats } from './formulas';
import { milestoneEffects } from './milestones';
import type { Character } from '../types';

const make = (patch: Partial<Character> = {}): Character => {
  const base = createBlankCharacter('genetic');
  return { ...base, baseStats: { ...base.baseStats, endurance: 53, resource: 57, vitality: 30 }, ...patch };
};

describe('автоматические эффекты бонусов порогов', () => {
  it('Адреналин: половина пула выносливости, округление вверх, не выше максимума', () => {
    const c = make({ pools: { hp: 5, staminaPoints: 10, resourcePoints: 5 } });
    const max = computeDerivedStats(c); // выносливость 53
    expect(applyMilestoneRestore(c, 'stamina-half').pools.staminaPoints).toBe(10 + Math.ceil(max.staminaPoints / 2));
    const almost = make({ pools: { hp: 5, staminaPoints: 50, resourcePoints: 5 } });
    expect(applyMilestoneRestore(almost, 'stamina-half').pools.staminaPoints).toBe(max.staminaPoints);
  });

  it('Резонанс и Сверхновая восстанавливают ресурс (Биоэнергию)', () => {
    const c = make({ pools: { hp: 5, staminaPoints: 10, resourcePoints: 5 } });
    expect(applyMilestoneRestore(c, 'resource-half').pools.resourcePoints).toBe(5 + Math.ceil(57 / 2));
    expect(applyMilestoneRestore(c, 'resource-full').pools.resourcePoints).toBe(57);
    expect(applyMilestoneRestore(c, 'resource-full').pools.staminaPoints).toBe(10);
  });

  it('Второе дыхание: выносливость до максимума', () => {
    const c = make({ pools: { hp: 5, staminaPoints: 1, resourcePoints: 5 } });
    expect(applyMilestoneRestore(c, 'stamina-full').pools.staminaPoints).toBe(53);
  });

  it('Ускоренная регенерация: хиты на половину Живучести; Отказ умирать: хиты = модификатор Живучести', () => {
    const c = make({ pools: { hp: 0, staminaPoints: 10, resourcePoints: 5 } });
    expect(applyMilestoneRestore(c, 'hp-half-vitality').pools.hp).toBe(15); // 30 / 2
    expect(applyMilestoneRestore(c, 'last-stand').pools.hp).toBe(4); // (30 − 10) / 5
  });

  it('у активных бонусов порогов заданы эффекты восстановления', () => {
    expect(milestoneEffects('endurance', 50, 'genetic')[0].restore).toBe('stamina-half');
    expect(milestoneEffects('resource', 100, 'genetic').at(-1)?.restore).toBe('resource-full');
    expect(milestoneEffects('strength', 50, 'genetic')[0].restore).toBeUndefined();
  });
});

describe('классовые умения: −50% к стоимости', () => {
  const withClassAbility = (patch: Partial<Character> = {}): Character => {
    const c = make(patch);
    return { ...c, dnaLists: [{ ...c.dnaLists[0], slots: ['Огненный шар', '', '', '', ''] }, c.dnaLists[1], c.dnaLists[2]] };
  };

  it('умение из первого списка считается классовым', () => {
    const c = withClassAbility();
    expect(isClassAbility(c, ' огненный ШАР ')).toBe(true);
    expect(isClassAbility(c, 'Ледяная стрела')).toBe(false);
    expect(isClassAbility(c, '')).toBe(false);
  });

  it('стоимость делится пополам с округлением вниз, минимум 1; обычные умения без скидки', () => {
    const base = createBlankCharacter('magic');
    const plain = { ...base, dnaLists: [{ ...base.dnaLists[0], slots: ['Огненный шар', '', '', '', ''] }, base.dnaLists[1], base.dnaLists[2]] };
    const ability = { name: 'Огненный шар', activation: 'Потребляет 10 единиц Духа и 5 единиц Выносливости.' };
    const result = computeAbilityCost(plain, ability);
    expect(result.base).toEqual({ resource: 10, stamina: 5 });
    expect(result.cost).toEqual({ resource: 5, stamina: 2 });
    expect(result.notes).toContain('классовое умение −50%');
    expect(computeAbilityCost(plain, { ...ability, name: 'Чужое умение' }).cost).toEqual({ resource: 10, stamina: 5 });
    expect(computeAbilityCost(plain, { name: 'Огненный шар', activation: 'Потребляет 1 единицу Духа.' }).cost.resource).toBe(1);
  });

  it('скидка Интеллекта считается от уже сниженной цены', () => {
    const base = createBlankCharacter('magic');
    const c = {
      ...base,
      baseStats: { ...base.baseStats, intellect: 100 }, // −50%
      dnaLists: [{ ...base.dnaLists[0], slots: ['Огненный шар', '', '', '', ''] }, base.dnaLists[1], base.dnaLists[2]],
    };
    // 20 → 10 (класс) → 5 (Интеллект 100)
    expect(computeAbilityCost(c, { name: 'Огненный шар', activation: 'Потребляет 20 единиц Духа.' }).cost.resource).toBe(5);
  });

  it('артефактные умения не получают ни скидку Интеллекта, ни −50% класса', () => {
    const base = createBlankCharacter('magic');
    const c = {
      ...base,
      baseStats: { ...base.baseStats, intellect: 100 },
      dnaLists: [{ ...base.dnaLists[0], slots: ['Посох бури', '', '', '', ''] }, base.dnaLists[1], base.dnaLists[2]],
    };
    const activation = 'Потребляет 20 единиц Духа и 6 единиц Выносливости.';
    expect(computeAbilityCost(c, { name: 'Посох бури', activation, artifact: true }).cost).toEqual({ resource: 20, stamina: 6 });
    // то же умение без флага артефакта — со скидками
    expect(computeAbilityCost(c, { name: 'Посох бури', activation }).cost.resource).toBe(5);
  });
});
