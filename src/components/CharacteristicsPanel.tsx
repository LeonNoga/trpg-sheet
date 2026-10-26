import { useState } from 'react';
import {
  DERIVED_LABELS,
  PATH_RESOURCE_LABEL,
  PATH_RESOURCE_POINTS_LABEL,
  RESISTANCE_ALLOWED_STATS,
  STAT_LABELS,
  STAT_ORDER,
  STAT_TO_DERIVED,
  poolKeyFor,
} from '../data/statsConfig';
import {
  bonusSources,
  bonusSum,
  computeDerivedStats,
  currentInitiativeStat,
  currentResistanceStat,
  derivedBreakdown,
} from '../data/formulas';
import { DerivedBreakdownCard, HoverCard } from './HoverCard';
import { NumberField } from './NumberField';
import type { MilestoneEffect } from '../data/statsConfig';
import { StatPill } from './StatPill';
import type { Character, DerivedKey, InitiativeSource, ResistanceSource, StatKey } from '../types';

interface Props {
  character: Character;
  onChangeStat: (key: StatKey, value: number) => void;
  onChangePool: (key: 'hp' | 'staminaPoints' | 'resourcePoints', value: number) => void;
  onChangeInitiativeSource: (source: InitiativeSource) => void;
  onChangeResistanceSource: (source: ResistanceSource) => void;
  onUseMilestone: (stat: StatKey, effect: MilestoneEffect) => void;
  onClearUsage: (key: string, which: 'cooldown' | 'daily') => void;
}

// Дательный падеж для подписи "по ..." у статов, которые могут определять Сложность Сопротивления.
const STAT_DATIVE: Record<'agility' | 'strength' | 'intellect', string> = {
  agility: 'Ловкости',
  strength: 'Силе',
  intellect: 'Интеллекту',
};

const INITIATIVE_OPTIONS: { value: InitiativeSource; label: string }[] = [
  { value: 'auto', label: 'Авто (больший модификатор)' },
  { value: 'agility', label: 'Ловкость' },
  { value: 'intellect', label: 'Интеллект' },
  { value: 'perception', label: 'Восприятие' },
];

function derivedLabel(key: DerivedKey, character: Character): string {
  if (key === 'resourcePoints') return PATH_RESOURCE_POINTS_LABEL[character.path];
  return DERIVED_LABELS[key];
}

/** Прибавить/вычесть из текущего значения пула: «+» не поднимает выше максимума, «−» может уйти ниже нуля. */
function PoolAdjust({ current, max, onChange }: { current: number; max: number; onChange: (v: number) => void }) {
  const [text, setText] = useState('');
  const amount = Math.abs(Number(text));
  const valid = text.trim() !== '' && Number.isFinite(amount) && amount > 0;

  function apply(sign: 1 | -1) {
    if (!valid) return;
    onChange(sign === 1 ? Math.max(current, Math.min(max, current + amount)) : current - amount);
    setText('');
  }

  return (
    <div className="pool-adjust">
      <button type="button" className="btn btn-sm" disabled={!valid} onClick={() => apply(-1)} title="Вычесть">
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={text}
        placeholder="±"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply(Number(text) < 0 ? -1 : 1)}
        aria-label="Сколько прибавить или вычесть"
      />
      <button type="button" className="btn btn-sm" disabled={!valid} onClick={() => apply(1)} title="Прибавить (до максимума)">
        +
      </button>
    </div>
  );
}

const PAIRED_STATS = STAT_ORDER.filter((key) => STAT_TO_DERIVED[key]);
const STANDALONE_STATS = STAT_ORDER.filter((key) => !STAT_TO_DERIVED[key]);

export function CharacteristicsPanel({
  character,
  onChangeStat,
  onChangePool,
  onChangeInitiativeSource,
  onChangeResistanceSource,
  onUseMilestone,
  onClearUsage,
}: Props) {
  const derived = computeDerivedStats(character);
  const resistanceAllowed = RESISTANCE_ALLOWED_STATS[character.path];

  function statLabelFor(statKey: StatKey) {
    return statKey === 'resource' ? PATH_RESOURCE_LABEL[character.path] : STAT_LABELS[statKey];
  }

  function statPill(statKey: StatKey) {
    return (
      <StatPill
        statKey={statKey}
        path={character.path}
        label={statLabelFor(statKey)}
        base={character.baseStats[statKey]}
        bonus={bonusSum(character, statKey)}
        sources={bonusSources(character, statKey)}
        onChange={(v) => onChangeStat(statKey, v)}
        usage={character.usage}
        onUseMilestone={(effect) => onUseMilestone(statKey, effect)}
        onClearUsage={onClearUsage}
      />
    );
  }

  return (
    <div>
      <div className="char-rows">
        {PAIRED_STATS.map((statKey) => {
          const derivedKey = STAT_TO_DERIVED[statKey]!;
          const poolKey = poolKeyFor(derivedKey);

          return (
            <div className="char-row" key={statKey}>
              {statPill(statKey)}
              {poolKey ? (
                <HoverCard
                  className="pool-tile"
                  card={<DerivedBreakdownCard label={`${derivedLabel(derivedKey, character)} (максимум)`} breakdown={derivedBreakdown(character, derivedKey)} />}
                >
                  <div className="pool-tile-values">
                    <NumberField value={character.pools[poolKey]} onChange={(v) => onChangePool(poolKey, v)} />
                    <span className="pool-tile-max">/ {derived[poolKey]}</span>
                  </div>
                  <PoolAdjust
                    current={character.pools[poolKey]}
                    max={derived[poolKey]}
                    onChange={(v) => onChangePool(poolKey, v)}
                  />
                  <div className="label">{derivedLabel(derivedKey, character)}</div>
                </HoverCard>
              ) : (
                <HoverCard
                  className="derived-tile"
                  card={<DerivedBreakdownCard label={derivedLabel(derivedKey, character)} breakdown={derivedBreakdown(character, derivedKey)} />}
                >
                  <div className="value">{derived[derivedKey]}</div>
                  <div className="label">{derivedLabel(derivedKey, character)}</div>
                  {derivedKey === 'initiative' && (
                    <select
                      className="initiative-source-select"
                      value={character.initiativeSource}
                      onChange={(e) => onChangeInitiativeSource(e.target.value as InitiativeSource)}
                      title="По какой характеристике считать инициативу"
                    >
                      {INITIATIVE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value === 'auto'
                            ? `Авто (сейчас: ${STAT_LABELS[currentInitiativeStat(character)]})`
                            : opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {derivedKey === 'resistance' &&
                    (resistanceAllowed.length > 1 ? (
                      <select
                        className="initiative-source-select"
                        value={character.resistanceSource}
                        onChange={(e) => onChangeResistanceSource(e.target.value as ResistanceSource)}
                        title="По какой характеристике считать сложность сопротивления"
                      >
                        <option value="auto">Авто (сейчас: {STAT_LABELS[currentResistanceStat(character)]})</option>
                        {resistanceAllowed.map((stat) => (
                          <option key={stat} value={stat}>
                            {STAT_LABELS[stat]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="muted" style={{ marginTop: 6 }}>
                        по {STAT_DATIVE[currentResistanceStat(character)]}
                      </div>
                    ))}
                </HoverCard>
              )}
            </div>
          );
        })}
      </div>

      <div className="char-rows-standalone">
        {STANDALONE_STATS.map((statKey) => (
          <div key={statKey}>{statPill(statKey)}</div>
        ))}
      </div>
    </div>
  );
}
