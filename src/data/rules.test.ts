import { describe, expect, it } from 'vitest';
import {
  abilitySlotLimit,
  classBonusLines,
  levelPointsRate,
  milestoneEffects,
  SKILL_CATEGORIES,
  SKILLS,
  statMilestone,
} from './statsConfig';
import { applyExperience, calcLevelPoints, maxBaseStat, nextLevelPoints, statPointsBudget, statPointsRoom, xpRequiredFor } from './progression';
import { computeDerivedStats, modifier, bonusSources, derivedBreakdown } from './formulas';
import { createBlankCharacter, normalizeCharacter } from './defaults';
import { CURRENT_SCHEMA_VERSION } from './migrations';
import { detectSlotType } from '../utils/slotDetect';
import { reinsertRemoved } from '../utils/undoHelpers';
import type { Character, EquipItem } from '../types';

const item = (patch: Partial<EquipItem>): EquipItem => ({
  id: crypto.randomUUID(),
  kind: 'item',
  name: 'Предмет',
  statBonuses: {},
  equipped: true,
  ...patch,
});

describe('опыт и уровни', () => {
  it('формула XP(N) = 4N·(N+24), округление до 10', () => {
    expect(xpRequiredFor(1)).toBe(100);
    expect(xpRequiredFor(2)).toBe(210);
    expect(xpRequiredFor(26)).toBe(5200);
    expect(xpRequiredFor(34)).toBe(7890);
    expect(xpRequiredFor(49)).toBe(14310);
    expect(xpRequiredFor(50)).toBe(14800);
  });

  it('на максимальном уровне опыт больше не нужен', () => {
    expect(xpRequiredFor(100)).toBeNull();
  });

  it('ставки редкости класса', () => {
    expect(levelPointsRate(undefined)).toBe(2);
    expect(levelPointsRate('rare')).toBe(5);
    expect(levelPointsRate('unique')).toBe(15);
    expect(levelPointsRate('unique', 20)).toBe(20);
  });

  it('до 10 уровня очки всегда +2, даже если у карточки уже выбрана редкость', () => {
    const base = createBlankCharacter('genetic');
    const rare: Character = { ...base, classRarity: 'rare', experience: 100 };
    const leveled = applyExperience(rare);
    expect(leveled.level).toBe(2);
    expect(leveled.levelPoints).toBe(2);
    expect(statPointsBudget(leveled)).toBe(102);
  });

  it('бонус редкости считается только за уровни выше уровня получения класса', () => {
    const base = createBlankCharacter('genetic');
    // Класс выбран на 10-м, сейчас 15-й: 9 уровней по +2 и 5 уровней по +10
    expect(calcLevelPoints({ ...base, level: 15, classRarity: 'epic', classLevel: 10 })).toBe(18 + 50);
    // Класс получен позже, на 12-м: 11 уровней по +2 и 3 уровня по +10
    expect(calcLevelPoints({ ...base, level: 15, classRarity: 'epic', classLevel: 12 })).toBe(22 + 30);
    // Без класса — всегда +2
    expect(calcLevelPoints({ ...base, level: 15 })).toBe(28);
    // Выбор эпика на 1-м уровне и ручная смена на 15-й не даёт +10 за все уровни
    expect(calcLevelPoints({ ...base, level: 15, classRarity: 'epic', classLevel: 1 })).toBe(68);
    // Старые карточки с классом без указанного уровня получения: временно считается с 10-го
    expect(calcLevelPoints({ ...base, level: 13, classRarity: 'rare' })).toBe(18 + 15);
    // Уникальный класс — ставка, названная Мастером
    expect(calcLevelPoints({ ...base, level: 12, classRarity: 'unique', classLevel: 10, uniqueLevelPoints: 9 })).toBe(18 + 18);
  });

  it('очки за следующий уровень: +2 до класса, ставка редкости с 10-го уровня', () => {
    const base = createBlankCharacter('genetic');
    expect(nextLevelPoints({ ...base, level: 5, classRarity: 'epic', classLevel: 10 })).toBe(2);
    expect(nextLevelPoints({ ...base, level: 10, classRarity: 'epic', classLevel: 10 })).toBe(10);
    expect(nextLevelPoints({ ...base, level: 10 })).toBe(2);
  });

  it('набор опыта пересчитывает очки по формуле при переходе через уровень получения класса', () => {
    const base = createBlankCharacter('genetic');
    const c: Character = { ...base, level: 10, classRarity: 'legendary', classLevel: 10, levelPoints: 18, experience: 1360 };
    const leveled = applyExperience(c); // 10 → 11 стоит 1360 опыта
    expect(leveled.level).toBe(11);
    expect(leveled.levelPoints).toBe(18 + 15);
  });

  it('жёсткий лимит очков характеристик: потолок = текущее значение + остаток бюджета', () => {
    const base = createBlankCharacter('genetic'); // 10 характеристик по 5 = 50, бюджет 100
    expect(statPointsRoom(base)).toBe(50);
    expect(maxBaseStat(base, 'strength')).toBe(55);
    const full: Character = { ...base, baseStats: { ...base.baseStats, strength: 55 } };
    expect(statPointsRoom(full)).toBe(0);
    expect(maxBaseStat(full, 'strength')).toBe(55);
    expect(maxBaseStat(full, 'agility')).toBe(5);
    // Награда мастера расширяет лимит, перебор (старые данные) — повышать нельзя, понижать можно
    expect(maxBaseStat({ ...full, bonusStatPoints: 3 }, 'agility')).toBe(8);
    const over: Character = { ...full, baseStats: { ...full.baseStats, strength: 60 } };
    expect(statPointsRoom(over)).toBe(-5);
    expect(maxBaseStat(over, 'strength')).toBe(60);
  });
});

describe('характеристики и показатели', () => {
  it('модификатор: floor((значение − 10) / 5)', () => {
    expect(modifier(10)).toBe(0);
    expect(modifier(14)).toBe(0);
    expect(modifier(15)).toBe(1);
    expect(modifier(5)).toBe(-1);
    expect(modifier(50)).toBe(8);
  });

  it('предметы дают бонусы характеристикам и показателям, включая штрафы; снятые не считаются', () => {
    const base = createBlankCharacter('genetic');
    const c: Character = {
      ...base,
      baseStats: { ...base.baseStats, fortitude: 25 },
      items: [
        item({ statBonuses: { fortitude: 5, defense: 6, initiative: -2 } }),
        item({ statBonuses: { defense: 100 }, equipped: false }),
      ],
    };
    const derived = computeDerivedStats(c);
    // 18 + мод(30)=4 + 6
    expect(derived.defense).toBe(28);
    expect(bonusSources(c, 'defense')).toHaveLength(1);
    expect(derivedBreakdown(c, 'defense').total).toBe(derived.defense);
    expect(derivedBreakdown(c, 'initiative').items.map((i) => i.value)).toEqual([-2]);
  });

  it('разложение каждого показателя совпадает с расчётом', () => {
    const base = createBlankCharacter('magic');
    const c: Character = { ...base, level: 7, items: [item({ statBonuses: { hp: 3, speed: 1, resistance: 2 } })] };
    const derived = computeDerivedStats(c);
    for (const key of Object.keys(derived) as (keyof typeof derived)[]) {
      expect(derivedBreakdown(c, key).total).toBe(derived[key]);
    }
  });
});

describe('пороги 50 и 100', () => {
  it('подсветка и бонусы', () => {
    expect(statMilestone(49)).toBeNull();
    expect(statMilestone(50)).toBe(50);
    expect(statMilestone(100)).toBe(100);
    expect(milestoneEffects('strength', 49, 'magic')).toHaveLength(0);
    expect(milestoneEffects('strength', 50, 'magic').map((e) => e.title)).toEqual(['Сокрушительная мощь']);
    expect(milestoneEffects('strength', 120, 'magic').map((e) => e.title)).toEqual(['Сокрушительная мощь', 'Кулак колосса']);
    // У Мудрости и Харизмы бонусов нет
    expect(milestoneEffects('wisdom', 120, 'magic')).toHaveLength(0);
  });

  it('текст Интеллекта подставляет Ресурс Пути по пути', () => {
    expect(milestoneEffects('intellect', 50, 'genetic')[0].text).toContain('Биоэнергия');
    expect(milestoneEffects('intellect', 50, 'tech')[0].text).toContain('Энергия');
    expect(milestoneEffects('intellect', 50, 'magic')[0].text).toContain('Дух');
  });
});

describe('слоты умений и навыки', () => {
  it('слоты открываются на 25, 50 и 100 уровнях', () => {
    expect([1, 24, 25, 49, 50, 99, 100].map(abilitySlotLimit)).toEqual([3, 3, 4, 4, 5, 5, 6]);
  });

  it('все навыки разложены по группам ровно по одному разу', () => {
    const grouped = SKILL_CATEGORIES.flatMap((c) => c.skills);
    expect(grouped).toHaveLength(SKILLS.length);
    expect(new Set(grouped).size).toBe(SKILLS.length);
    expect(SKILLS.filter((s) => !grouped.includes(s))).toEqual([]);
  });

  it('строки бонусов класса показывают очки за уровень', () => {
    expect(classBonusLines('rare')[0]).toContain('+5 за уровень');
    expect(classBonusLines('rare', undefined, 12)[0]).toContain('до 12-го');
    expect(classBonusLines(undefined)[0]).toContain('Класс выбирается на 10 уровне');
    expect(classBonusLines('unique', 12)[0]).toContain('+12 за уровень');
  });
});

describe('определение слота по названию', () => {
  it.each([
    ['Кольцо силы', 'rings'],
    ['Плазменный купол-щит', 'shield'],
    ['Защитная куртка', 'armor'],
    ['Короткий меч', 'weapon'],
    ['Двуручный топор', 'twohanded'],
    ['Амулет первоистока', 'amulets'],
  ])('«%s» → %s', (name, slot) => {
    expect(detectSlotType(name)).toBe(slot);
  });

  it('«защита» не принимается за щит', () => {
    expect(detectSlotType('Знак защиты')).not.toBe('shield');
  });
});

describe('миграции данных', () => {
  it('старая карточка без версии схемы и с числовым бюджетом приводится к текущей', () => {
    const legacy = {
      id: 'old',
      roster: 'personal',
      playerName: '',
      characterName: 'Старый',
      species: '',
      path: 'genetic',
      level: 3,
      experience: 0,
      statPointsBudget: 110,
      keyStat: 'strength',
      baseStats: { vitality: 10, fortitude: 10, agility: 10, perception: 10, intellect: 10, strength: 10, endurance: 10, wisdom: 10, charisma: 10, resource: 10 },
      skills: {},
      items: [],
      abilities: [],
      createdAt: 0,
      updatedAt: 0,
    } as unknown as Character;

    const c = normalizeCharacter(legacy);
    expect(c.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(c.levelPoints).toBe(4); // 2 за каждый из двух новых уровней
    expect(c.bonusStatPoints).toBe(110 - (100 + 4)); // всё, что сверх положенного, → награда мастера
    expect(c.resistanceSource).toBe('strength');
    expect(c.dnaLists).toHaveLength(3);
    expect(c.pools.hp).toBe(10 + 3);
    expect((c as unknown as Record<string, unknown>).statPointsBudget).toBeUndefined();
  });

  it('нормализация идемпотентна и чистит удалённые предметы из слотов', () => {
    const base = createBlankCharacter('tech');
    const withGhost: Character = { ...base, equippedSlots: { armor: ['ghost'] } };
    const once = normalizeCharacter(withGhost);
    expect(once.equippedSlots.armor).toEqual([]);
    expect(normalizeCharacter(once)).toEqual(once);
  });
});

describe('отмена удаления', () => {
  it('удалённые записи возвращаются на свои места, не затирая правки за это время', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };
    const d = { id: 'd' };
    // было [a, b, c], удалили a и c, потом добавили d
    const current = [b, d];
    const restored = reinsertRemoved(current, [
      { item: a, index: 0 },
      { item: c, index: 2 },
    ]);
    expect(restored.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('уже вернувшаяся запись не дублируется', () => {
    const a = { id: 'a' };
    expect(reinsertRemoved([a], [{ item: a, index: 0 }])).toHaveLength(1);
  });
});

describe('миграция очков за уровни (схема 1 → 2)', () => {
  it('карточка с классом и без уровня получения пересчитывается с 10-го уровня', () => {
    const base = createBlankCharacter('genetic');
    const old = { ...base, schemaVersion: 1, level: 13, classRarity: 'rare', levelPoints: 999 } as Character;
    const migrated = normalizeCharacter(old);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.levelPoints).toBe(18 + 15);
    expect(migrated.classLevel).toBeUndefined(); // игрок должен подтвердить или указать точный уровень
  });
});
