import type { CSSProperties } from 'react';
import { DerivedBreakdownCard } from './HoverCard';
import { useIndicatorDetails } from './useIndicatorDetails';
import { computeDerivedStats, derivedBreakdown } from '../data/formulas';
import { PATH_RESOURCE_LABEL } from '../data/statsConfig';
import type { Character } from '../types';

interface Props {
  character: Character;
  onSpendCombatStamina?: () => void;
}

export function CurrentResources({ character, onSpendCombatStamina }: Props) {
  const maximum = computeDerivedStats(character);
  const resources = [
    { key: 'hp', label: 'Здоровье', color: 'health' },
    { key: 'staminaPoints', label: 'Выносливость', color: 'stamina' },
    { key: 'resourcePoints', label: PATH_RESOURCE_LABEL[character.path], color: 'energy' },
  ] as const;
  const details = useIndicatorDetails<(typeof resources)[number]['key']>(true);
  const { open, root, panelId } = details;
  const selected = resources.find(({ key }) => key === open);
  return (
    <div className="resource-details-wrap" ref={root} onPointerLeave={details.leave}>
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
            {...details.handlers(key)}>
            <dt>{label}<span className="resource-percent">{percent}%</span></dt>
            <dd>
              {value}
              {key === 'staminaPoints' && onSpendCombatStamina && (
                <button
                  type="button"
                  className="resource-card-action"
                  aria-label={`Выносливость: ${value}. Потратить 2 единицы за бой`}
                  onClick={onSpendCombatStamina}
                />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
    {selected && (
      <div id={panelId} className="hover-card resource-breakdown" role="region" aria-label={`Состав: ${selected.label}`}>
        <DerivedBreakdownCard label={selected.label} breakdown={derivedBreakdown(character, selected.key)} />
        <div className="hover-card-line">Текущее: <b>{character.pools[selected.key]}</b> / {maximum[selected.key]}</div>
      </div>
    )}
    </div>
  );
}
