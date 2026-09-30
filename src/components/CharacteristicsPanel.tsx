import {
  DERIVED_LABELS,
  PATH_RESOURCE_LABEL,
  PATH_RESOURCE_POINTS_LABEL,
  RESISTANCE_ALLOWED_STATS,
  STAT_LABELS,
  STAT_MIN,
  STAT_ORDER,
  STAT_TO_DERIVED,
  poolKeyFor,
} from '../data/statsConfig';
import {
  bonusSum,
  computeDerivedStats,
  currentInitiativeStat,
  currentResistanceStat,
  modifier,
  totalStat,
} from '../data/formulas';
import { NumberField } from './NumberField';
import type { Character, DerivedKey, InitiativeSource, ResistanceSource, StatKey } from '../types';

interface Props {
  character: Character;
  onChangeStat: (key: StatKey, value: number) => void;
  onChangePool: (key: 'hp' | 'staminaPoints' | 'resourcePoints', value: number) => void;
  onChangeInitiativeSource: (source: InitiativeSource) => void;
  onChangeResistanceSource: (source: ResistanceSource) => void;
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

const PAIRED_STATS = STAT_ORDER.filter((key) => STAT_TO_DERIVED[key]);
const STANDALONE_STATS = STAT_ORDER.filter((key) => !STAT_TO_DERIVED[key]);

export function CharacteristicsPanel({
  character,
  onChangeStat,
  onChangePool,
  onChangeInitiativeSource,
  onChangeResistanceSource,
}: Props) {
  const derived = computeDerivedStats(character);
  const resistanceAllowed = RESISTANCE_ALLOWED_STATS[character.path];

  function statLabelFor(statKey: StatKey) {
    return statKey === 'resource' ? PATH_RESOURCE_LABEL[character.path] : STAT_LABELS[statKey];
  }

  function statPill(statKey: StatKey) {
    const label = statLabelFor(statKey);
    const base = character.baseStats[statKey];
    const bonus = bonusSum(character, statKey);
    const total = totalStat(character, statKey);
    const mod = modifier(total);
    return (
      <div className="stat-pill" title={bonus ? `База ${base} + предметы ${bonus > 0 ? '+' : ''}${bonus} = ${total}` : undefined}>
        <span className="stat-pill-name">
          {label}
          {bonus !== 0 && <span className="muted"> ({total})</span>}
        </span>
        <NumberField min={STAT_MIN} value={base} onChange={(v) => onChangeStat(statKey, v)} />
        <span className="stat-pill-mod">{mod >= 0 ? `+${mod}` : mod}</span>
      </div>
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
                <div className="pool-tile">
                  <div className="pool-tile-values">
                    <NumberField value={character.pools[poolKey]} onChange={(v) => onChangePool(poolKey, v)} />
                    <span className="pool-tile-max">/ {derived[poolKey]}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title="Восстановить до максимума"
                      onClick={() => onChangePool(poolKey, derived[poolKey])}
                    >
                      ⟳
                    </button>
                  </div>
                  <div className="label">{derivedLabel(derivedKey, character)}</div>
                </div>
              ) : (
                <div className="derived-tile">
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
                </div>
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
