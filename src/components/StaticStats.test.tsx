import { derivedBreakdown } from '../data/formulas';
import { DerivedBreakdownCard } from './HoverCard';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { StaticStats } from './StaticStats';
import { createBlankCharacter } from '../data/defaults';
import { applyUse } from '../data/abilityUse';

it('сохраняет характеристики при потере здоровья и расходовании ресурсов', () => {
  const character = createBlankCharacter('tech');
  const before = renderToStaticMarkup(<StaticStats character={character} />);
  const after = applyUse(character, 'ability', { stamina: 5, resource: 5 }, {});
  after.pools = { ...after.pools, hp: -1 };
  expect(renderToStaticMarkup(<StaticStats character={after} />)).toBe(before);
});

it('отображает значения снаряжения в порядке ПЗ, С, ПВ, И, СС', () => {
  const character = createBlankCharacter('tech');
  const values = () => [...renderToStaticMarkup(<StaticStats character={character} />).matchAll(/<dd>(.*?)<\/dd>/g)].map((match) => Number(match[1]));
  const base = values();
  character.items = [{ id: 'bonus', kind: 'item', name: 'Бонус', equipped: true,
    statBonuses: { defense: 1, speed: 2, passivePerception: 3, initiative: 4, resistance: 5 } }];
  expect(values()).toEqual(base.map((value, index) => value + index + 1));
});

it('все пять карточек имеют кнопки раскрытия с доступными названиями', () => {
  const html = renderToStaticMarkup(<StaticStats character={createBlankCharacter('tech')} />);
  expect(html.match(/<button /g)).toHaveLength(5);
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(5);
  for (const label of ['Показатель защиты', 'Скорость', 'Пассивное восприятие', 'Инициатива', 'Сложность сопротивления']) {
    expect(html).toContain(`aria-label="${label}:`);
  }
});

it('разложение защиты показывает базу, модификатор, надетые предметы и штрафы', () => {
  const c = createBlankCharacter('tech');
  c.baseStats.fortitude = 20;
  c.items = [
    { id: 'armor', name: 'Красный доспех', kind: 'item', equipped: true, statBonuses: { defense: 8 } },
    { id: 'penalty', name: 'Штраф', kind: 'item', equipped: true, statBonuses: { defense: -1 } },
    { id: 'unused', name: 'Снятый предмет', kind: 'item', equipped: false, statBonuses: { defense: 100 } },
  ];
  const breakdown = derivedBreakdown(c, 'defense');
  const html = renderToStaticMarkup(<DerivedBreakdownCard label="Показатель защиты" breakdown={breakdown} />);
  expect(breakdown.total).toBe(27);
  for (const text of ['База', '18', 'Мод. Стойкости', '+2', 'Красный доспех', '+8', 'Штраф', '-1', 'Итого:', '27']) {
    expect(html).toContain(text);
  }
  expect(html).not.toContain('Снятый предмет');
});
