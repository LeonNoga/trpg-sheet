import { computeDerivedStats } from '../data/formulas';
import { DERIVED_LABELS, PATH_RESOURCE_POINTS_LABEL } from '../data/statsConfig';
import type { Character } from '../types';

export function DerivedStatsPanel({ character }: { character: Character }) {
  const derived = computeDerivedStats(character);
  const resourceLabel = PATH_RESOURCE_POINTS_LABEL[character.path];

  const tiles: { label: string; value: number }[] = [
    { label: DERIVED_LABELS.hp, value: derived.hp },
    { label: DERIVED_LABELS.defense, value: derived.defense },
    { label: DERIVED_LABELS.speed, value: derived.speed },
    { label: DERIVED_LABELS.passivePerception, value: derived.passivePerception },
    { label: DERIVED_LABELS.initiative, value: derived.initiative },
    { label: DERIVED_LABELS.resistance, value: derived.resistance },
    { label: DERIVED_LABELS.staminaPoints, value: derived.staminaPoints },
    { label: resourceLabel, value: derived.resourcePoints },
  ];

  return (
    <div className="derived-grid">
      {tiles.map((tile) => (
        <div className="derived-tile" key={tile.label}>
          <div className="value">{tile.value}</div>
          <div className="label">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
