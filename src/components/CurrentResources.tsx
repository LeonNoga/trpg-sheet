import { computeDerivedStats } from '../data/formulas';
import { PATH_RESOURCE_LABEL } from '../data/statsConfig';
import type { Character } from '../types';

export function CurrentResources({ character }: { character: Character }) {
  const maxHp = computeDerivedStats(character).hp;
  const healthState = character.pools.hp <= 0 ? ' is-depleted' : character.pools.hp < maxHp * 0.1 ? ' is-low' : '';
  return (
      <dl className="header-current-resources" aria-label="Текущие показатели персонажа">
        <div className={`header-current-resource resource-health${healthState}`}>
          <dt>Здоровье</dt>
          <dd>{character.pools.hp}</dd>
        </div>
        <div className={`header-current-resource resource-stamina${character.pools.staminaPoints <= 0 ? ' is-depleted' : ''}`}>
          <dt>Выносливость</dt>
          <dd>{character.pools.staminaPoints}</dd>
        </div>
        <div className={`header-current-resource resource-energy${character.pools.resourcePoints <= 0 ? ' is-depleted' : ''}`}>
          <dt>{PATH_RESOURCE_LABEL[character.path]}</dt>
          <dd>{character.pools.resourcePoints}</dd>
        </div>
      </dl>
  );
}
