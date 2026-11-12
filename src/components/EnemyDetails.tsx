import { STAT_LABELS, STAT_ORDER } from '../data/statsConfig';
import type { Enemy } from '../types';

/** Подробности противника: числа, характеристики, атаки и умения, описание, свои поля. Картинка — отдельно (showImage). */
export function EnemyDetails({ enemy, showImage = false }: { enemy: Enemy; showImage?: boolean }) {
  const stats = STAT_ORDER.filter((k) => enemy.stats[k] !== undefined);
  return (
    <div className="enemy-details">
      {showImage && enemy.image && <img className="enemy-image" src={enemy.image} alt={enemy.name} />}
      {stats.length > 0 && (
        <div className="enemy-numbers" style={{ marginBottom: 8 }}>
          {stats.map((k) => (
            <span key={k}>
              {STAT_LABELS[k]} <b>{enemy.stats[k]}</b>
            </span>
          ))}
        </div>
      )}
      {enemy.attacks && (
        <p className="item-effect">
          <b>Атаки и умения:</b>
          <br />
          {enemy.attacks}
        </p>
      )}
      {enemy.description && <p className="item-effect">{enemy.description}</p>}
      {enemy.fields
        .filter((f) => f.label || f.value)
        .map((f) => (
          <p className="item-effect" key={f.id}>
            <b>{f.label || 'Поле'}:</b> {f.value}
          </p>
        ))}
    </div>
  );
}
