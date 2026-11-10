import { describe, expect, it } from 'vitest';
import { absorbAbility, freeSlotIndex, isAbsorbed, releaseAbility } from './absorb';
import { absorbFromPearl, fillPearl } from './development';
import { computeJumps } from './jumps';
import { createBlankCharacter } from './defaults';
import type { Character } from '../types';

const make = (patch: Partial<Character> = {}): Character => ({ ...createBlankCharacter('genetic'), ...patch });
const withSlots = (c: Character, lists: string[][]): Character => ({
  ...c,
  dnaLists: c.dnaLists.map((l, i) => ({ ...l, slots: lists[i] ?? l.slots })),
});
const empty = ['', '', '', '', ''];

describe('впитывание умений', () => {
  it('умение считается впитанным, если название есть в любом из списков (без учёта регистра и пробелов)', () => {
    const c = withSlots(make(), [empty, [' огненный шар', '', '', '', ''], empty]);
    expect(isAbsorbed(c, { name: 'Огненный шар' })).toBe(true);
    expect(isAbsorbed(c, { name: 'Ледяная стрела' })).toBe(false);
    expect(isAbsorbed(c, { name: '  ' })).toBe(false);
  });

  it('вписывает в первый свободный слот выбранного списка и освобождает все слоты с этим названием', () => {
    const c = withSlots(make(), [['А', '', '', '', ''], empty, empty]);
    const next = absorbAbility(c, { name: 'Б' }, 0)!;
    expect(next.dnaLists[0].slots).toEqual(['А', 'Б', '', '', '']);
    const both = absorbAbility(next, { name: 'Б' }, 2)!;
    expect(both.dnaLists[2].slots[0]).toBe('Б');
    const freed = releaseAbility(both, { name: 'Б' });
    expect(freed.dnaLists[0].slots).toEqual(['А', '', '', '', '']);
    expect(freed.dnaLists[2].slots[0]).toBe('');
  });

  it('обычный список ограничен слотами уровня: на первом уровне открыто 3', () => {
    const c = withSlots(make({ level: 1 }), [empty, ['А', 'Б', 'В', '', ''], empty]);
    expect(freeSlotIndex(c, 1)).toBe(-1);
    expect(absorbAbility(c, { name: 'Г' }, 1)).toBeNull();
    expect(freeSlotIndex({ ...c, level: 25 }, 1)).toBe(3);
  });

  it('свободные списки (видовой и артефактный) растут, когда пять строк заняты', () => {
    const c = withSlots(make(), [['1', '2', '3', '4', '5'], empty, empty]);
    expect(freeSlotIndex(c, 0)).toBe(5);
    expect(absorbAbility(c, { name: '6' }, 0)!.dnaLists[0].slots).toHaveLength(6);
  });

  it('без названия впитать нельзя', () => {
    expect(absorbAbility(make(), { name: ' ' }, 0)).toBeNull();
  });
});

describe('жемчужины развития', () => {
  const base = make({ developmentPoints: 5, pearls: [{ id: 'p', points: 8 }] });

  it('«всосать» переносит очки из жемчужины, не больше чем в ней', () => {
    const r = absorbFromPearl(base, 'p', 3);
    expect([r.developmentPoints, r.pearls![0].points]).toEqual([8, 5]);
    const all = absorbFromPearl(base, 'p', 100);
    expect([all.developmentPoints, all.pearls![0].points]).toEqual([13, 0]);
  });

  it('вложить можно не больше, чем есть в запасе; отрицательные и дробные значения не ломают счёт', () => {
    const r = fillPearl(base, 'p', 100);
    expect([r.developmentPoints, r.pearls![0].points]).toEqual([0, 13]);
    expect(fillPearl(base, 'p', -4)).toEqual(base);
    expect(fillPearl(base, 'p', 2.9).developmentPoints).toBe(3);
    expect(absorbFromPearl(base, 'нет', 3)).toBe(base);
  });
});

describe('прыжки', () => {
  const jumper = (strength: number, athletics: 0 | 5 | 10 | 15) =>
    make({ baseStats: { ...make().baseStats, strength }, skills: { Атлетика: athletics } });
  const byKey = (c: Character) => Object.fromEntries(computeJumps(c).map((j) => [j.key, j.meters]));

  it('считает четыре вида прыжка по формулам (мод. Силы 4, Атлетика +10)', () => {
    // Сила 30 → модификатор (30 − 10) / 5 = 4
    const round2 = (x: number) => Math.round(x * 100) / 100;
    expect(byKey(jumper(30, 10))).toEqual({
      longRun: round2(3 + 4 + 10 / 5),
      longStand: round2(1 + 4 + 10 / 10),
      highRun: round2(0.5 + 4 / 2 + 10 / 10),
      highStand: round2(0.3 + 4 / 3 + 10 / 15),
    });
  });

  it('округляет до сотых и не уходит ниже нуля при отрицательном модификаторе', () => {
    const r = computeJumps(jumper(0, 0)); // мод. Силы отрицательный
    const low = r.find((j) => j.key === 'highStand')!;
    expect(low.meters).toBeGreaterThanOrEqual(0);
    const negative = computeJumps(jumper(0, 0)).find((j) => j.key === 'highRun')!;
    expect(negative.working).toContain('/ 2');
    expect(byKey(jumper(30, 0)).highStand).toBe(1.63); // 0,3 + 4/3
  });

  it('показывает подстановку значений', () => {
    expect(computeJumps(jumper(30, 10))[0].working).toBe('3 + 4 + 10 / 5 = 9');
  });
});
