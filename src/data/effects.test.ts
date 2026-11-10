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
import { advanceClock, clampPools, endCombat, removeEffect } from './gameClock';
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
    expect(c.clock).toBe(86400);
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
