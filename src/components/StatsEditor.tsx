import { STAT_LABELS, STAT_ORDER, PATH_RESOURCE_LABEL } from '../data/statsConfig';
import { bonusSum, sumBaseStats } from '../data/formulas';
import { maxBaseStat, statPointsBudget } from '../data/progression';
import { StatPill } from './StatPill';
import type { Character, StatKey } from '../types';

interface Props {
  character: Character;
  onChangeStat: (key: StatKey, value: number) => void;
}

export function StatBudgetBar({ character }: { character: Character }) {
  const spent = sumBaseStats(character);
  const budget = statPointsBudget(character);
  const diff = budget - spent;
  const cls = diff < 0 ? 'over' : diff > 0 ? 'under' : '';
  return (
    <div className={`budget-bar ${cls}`}>
      <strong>Потрачено очков характеристик: {spent} / {budget}</strong>
      {(character.levelPoints !== 0 || character.bonusStatPoints !== 0) && (
        <span className="muted">
          (100 + за уровни {character.levelPoints}
          {character.bonusStatPoints !== 0 &&
            `, награда мастера ${character.bonusStatPoints > 0 ? '+' : ''}${character.bonusStatPoints}`}
          )
        </span>
      )}
      {diff !== 0 && (
        <span>{diff > 0 ? `осталось ${diff}` : `перебор на ${Math.abs(diff)}`}</span>
      )}
    </div>
  );
}

export function StatsEditor({ character, onChangeStat }: Props) {
  return (
    <div className="stat-grid">
      {STAT_ORDER.map((key) => (
        <StatPill
          key={key}
          statKey={key}
          path={character.path}
          label={key === 'resource' ? PATH_RESOURCE_LABEL[character.path] : STAT_LABELS[key]}
          base={character.baseStats[key]}
          bonus={bonusSum(character, key)}
          maxBase={maxBaseStat(character, key)}
          onChange={(v) => onChangeStat(key, v)}
        />
      ))}
    </div>
  );
}
