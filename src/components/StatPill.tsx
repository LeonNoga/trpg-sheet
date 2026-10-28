import { useEffect, useRef, useState } from 'react';
import { STAT_MIN, milestoneEffects, statMilestone } from '../data/statsConfig';
import { RESTORE_LABELS } from '../data/statsConfig';
import type { MilestoneEffect } from '../data/statsConfig';
import { milestoneUsageKey } from '../data/abilityUse';
import type { UsageState } from '../data/abilityUse';
import { AbilityUseBar } from './AbilityUseBar';
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
  /** Жёсткий потолок базового значения (остаток очков характеристик). */
  maxBase?: number;
  /** Учёт применения активных бонусов порогов. */
  usage?: Record<string, UsageState>;
  onUseMilestone?: (effect: MilestoneEffect) => void;
  onClearUsage?: (key: string, which: 'cooldown' | 'daily') => void;
}

/** Названия открытых бонусов под характеристикой; по нажатию на название раскрывается полное описание. */
interface NotesProps {
  statKey: StatKey;
  effects: MilestoneEffect[];
  usage?: Record<string, UsageState>;
  onUse?: (effect: MilestoneEffect) => void;
  onClearUsage?: (key: string, which: 'cooldown' | 'daily') => void;
}

function MilestoneNotes({ statKey, effects, usage, onUse, onClearUsage }: NotesProps) {
  const [openId, setOpenId] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openId === null) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [openId]);

  if (effects.length === 0) return null;
  const open = effects.find((e) => e.threshold === openId);

  return (
    <div className="milestone-notes" ref={ref}>
      {effects.map((effect) => (
        <button
          key={effect.threshold}
          type="button"
          className="milestone-note"
          aria-expanded={openId === effect.threshold}
          onClick={() => setOpenId(openId === effect.threshold ? null : effect.threshold)}
        >
          ⚑ {effect.title}
          {usage?.[milestoneUsageKey(statKey, effect.threshold)]?.daily ? ' ✓' : ''}
        </button>
      ))}
      {open && (
        <div className="hover-card milestone-card" role="note">
          <div className="hover-card-title">
            {open.title} <span className="muted">· {open.kind}, порог {open.threshold}</span>
          </div>
          {open.activation && (
            <div className="hover-card-line">
              Активация: <b>{open.activation}</b>
            </div>
          )}
          <div className="hover-card-line">{open.text}</div>
          {open.kind === 'Актив' && onUse && (
            <AbilityUseBar
              cost={{ resource: 0, stamina: open.stamina ?? 0 }}
              resourceLabel=""
              note={open.restore ? `Применить ${RESTORE_LABELS[open.restore]}` : undefined}
              usage={usage?.[milestoneUsageKey(statKey, open.threshold)]}
              onUse={() => onUse(open)}
              onClear={(which) => onClearUsage?.(milestoneUsageKey(statKey, open.threshold), which)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Характеристика как на бумажной карточке: название, своя база (редактируется), итог с предметами
 * (показывается всегда) и модификатор. Подсвечивается на порогах 50 и 100; при наведении — расклад
 * «база + предметы = итого», открытые бонусы порогов пишутся под блоком.
 */
export function StatPill({ statKey, path, label, base, bonus, sources = [], onChange, maxBase, usage, onUseMilestone, onClearUsage }: Props) {
  const total = base + bonus;
  const mod = modifier(total);
  const milestone = statMilestone(total);
  const effects = milestoneEffects(statKey, total, path);

  return (
    <div className="stat-pill-wrap">
      <HoverCard card={<StatBreakdownCard label={label} base={base} sources={sources} />}>
        <div className={`stat-pill ${milestone ? `milestone-${milestone}` : ''}`}>
          <span className="stat-pill-name">{label}</span>
          <NumberField min={STAT_MIN} max={maxBase} value={base} onChange={onChange} aria-label={`${label}: базовое значение`} />
          <span className={`stat-pill-total ${milestone ? 'stat-value-milestone' : ''}`} title="Итог с предметами">
            {total}
          </span>
          <span className="stat-pill-mod">{mod >= 0 ? `+${mod}` : mod}</span>
        </div>
      </HoverCard>
      <MilestoneNotes statKey={statKey} effects={effects} usage={usage} onUse={onUseMilestone} onClearUsage={onClearUsage} />
    </div>
  );
}
