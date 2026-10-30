import { useIndicatorDetails } from './useIndicatorDetails';
import { computeDerivedStats, derivedBreakdown } from '../data/formulas';
import { DerivedBreakdownCard } from './HoverCard';
import type { Character } from '../types';

const STATS = [
  ['defense', 'Показатель защиты', 'ПЗ'],
  ['speed', 'Скорость', 'С'],
  ['passivePerception', 'Пассивное восприятие', 'ПВ'],
  ['initiative', 'Инициатива', 'И'],
  ['resistance', 'Сложность сопротивления', 'СС'],
] as const;

export function StaticStats({ character }: { character: Character }) {
  const stats = computeDerivedStats(character);
  const details = useIndicatorDetails<(typeof STATS)[number][0]>();
  const { open, root, panelId } = details;
  const selected = STATS.find(([key]) => key === open);
  return (
    <div className="static-stats-wrap" ref={root} onPointerLeave={details.leave}>
    <dl className="header-static-stats" aria-label="Постоянные характеристики персонажа">
      {STATS.map(([key, label, short]) => (
        <div className="header-static-stat" key={key} {...details.handlers(key)}>
          <dt>
            <button
              type="button"
              className="static-stat-action"
              aria-label={`${label}: ${stats[key]}. Показать состав показателя`}
              aria-expanded={open === key}
              aria-controls={open === key ? panelId : undefined}
              onClick={() => details.toggle(key)}
            />
            <span className="static-stat-label">{label}</span>
            <span className="static-stat-short" aria-hidden="true">{short}</span>
          </dt>
          <dd>{stats[key]}</dd>
        </div>
      ))}
    </dl>
    {selected && (
      <div id={panelId} className="hover-card static-stat-breakdown" role="region" aria-label={`Состав: ${selected[1]}`}>
        <DerivedBreakdownCard label={selected[1]} breakdown={derivedBreakdown(character, selected[0])} />
      </div>
    )}
    </div>
  );
}
