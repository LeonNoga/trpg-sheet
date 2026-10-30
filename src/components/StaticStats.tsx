import { computeDerivedStats } from '../data/formulas';
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
  return (
    <dl className="header-static-stats" aria-label="Постоянные характеристики персонажа">
      {STATS.map(([key, label, short]) => (
        <div className="header-static-stat" key={key} title={label}>
          <dt>
            <span className="static-stat-label">{label}</span>
            <span className="static-stat-short" aria-hidden="true">{short}</span>
          </dt>
          <dd>{stats[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
