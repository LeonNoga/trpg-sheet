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
