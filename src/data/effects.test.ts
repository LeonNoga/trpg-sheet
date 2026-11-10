import { describe, expect, it } from 'vitest';
import {
  activeEffects,
  buildEffect,
  effectBonus,
  formatClock,
  formatRemaining,
  parseCooldown,
  parseDuration,
  parseSpan,
  suggestActiveBonuses,
} from './effects';
import { advanceClock, clampPools, endCombat, followMaxChange, removeEffect, resetTimer } from './gameClock';
import { applyAbilityUse, isCooling, longRest, shortRest, spendCombatStamina, startNewDay } from './abilityUse';
import { bonusSources, computeDerivedStats, totalStat } from './formulas';
import { createBlankCharacter } from './defaults';
import type { Character, EquipItem } from '../types';

const make = (patch: Partial<Character> = {}): Character => {
  const base = createBlankCharacter('genetic');
  return { ...base, baseStats: { ...base.baseStats, strength: 20, endurance: 30, resource: 30, vitality: 30 }, ...patch };
};
const ability = (patch: Partial<EquipItem> = {}): EquipItem => ({
  id: 'rush',
  kind: 'ability',
  name: 'Рывок',
  equipped: false,
  statBonuses: {},
  activation: 'Потребляет 5 единиц Выносливости.',
  cooldown: '10 минут.',
  duration: '30 секунд.',
  activeBonuses: { strength: 20 },
  ...patch,
});
const cost = { resource: 0, stamina: 5 };

describe('длительности и откаты из текста карточки', () => {
  it.each([
    ['30 секунд', 30],
    ['1 минуту', 60],
    ['5 минут (или до первой атаки)', 300],
    ['2 раунда', 30],
    ['3 ч', 10800],
    ['На минуту', 60],
  ])('«%s» → %s с', (text, seconds) => {
    expect(parseSpan(text)).toBe(seconds);
  });

  it('длительность: время, до конца боя, мгновенно; условие помечается', () => {
    expect(parseDuration('30 секунд.')).toEqual({ kind: 'seconds', seconds: 30, conditional: false });
    expect(parseDuration('До 1 минуты (или до извлечения паразита). Дальность 30 м')).toEqual({ kind: 'seconds', seconds: 60, conditional: true });
    expect(parseDuration('Мгновенно (эффекты длятся до конца боя).')).toEqual({ kind: 'combat' });
    expect(parseDuration('Мгновенно.')).toEqual({ kind: 'instant' });
    expect(parseDuration('')).toEqual({ kind: 'none' });
    expect(parseDuration('До следующего длительного отдыха')).toEqual({ kind: 'rest' });
  });

  it('откат: секунды, раз в день, до конца боя, неизвестный', () => {
    expect(parseCooldown('10 минут.')).toEqual({ kind: 'seconds', seconds: 600 });
    expect(parseCooldown('1 раз в день')).toEqual({ kind: 'daily' });
    expect(parseCooldown('1 раз за бой')).toEqual({ kind: 'combat' });
    expect(parseCooldown('Отсутствует')).toEqual({ kind: 'none' });
    expect(parseCooldown('когда луна полная')).toEqual({ kind: 'unknown' });
  });

  it('подсказка бонусов из описания: плюсы, штрафы, показатели', () => {
    expect(suggestActiveBonuses('Даёт +20 к Силе на 30 секунд.')).toEqual({ strength: 20 });
    expect(suggestActiveBonuses('+2 к показателю защиты, −3 к Скорости')).toEqual({ defense: 2, speed: -3 });
    expect(suggestActiveBonuses('+10 пунктов здоровья и +5 к пассивному восприятию')).toEqual({ hp: 10, passivePerception: 5 });
    expect(suggestActiveBonuses('Ничего особенного')).toEqual({});
  });
});

describe('временный эффект от умения', () => {
  it('применение: стоимость, откат с момента применения и эффект с бонусом', () => {
    const c = applyAbilityUse(make({ pools: { hp: 10, staminaPoints: 30, resourcePoints: 5 } }), ability(), cost);
    expect(c.pools.staminaPoints).toBe(25);
    expect(c.usage!.rush.readyAt).toBe(600);
    expect(c.effects).toHaveLength(1);
    expect(c.effects![0]).toMatchObject({ name: 'Рывок', until: 'time', endsAt: 30, sourceId: 'rush' });
    expect(totalStat(c, 'strength')).toBe(40);
    expect(bonusSources(c, 'strength')).toEqual([{ name: 'Рывок (эффект)', value: 20 }]);
  });

  it('бонус пропадает сам, когда проходит время (тик боя = 15 секунд)', () => {
    let c = applyAbilityUse(make(), ability(), cost);
    c = spendCombatStamina(c);
    expect(totalStat(c, 'strength')).toBe(40); // 15 с из 30
    c = spendCombatStamina(c);
    expect(c.clock).toBe(30);
    expect(totalStat(c, 'strength')).toBe(20);
    expect(c.effects).toEqual([]);
  });

  it('повторное применение обновляет эффект, а не складывает бонус', () => {
    let c = applyAbilityUse(make(), ability(), cost);
    c = advanceClock(c, 20);
    c = applyAbilityUse(c, ability(), cost);
    expect(c.effects).toHaveLength(1);
    expect(effectBonus(c, 'strength')).toBe(20);
    expect(c.effects![0].endsAt).toBe(50);
  });

  it('отрицательные эффекты уменьшают показатель', () => {
    const c = applyAbilityUse(make(), ability({ id: 'curse', name: 'Проклятье', duration: '1 минуту', activeBonuses: { defense: -2 } }), cost);
    const base = computeDerivedStats(make()).defense;
    expect(computeDerivedStats(c).defense).toBe(base - 2);
  });

  it('мгновенное умение без бонусов эффекта не создаёт; с «до конца боя» — создаёт без срока', () => {
    const instant = applyAbilityUse(make(), ability({ duration: 'Мгновенно.', activeBonuses: undefined }), cost);
    expect(instant.effects ?? []).toEqual([]);
    const combat = buildEffect(ability({ duration: 'Мгновенно (эффекты длятся до конца боя).' }), 0, 'e1')!;
    expect(combat.until).toBe('combat');
    expect(combat.endsAt).toBeUndefined();
  });

  it('бонус без понятной длительности действует до ручного снятия', () => {
    const e = buildEffect(ability({ duration: undefined }), 0, 'e1')!;
    expect(e.until).toBe('manual');
    const c = advanceClock({ ...make(), effects: [e] }, 100000);
    expect(activeEffects(c)).toHaveLength(1);
  });
});

describe('откаты на игровых часах', () => {
  it('короткий отдых 15 минут снимает откат 10 минут; 5 минут — нет', () => {
    const c = applyAbilityUse(make(), ability({ activeBonuses: undefined }), cost);
    expect(isCooling(c.usage!.rush, c.clock ?? 0)).toBe(true);
    const short = shortRest(c, 5);
    expect(isCooling(short.usage?.rush, short.clock ?? 0)).toBe(true);
    const long = shortRest(c, 15);
    expect(isCooling(long.usage?.rush, long.clock ?? 0)).toBe(false);
    expect(long.usage?.rush).toBeUndefined();
  });

  it('откат «раз в бой» снимается кнопкой «Конец боя»', () => {
    const c = applyAbilityUse(make(), ability({ cooldown: '1 раз за бой', activeBonuses: undefined }), cost);
    expect(c.usage!.rush.combat).toBe(true);
    expect(endCombat(c).usage?.rush).toBeUndefined();
  });

  it('эффект «до конца боя» заканчивается кнопкой и отдыхом', () => {
    const c = applyAbilityUse(make(), ability({ duration: 'до конца боя' }), cost);
    expect(endCombat(c).effects).toEqual([]);
    expect(shortRest(c, 10).effects).toEqual([]);
  });
});

describe('отдых, новый день и пулы', () => {
  it('длительный отдых — 24 часа: эффекты кончаются, пулы до нового максимума, откаты сняты', () => {
    let c = applyAbilityUse(make({ pools: { hp: 5, staminaPoints: 1, resourcePoints: 1 } }), ability(), cost);
    c = longRest(c);
    expect(c.clock).toBe(86400); // отдых добавляет время, таймер не сбрасывается
    expect(c.effects).toEqual([]);
    expect(c.usage).toEqual({});
    expect(c.pools.staminaPoints).toBe(computeDerivedStats(c).staminaPoints);
  });

  it('новый день: 24 часа, все эффекты (в том числе ручные) заканчиваются, пулы не меняются', () => {
    const manual = buildEffect(ability({ duration: undefined }), 0, 'm')!;
    let c = make({ pools: { hp: 5, staminaPoints: 3, resourcePoints: 2 } });
    c = { ...c, effects: [manual] };
    const next = startNewDay(c);
    expect(next.effects).toEqual([]);
    expect(next.clock).toBe(86400);
    expect(next.pools).toEqual({ hp: 5, staminaPoints: 3, resourcePoints: 2 });
  });

  it('когда эффект с бонусом к максимуму кончается, текущее значение срезается до максимума', () => {
    const c0 = make();
    const buff = applyAbilityUse(
      c0,
      ability({ id: 'vit', name: 'Бодрость', activeBonuses: { staminaPoints: 10 }, duration: '15 секунд' }),
      { resource: 0, stamina: 0 },
    );
    const max = computeDerivedStats(buff).staminaPoints;
    const full = { ...buff, pools: { ...buff.pools, staminaPoints: max } };
    const after = advanceClock(full, 15);
    expect(after.pools.staminaPoints).toBe(max - 10);
  });

  it('досрочное снятие эффекта тоже подрезает пулы, а меньшие значения не поднимаются', () => {
    const buff = applyAbilityUse(make(), ability({ activeBonuses: { hp: 10 } }), { resource: 0, stamina: 0 });
    const max = computeDerivedStats(buff).hp;
    const topped = { ...buff, pools: { ...buff.pools, hp: max } };
    const removed = removeEffect(topped, buff.effects![0].id);
    expect(removed.pools.hp).toBe(max - 10);
    const low = { ...make(), pools: { hp: 1, staminaPoints: 1, resourcePoints: 1 } };
    expect(clampPools(low)).toBe(low);
  });
});

describe('вывод времени', () => {
  it('часы и остаток', () => {
    expect(formatClock(45)).toBe('0:45');
    expect(formatClock(3750)).toBe('1:02:30');
    expect(formatClock(90000)).toBe('1д 1:00:00');
    expect(formatRemaining(45)).toBe('45 с');
    expect(formatRemaining(150)).toBe('2 мин 30 с');
    expect(formatRemaining(3900)).toBe('1 ч 05 мин');
  });
});

describe('рост максимума двигает и текущие значения', () => {
  const full = (c: Character): Character => {
    const max = computeDerivedStats(c);
    return { ...c, pools: { hp: max.hp, staminaPoints: max.staminaPoints, resourcePoints: max.resourcePoints } };
  };

  it('повышение выносливости поднимает и максимум, и текущую выносливость на одну величину', () => {
    const before = full(make());
    const next = { ...before, baseStats: { ...before.baseStats, endurance: before.baseStats.endurance + 10 } };
    const grown = followMaxChange(before, next);
    const grownMax = computeDerivedStats(grown);
    expect(grownMax.staminaPoints).toBeGreaterThan(computeDerivedStats(before).staminaPoints);
    expect(grown.pools.staminaPoints).toBe(grownMax.staminaPoints);
    expect(grown.pools.hp).toBe(before.pools.hp);
    expect(grown.pools.resourcePoints).toBe(before.pools.resourcePoints);
  });

  it('новый уровень прибавляет здоровье и к текущему; недолеченное здоровье остаётся недолеченным', () => {
    const before = { ...full(make({ level: 5 })), pools: { hp: 10, staminaPoints: 1, resourcePoints: 2 } };
    const grown = followMaxChange(before, { ...before, level: 6 });
    const dHp = computeDerivedStats({ ...before, level: 6 }).hp - computeDerivedStats(before).hp;
    expect(dHp).toBeGreaterThan(0);
    expect(grown.pools.hp).toBe(10 + dHp);
  });

  it('предметы и эффекты текущее значение не двигают', () => {
    const before = full(make());
    const gear = { ...before, items: [{ id: 'a', kind: 'item' as const, name: 'Амулет', equipped: true, statBonuses: { hp: 10 } }] };
    expect(followMaxChange(before, gear)).toBe(gear);
    const buffed = applyAbilityUse(before, ability({ activeBonuses: { staminaPoints: 10 } }), { resource: 0, stamina: 0 });
    expect(followMaxChange(before, buffed)).toBe(buffed);
  });

  it('при вводе числа по цифрам («36» → «3» → «36») итог не накапливается', () => {
    const start = full(make());
    const set = (c: Character, v: number): Character => ({ ...c, baseStats: { ...c.baseStats, endurance: v } });
    const step1 = followMaxChange(start, set(start, 3));
    const step2 = followMaxChange(step1, set(step1, 36));
    const direct = followMaxChange(start, set(start, 36));
    expect(step2.pools.staminaPoints).toBe(direct.pools.staminaPoints);
    expect(step2.pools.staminaPoints).toBe(computeDerivedStats(step2).staminaPoints);
  });

  it('бонусы снаряжения не искажают расчёт роста от характеристики', () => {
    const base = full(make());
    const geared = { ...base, items: [{ id: 'a', kind: 'item' as const, name: 'Амулет', equipped: true, statBonuses: { endurance: 5 } }] };
    const before = full(geared);
    const next = { ...before, baseStats: { ...before.baseStats, endurance: before.baseStats.endurance + 10 } };
    const grown = followMaxChange(before, next);
    expect(grown.pools.staminaPoints).toBe(computeDerivedStats(grown).staminaPoints);
  });
});

describe('конец боя и сброс таймера — разные кнопки', () => {
  it('конец боя заканчивает эффекты и откаты «до конца боя», но таймер и остальное не трогает', () => {
    let c = applyAbilityUse(make(), ability({ id: 'a', name: 'Бег', duration: '5 минут', cooldown: '1 час' }), cost);
    c = applyAbilityUse(c, ability({ id: 'b', name: 'Ярость', duration: 'до конца боя', cooldown: '1 раз за бой', activeBonuses: { defense: 3 } }), cost);
    c = advanceClock(c, 90);
    const after = endCombat(c);
    expect(after.clock).toBe(90);
    expect(after.effects!.map((e) => e.name)).toEqual(['Бег']);
    expect(after.usage!.b).toBeUndefined();
    expect(after.usage!.a.readyAt).toBe(3600);
  });

  it('сброс таймера: 0:00, все эффекты сняты, откаты идут дальше с тем же остатком', () => {
    let c = applyAbilityUse(make(), ability({ duration: '5 минут', cooldown: '1 час', activeBonuses: { strength: 20 } }), cost);
    c = advanceClock(c, 90);
    const after = resetTimer(c);
    expect(after.clock).toBe(0);
    expect(after.effects).toEqual([]);
    expect(totalStat(after, 'strength')).toBe(20);
    expect(after.usage!.rush.readyAt).toBe(3600 - 90);
    expect(isCooling(after.usage!.rush, 0)).toBe(true);
    expect(isCooling(advanceClock(after, 3510).usage?.rush, 3510)).toBe(false);
  });

  it('при сбросе таймера пулы подрезаются до максимума без эффектов', () => {
    const buff = applyAbilityUse(make(), ability({ activeBonuses: { hp: 10 } }), { resource: 0, stamina: 0 });
    const topped = { ...buff, pools: { ...buff.pools, hp: computeDerivedStats(buff).hp } };
    expect(resetTimer(topped).pools.hp).toBe(computeDerivedStats(make()).hp);
  });

  it('отдых добавляет время и не сбрасывает таймер, эффекты и откаты истекают по нему', () => {
    const c = applyAbilityUse(make(), ability({ cooldown: '1 час', activeBonuses: undefined }), cost);
    const rested = shortRest(advanceClock(c, 30), 15);
    expect(rested.clock).toBe(30 + 15 * 60);
    expect(rested.usage!.rush.readyAt).toBe(3600);
  });

  it('тик боя и «+ время» таймер не сбрасывают', () => {
    expect(spendCombatStamina(advanceClock(make(), 45)).clock).toBe(60);
  });
});

describe('постоянные бонусы-напоминания', () => {
  const permanent = {
    id: 'p1',
    name: 'Ночное зрение',
    bonuses: { defense: 2 } as Partial<Record<import('../types').BonusKey, number>>,
    startedAt: 0,
    until: 'permanent' as const,
  };
  const timed = { id: 't1', name: 'Бег', bonuses: { strength: 5 }, startedAt: 0, until: 'manual' as const };
  const withBoth = (): Character => ({ ...make(), effects: [permanent, timed] });

  it('считаются в показателях, как обычные бонусы', () => {
    const base = computeDerivedStats(make()).defense;
    expect(computeDerivedStats(withBoth()).defense).toBe(base + 2);
    expect(bonusSources(withBoth(), 'defense')).toEqual([{ name: 'Ночное зрение (эффект)', value: 2 }]);
  });

  it('сброс таймера снимает остальные эффекты, а постоянные остаются', () => {
    expect(resetTimer(withBoth()).effects!.map((e) => e.name)).toEqual(['Ночное зрение']);
  });

  it('новый день, длительный отдых, конец боя и время их не снимают', () => {
    expect(startNewDay(withBoth()).effects!.map((e) => e.name)).toEqual(['Ночное зрение']);
    expect(longRest(withBoth()).effects!.map((e) => e.name)).toEqual(['Ночное зрение', 'Бег']);
    expect(endCombat(withBoth()).effects).toHaveLength(2);
    expect(advanceClock(withBoth(), 10 ** 7).effects).toHaveLength(2);
  });

  it('эффект «до длительного отдыха» кончается длительным отдыхом и новым днём, но не коротким', () => {
    const rest = buildEffect(ability({ duration: 'до следующего длительного отдыха', activeBonuses: { strength: 3 } }), 0, 'r')!;
    const c: Character = { ...make(), effects: [rest] };
    expect(shortRest(c, 30).effects).toHaveLength(1);
    expect(longRest(c).effects).toEqual([]);
    expect(startNewDay(c).effects).toEqual([]);
  });

  it('напоминание без бонусов тоже допустимо', () => {
    const note = { ...permanent, bonuses: {} };
    const c: Character = { ...make(), effects: [note] };
    expect(computeDerivedStats(c)).toEqual(computeDerivedStats(make()));
    expect(resetTimer(c).effects).toHaveLength(1);
  });
});
