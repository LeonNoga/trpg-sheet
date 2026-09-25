import { STAT_LABELS, STAT_MIN, STAT_ORDER, PATH_RESOURCE_LABEL } from '../data/statsConfig';
import { bonusSum, modifier, sumBaseStats, totalStat } from '../data/formulas';
import { NumberField } from './NumberField';
import type { Character, StatKey } from '../types';

interface Props {
  character: Character;
  onChangeStat: (key: StatKey, value: number) => void;
}

export function StatBudgetBar({ character }: { character: Character }) {
  const spent = sumBaseStats(character);
  const budget = character.statPointsBudget;
  const diff = budget - spent;
  const cls = diff < 0 ? 'over' : diff > 0 ? 'under' : '';
  return (
    <div className={`budget-bar ${cls}`}>
      <strong>Потрачено очков характеристик: {spent} / {budget}</strong>
      {diff !== 0 && (
        <span>{diff > 0 ? `осталось ${diff}` : `перебор на ${Math.abs(diff)}`}</span>
      )}
    </div>
  );
}

export function StatsEditor({ character, onChangeStat }: Props) {
  return (
    <div className="stat-grid">
      {STAT_ORDER.map((key) => {
        const label = key === 'resource' ? PATH_RESOURCE_LABEL[character.path] : STAT_LABELS[key];
        const base = character.baseStats[key];
        const bonus = bonusSum(character, key);
        const total = totalStat(character, key);
        const mod = modifier(total);
        return (
          <div key={key} className="stat-pill" title={bonus ? `База ${base} + предметы ${bonus > 0 ? '+' : ''}${bonus} = ${total}` : undefined}>
            <span className="stat-pill-name">
              {label}
              {bonus !== 0 && <span className="muted"> ({total})</span>}
            </span>
            <NumberField min={STAT_MIN} value={base} onChange={(v) => onChangeStat(key, v)} />
            <span className="stat-pill-mod">{mod >= 0 ? `+${mod}` : mod}</span>
          </div>
        );
      })}
    </div>
  );
}
