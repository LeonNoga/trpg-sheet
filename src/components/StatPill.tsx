import { STAT_MIN, milestoneEffect, statMilestone } from '../data/statsConfig';
import { modifier } from '../data/formulas';
import type { BonusSource } from '../data/formulas';
import { HoverCard, StatBreakdownCard } from './HoverCard';
import { NumberField } from './NumberField';
import type { Path, StatKey } from '../types';

interface Props {
  statKey: StatKey;
  path: Path;
  label: string;
  base: number;
  /** Бонус от снаряжения/умений. */
  bonus: number;
  /** Какие именно предметы дают этот бонус — для всплывающей карточки. */
  sources?: BonusSource[];
  onChange: (value: number) => void;
}

/**
 * Характеристика: название, редактируемая база, модификатор. Подсвечивается на порогах 50 и 100;
 * бонус порога 50 пишется под блоком, а при наведении показывается расклад «база + предметы = итого».
 */
export function StatPill({ statKey, path, label, base, bonus, sources = [], onChange }: Props) {
  const total = base + bonus;
  const mod = modifier(total);
  const milestone = statMilestone(total);
  const effect = milestoneEffect(statKey, total, path);

  return (
    <div className="stat-pill-wrap">
      <HoverCard card={<StatBreakdownCard label={label} base={base} sources={sources} />}>
        <div className={`stat-pill ${milestone ? `milestone-${milestone}` : ''}`}>
          <span className="stat-pill-name">
            {label}
            {(bonus !== 0 || milestone) && (
              <span className={milestone ? 'stat-value-milestone' : 'muted'}> ({total})</span>
            )}
          </span>
          <NumberField min={STAT_MIN} value={base} onChange={onChange} />
          <span className="stat-pill-mod">{mod >= 0 ? `+${mod}` : mod}</span>
        </div>
      </HoverCard>
      {effect && (
        <div className="milestone-note">
          ⚑ <b>{effect.title}</b> — {effect.text}
        </div>
      )}
    </div>
  );
}
