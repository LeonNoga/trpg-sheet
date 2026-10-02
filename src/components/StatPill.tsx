import { STAT_MIN, milestoneEffects, statMilestone } from '../data/statsConfig';
import { modifier } from '../data/formulas';
import { NumberField } from './NumberField';
import type { StatKey } from '../types';

interface Props {
  statKey: StatKey;
  label: string;
  base: number;
  /** Бонус от снаряжения/умений. */
  bonus: number;
  onChange: (value: number) => void;
}

/** Характеристика: название, редактируемая база, модификатор. Подсвечивается на порогах 50/100. */
export function StatPill({ statKey, label, base, bonus, onChange }: Props) {
  const total = base + bonus;
  const mod = modifier(total);
  const milestone = statMilestone(total);
  const effects = milestoneEffects(statKey, total);

  return (
    <div className="stat-pill-wrap">
      <div
        className={`stat-pill ${milestone ? `milestone-${milestone}` : ''}`}
        title={
          milestone
            ? effects.length
              ? `Порог ${milestone} достигнут: ${effects.join('; ')}`
              : `Порог ${milestone} достигнут — по системе здесь появляются доп. эффекты`
            : bonus
              ? `База ${base} + предметы ${bonus > 0 ? '+' : ''}${bonus} = ${total}`
              : undefined
        }
      >
        <span className="stat-pill-name">
          {label}
          {(bonus !== 0 || milestone) && (
            <span className={milestone ? 'stat-value-milestone' : 'muted'}> ({total})</span>
          )}
        </span>
        <NumberField min={STAT_MIN} value={base} onChange={onChange} />
        <span className="stat-pill-mod">{mod >= 0 ? `+${mod}` : mod}</span>
      </div>
      {effects.map((effect) => (
        <div className="milestone-note" key={effect}>
          ⚑ {effect}
        </div>
      ))}
    </div>
  );
}
