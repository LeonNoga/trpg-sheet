import type { CSSProperties } from 'react';
import { computeDerivedStats } from '../data/formulas';
import { PATH_RESOURCE_LABEL } from '../data/statsConfig';
import type { Character } from '../types';

export function CurrentResources({ character }: { character: Character }) {
  const maximum = computeDerivedStats(character);
  const resources = [
    { key: 'hp', label: 'Здоровье', color: 'health' },
    { key: 'staminaPoints', label: 'Выносливость', color: 'stamina' },
    { key: 'resourcePoints', label: PATH_RESOURCE_LABEL[character.path], color: 'energy' },
  ] as const;
  return (
    <dl className="header-current-resources" aria-label="Текущие показатели персонажа">
      {resources.map(({ key, label, color }) => {
        const value = character.pools[key];
        const max = maximum[key];
        const percent = max > 0 ? Math.max(0, Math.round(value / max * 100)) : 0;
        const fill = max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0;
        const state = value <= 0 ? ' is-depleted' : key === 'hp' && value < max * 0.1 ? ' is-low' : '';
        return (
          <div key={key} className={`header-current-resource resource-${color}${state}`}
            style={{ '--resource-fill': `${fill}%` } as CSSProperties}
            title={`${label}: ${value} / ${max} (${percent}%)`}>
            <dt>{label}<span className="resource-percent">{percent}%</span></dt>
            <dd>{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
