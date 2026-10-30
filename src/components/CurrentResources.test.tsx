import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CurrentResources } from './CurrentResources';
import { createBlankCharacter } from '../data/defaults';
import { applyUse, longRest, shortRest, startNewDay } from '../data/abilityUse';
import type { Character, Path } from '../types';

function make(path: Path = 'tech'): Character {
  const c = createBlankCharacter(path);
  return {
    ...c,
    level: 10,
    baseStats: { ...c.baseStats, vitality: 90, endurance: 30, resource: 30 },
    pools: { hp: 10, staminaPoints: 4, resourcePoints: 4 },
  };
}

function cards(c: Character) {
  const html = renderToStaticMarkup(<CurrentResources character={c} />);
  return [...html.matchAll(/<div class="([^"]+)"[^>]*><dt>([^<]+)<span class="resource-percent">[^<]+<\/span><\/dt><dd>([^<]+)<\/dd><\/div>/g)].map(
    ([, classes, label, value]) => ({ classes: classes.split(' '), label, value: Number(value) }),
  );
}

describe('карточки текущих ресурсов', () => {
  it.each([
    [11, null], [10, null], [9, 'is-low'], [0, 'is-depleted'], [-5, 'is-depleted'],
  ])('HP %s при максимуме 100: состояние %s', (hp, state) => {
    const c = make();
    c.pools.hp = hp;
    const health = cards(c)[0];
    expect(health.value).toBe(hp);
    expect(health.classes.filter((name) => name.startsWith('is-'))).toEqual(state ? [state] : []);
  });

  it('не округляет порог 10% и учитывает бонусы надетого снаряжения', () => {
    const c = make();
    c.items = [{ id: 'hp-bonus', kind: 'item', name: 'Амулет', equipped: true, statBonuses: { hp: 1 } }];
    // Максимум 101: 10 HP уже меньше 10%, несмотря на округление до целого.
    expect(cards(c)[0].classes).toContain('is-low');
    c.items[0].equipped = false;
    expect(cards(c)[0].classes).not.toContain('is-low');
    c.level = 11;
    expect(cards(c)[0].classes).toContain('is-low');
  });

  it.each<[Path, string]>([['tech', 'Энергия'], ['magic', 'Дух'], ['genetic', 'Биоэнергия']])(
    '%s: выводит текущие значения и название %s, не меняя персонажа', (path, label) => {
      const c = make(path);
      const before = structuredClone(c);
      expect(cards(c).map(({ label, value }) => [label, value])).toEqual([
        ['Здоровье', 10], ['Выносливость', 4], [label, 4],
      ]);
      expect(c).toEqual(before);
    },
  );

  it.each([1, 0, -1])('выносливость и ресурс %s: ноль и отрицательные значения истощены', (value) => {
    const c = make();
    c.pools.staminaPoints = value;
    c.pools.resourcePoints = value;
    for (const card of cards(c).slice(1)) {
      expect(card.value).toBe(value);
      expect(card.classes.includes('is-depleted')).toBe(value <= 0);
    }
  });

  it('после применения способности показывает расход и истощение; новый день не восстанавливает пулы', () => {
    const c = applyUse(make(), 'ability', { stamina: 4, resource: 4 }, { daily: true });
    const result = cards(c);
    expect(result.map((card) => card.value)).toEqual([10, 0, 0]);
    expect(result[1].classes).toContain('is-depleted');
    expect(result[2].classes).toContain('is-depleted');
    expect(cards(startNewDay(c))).toEqual(result);
  });

  it('после короткого и длительного отдыха обновляет значения и снимает подсветку', () => {
    const c = make();
    c.pools = { hp: 9, staminaPoints: 0, resourcePoints: 0 };
    const short = cards(shortRest(c, 10));
    expect(short.map((card) => card.value)).toEqual([9, 4, 4]);
    expect(short[0].classes).toContain('is-low');
    expect(short[1].classes).not.toContain('is-depleted');
    expect(short[2].classes).not.toContain('is-depleted');
    const long = cards(longRest(c));
    expect(long.map((card) => card.value)).toEqual([25, 30, 30]);
    expect(long.every((card) => !card.classes.some((name) => name.startsWith('is-')))).toBe(true);
  });
});

it('добавляет только одну нативную кнопку: списание выносливости за бой', () => {
  const onSpend = vi.fn();
  const html = renderToStaticMarkup(<CurrentResources character={make()} onSpendCombatStamina={onSpend} />);
  expect(html.match(/<button /g)).toHaveLength(1);
  expect(html).toContain('type="button"');
  expect(html).toContain('aria-label="Выносливость: 4. Потратить 2 единицы за бой"');
  expect(onSpend).not.toHaveBeenCalled();
});
