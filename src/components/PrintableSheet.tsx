import { createPortal } from 'react-dom';
import {
  DERIVED_LABELS,
  PATH_LABELS,
  PATH_RESOURCE_LABEL,
  PATH_RESOURCE_POINTS_LABEL,
  PATH_SPECIES_FIELD_LABEL,
  PATH_TRAIT_LABELS,
  SKILLS,
  STAT_LABELS,
} from '../data/statsConfig';
import { bonusSum, computeDerivedStats, modifier, totalStat } from '../data/formulas';
import type { Character, DerivedKey, PoolKey, StatKey } from '../types';

// Строки "характеристика -> мета-характеристика" как на бумажной карточке.
const PAIRED_ROWS: { stat: StatKey; derived: DerivedKey }[] = [
  { stat: 'vitality', derived: 'hp' },
  { stat: 'fortitude', derived: 'defense' },
  { stat: 'agility', derived: 'speed' },
  { stat: 'perception', derived: 'passivePerception' },
  { stat: 'intellect', derived: 'initiative' },
  { stat: 'strength', derived: 'resistance' },
];

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function Lines({ count, filled, numbered }: { count: number; filled: string[]; numbered?: boolean }) {
  const total = Math.max(count, filled.length);
  return (
    <>
      {Array.from({ length: total }, (_, i) => (
        <div className="p-line" key={i}>
          {numbered && <span className="p-line-num">{i + 1})</span>}
          {filled[i] ?? ''}
        </div>
      ))}
    </>
  );
}

export function PrintableSheet({ character }: { character: Character }) {
  const derived = computeDerivedStats(character);
  const traitLabels = PATH_TRAIT_LABELS[character.path];
  const resourceLabel = PATH_RESOURCE_LABEL[character.path];

  function statLabel(stat: StatKey): string {
    return stat === 'resource' ? resourceLabel : STAT_LABELS[stat];
  }

  function derivedLabel(key: DerivedKey): string {
    return key === 'resourcePoints' ? PATH_RESOURCE_POINTS_LABEL[character.path] : DERIVED_LABELS[key];
  }

  function derivedValue(key: DerivedKey): string {
    if (key === 'hp' || key === 'staminaPoints' || key === 'resourcePoints') {
      const pool = key as PoolKey;
      return `${character.pools[pool]} / ${derived[pool]}`;
    }
    return String(derived[key]);
  }

  function statPill(stat: StatKey, className = '') {
    const base = character.baseStats[stat];
    const bonus = bonusSum(character, stat);
    const total = totalStat(character, stat);
    return (
      <div className={`p-stat ${className}`}>
        <div className="p-stat-main">
          <div className="p-stat-name">{statLabel(stat)}</div>
          <div className="p-stat-calc">
            <span>{base}</span>
            <span className="p-op">+</span>
            <span>{bonus || ''}</span>
            <span className="p-op">=</span>
            <span>{total}</span>
          </div>
        </div>
        <div className="p-stat-mod">{signed(modifier(total))}</div>
      </div>
    );
  }

  function metaPill(key: DerivedKey) {
    return (
      <div className="p-meta">
        <div className="p-meta-name">{derivedLabel(key)}</div>
        <div className="p-meta-value">{derivedValue(key)}</div>
      </div>
    );
  }

  const sheet = (
    <div className="print-root">
      <div className="p-page">
        <div className="p-header">
          <div className="p-header-line">
            <b>Путь развития:</b> {PATH_LABELS[character.path]}
          </div>
          <div className="p-header-line">
            <b>Имя:</b> {character.characterName}
            {character.playerName && <span className="p-player"> (игрок: {character.playerName})</span>}
          </div>
          <div className="p-header-line p-header-split">
            <span>
              <b>{PATH_SPECIES_FIELD_LABEL[character.path]}:</b> {character.species}
            </span>
            <span>
              <b>Уровень:</b> {character.level}
            </span>
          </div>
        </div>

        <div className="p-xp">
          <b>Опыт:</b> {character.experience}
        </div>

        <div className="p-left">
          <div className="p-box">
            <div className="p-box-title">{traitLabels.bonuses}:</div>
            <Lines count={4} filled={character.speciesBonuses.slots} />
          </div>
          <div className="p-box">
            <div className="p-box-title">{traitLabels.dnaA}:</div>
            <Lines count={5} filled={character.dnaLists[0]?.slots ?? []} numbered />
            <div className="p-box-title">{traitLabels.dnaB}:</div>
            <Lines count={5} filled={character.dnaLists[1]?.slots ?? []} numbered />
          </div>
        </div>

        {PAIRED_ROWS.map((row, i) => (
          <div className="p-row" key={row.stat} style={{ gridRow: i + 2 }}>
            {statPill(row.stat)}
            <div className="p-connector" />
            {metaPill(row.derived)}
          </div>
        ))}

        <div className="p-pool" style={{ gridRow: 8 }}>
          {metaPill('staminaPoints')}
          <div className="p-connector" />
        </div>
        <div className="p-row p-row-bottom" style={{ gridRow: 8 }}>
          {statPill('endurance')}
          <div className="p-extra">{statPill('wisdom', 'p-stat-plain')}</div>
        </div>

        <div className="p-pool" style={{ gridRow: 9 }}>
          {metaPill('resourcePoints')}
          <div className="p-connector" />
        </div>
        <div className="p-row p-row-bottom" style={{ gridRow: 9 }}>
          {statPill('resource')}
          <div className="p-extra">{statPill('charisma', 'p-stat-plain')}</div>
        </div>

        <div className="p-skills">
          <div className="p-skills-title">Навыки</div>
          <div className="p-skills-head">
            <span>+15</span>
            <span>+10</span>
            <span>+5</span>
            <span className="p-skills-head-label">Степени владения</span>
          </div>
          {SKILLS.map((skill) => {
            const level = character.skills[skill] ?? 0;
            return (
              <div className="p-skill" key={skill}>
                <span className={`p-dot ${level >= 15 ? 'on' : ''}`} />
                <span className={`p-dot ${level >= 10 ? 'on' : ''}`} />
                <span className={`p-dot ${level >= 5 ? 'on' : ''}`} />
                <span className="p-skill-name">{skill}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}

/** Открывает системный диалог печати (там "Сохранить как PDF"); имя файла берём из имени персонажа. */
export function printCharacterSheet(character: Character): void {
  const previousTitle = document.title;
  document.title = character.characterName.trim() || 'Карточка персонажа';
  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}
