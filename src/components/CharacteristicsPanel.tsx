import {
  DERIVED_LABELS,
  PATH_RESOURCE_LABEL,
  PATH_RESOURCE_POINTS_LABEL,
  STAT_LABELS,
  STAT_MIN,
  STAT_ORDER,
  STAT_TO_DERIVED,
  poolKeyFor,
} from '../data/statsConfig';
import { bonusSum, computeDerivedStats, modifier, totalStat } from '../data/formulas';
import type { Character, DerivedKey, StatKey } from '../types';

interface Props {
  character: Character;
  onChangeStat: (key: StatKey, value: number) => void;
  onChangePool: (key: 'hp' | 'staminaPoints' | 'resourcePoints', value: number) => void;
}

function derivedLabel(key: DerivedKey, character: Character): string {
  if (key === 'resourcePoints') return PATH_RESOURCE_POINTS_LABEL[character.path];
  return DERIVED_LABELS[key];
}

export function CharacteristicsPanel({ character, onChangeStat, onChangePool }: Props) {
  const derived = computeDerivedStats(character);

  return (
    <div className="char-rows">
      {STAT_ORDER.map((statKey) => {
        const statLabel = statKey === 'resource' ? PATH_RESOURCE_LABEL[character.path] : STAT_LABELS[statKey];
        const base = character.baseStats[statKey];
        const bonus = bonusSum(character, statKey);
        const total = totalStat(character, statKey);
        const mod = modifier(total);

        const derivedKey = STAT_TO_DERIVED[statKey];
        const poolKey = derivedKey ? poolKeyFor(derivedKey) : null;

        return (
          <div className="char-row" key={statKey}>
            <div className="stat-pill" title={bonus ? `База ${base} + предметы ${bonus > 0 ? '+' : ''}${bonus} = ${total}` : undefined}>
              <span className="stat-pill-name">
                {statLabel}
                {bonus !== 0 && <span className="muted"> ({total})</span>}
              </span>
              <input type="number" min={STAT_MIN} value={base} onChange={(e) => onChangeStat(statKey, Number(e.target.value))} />
              <span className="stat-pill-mod">{mod >= 0 ? `+${mod}` : mod}</span>
            </div>

            {derivedKey ? (
              <>
                <span className="char-row-arrow">→</span>
                {poolKey ? (
                  <div className="pool-tile">
                    <div className="pool-tile-values">
                      <input
                        type="number"
                        value={character.pools[poolKey]}
                        onChange={(e) => onChangePool(poolKey, Number(e.target.value))}
                      />
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
                  </div>
                )}
              </>
            ) : (
              <span className="char-row-spacer" />
            )}
          </div>
        );
      })}
    </div>
  );
}
