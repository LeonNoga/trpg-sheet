import { STAT_MIN, milestoneEffect, statMilestone } from '../data/statsConfig';
import { modifier } from '../data/formulas';
import { NumberField } from './NumberField';
import type { Path, StatKey } from '../types';

interface Props {
  statKey: StatKey;
  path: Path;
  label: string;
  base: number;
  /** Бонус от снаряжения/умений. */
  bonus: number;
  onChange: (value: number) => void;
}

/** Характеристика: название, редактируемая база, модификатор. Подсвечивается на порогах 50 и 100. */
export function StatPill({ statKey, path, label, base, bonus, onChange }: Props) {
  const total = base + bonus;
  const mod = modifier(total);
  const milestone = statMilestone(total);
  const effect = milestoneEffect(statKey, total, path);

  return (
    <div className="stat-pill-wrap">
      <div
        className={`stat-pill ${milestone ? `milestone-${milestone}` : ''}`}
        title={
          milestone
            ? milestone === 100
              ? `Порог 100 достигнут — бонусы этого порога появятся позже${effect ? `. Порог 50: ${effect.title}` : ''}`
              : effect
                ? `Порог 50 достигнут: ${effect.title} — ${effect.text}`
                : 'Порог 50 достигнут — для этой характеристики бонус не предусмотрен'
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
      {effect && (
        <div className="milestone-note">
          ⚑ <b>{effect.title}</b> — {effect.text}
        </div>
      )}
    </div>
  );
}
