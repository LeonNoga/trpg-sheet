import { bonusLabel } from '../data/statsConfig';
import type { BonusKey, EquipItem, Path } from '../types';

interface Props {
  item: EquipItem;
  path?: Path;
  showEquipToggle: boolean;
  onToggleEquipped: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ItemCard({ item, path, showEquipToggle, onToggleEquipped, onEdit, onDelete }: Props) {
  const bonusEntries = Object.entries(item.statBonuses) as [BonusKey, number][];
  const props = [item.activation, item.cooldown, item.cast, item.duration].some(Boolean);

  return (
    <div className={`item-card ${item.equipped ? 'equipped' : ''}`}>
      <div className="item-card-head">
        <div>
          <h4>{item.name || 'Без названия'}</h4>
          <div className="item-meta">
            {[item.rarity, item.category, item.level ? `ур. ${item.level}` : null].filter(Boolean).join(' · ')}
          </div>
        </div>
        {showEquipToggle && (
          <label className="toggle">
            <input type="checkbox" checked={item.equipped} onChange={onToggleEquipped} />
            {item.equipped ? 'Надето' : 'Снято'}
          </label>
        )}
      </div>

      {item.flavorText && <p className="item-flavor">"{item.flavorText}"</p>}
      {item.effect && <p className="item-effect">{item.effect}</p>}

      {props && (
        <div className="item-props">
          {item.activation && <span>Активация: {item.activation}</span>}
          {item.cooldown && <span>Откат: {item.cooldown}</span>}
          {item.cast && <span>Каст: {item.cast}</span>}
          {item.duration && <span>Длительность: {item.duration}</span>}
        </div>
      )}

      {item.image && <img src={item.image} alt={item.name} className="item-image" />}

      {bonusEntries.length > 0 && (
        <div className="item-bonuses">
          {bonusEntries.map(([key, value]) => (
            <span className="bonus-chip" key={key}>
              {bonusLabel(key, path)} {value >= 0 ? `+${value}` : value}
            </span>
          ))}
        </div>
      )}

      <div className="item-actions">
        <button className="btn btn-sm" onClick={onEdit}>
          Изменить
        </button>
        <button className="btn btn-sm btn-danger" onClick={onDelete}>
          Удалить
        </button>
      </div>
    </div>
  );
}
