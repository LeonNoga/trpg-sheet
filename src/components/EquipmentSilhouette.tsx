import { useState } from 'react';
import type { Character } from '../types';

interface Slot {
  key: string;
  label: string;
  capacity: number;
}

const LEFT_SLOTS: Slot[] = [
  { key: 'glasses', label: 'Очки/линзы', capacity: 1 },
  { key: 'cloak', label: 'Плащ', capacity: 1 },
  { key: 'shoulders', label: 'Наплечники', capacity: 1 },
  { key: 'elbows', label: 'Налокотники', capacity: 1 },
  { key: 'bracers', label: 'Наручи', capacity: 1 },
  { key: 'bracelets', label: 'Браслеты', capacity: 4 },
  { key: 'ringsLeft', label: 'Кольца (левая)', capacity: 5 },
  { key: 'thigh', label: 'Набедренник', capacity: 1 },
  { key: 'shins', label: 'Поножи', capacity: 1 },
];

const RIGHT_SLOTS: Slot[] = [
  { key: 'headwear', label: 'Головной убор', capacity: 1 },
  { key: 'earrings', label: 'Серьги', capacity: 4 },
  { key: 'amulets', label: 'Амулеты', capacity: 3 },
  { key: 'armor', label: 'Броня', capacity: 1 },
  { key: 'belt', label: 'Пояс', capacity: 1 },
  { key: 'gloves', label: 'Перчатки', capacity: 1 },
  { key: 'ringsRight', label: 'Кольца (правая)', capacity: 5 },
  { key: 'knees', label: 'Наколенники', capacity: 1 },
  { key: 'boots', label: 'Обувь', capacity: 1 },
];

const ALL_SLOTS = [...LEFT_SLOTS, ...RIGHT_SLOTS];

interface Props {
  character: Character;
  onChange: (slots: Record<string, string[]>) => void;
}

export function EquipmentSilhouette({ character, onChange }: Props) {
  const [openSlot, setOpenSlot] = useState<string | null>(null);

  function idsInSlot(key: string): string[] {
    return character.equippedSlots[key] ?? [];
  }

  function toggleItemInSlot(key: string, itemId: string) {
    const current = idsInSlot(key);
    const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId];
    onChange({ ...character.equippedSlots, [key]: next });
  }

  function renderSlotButton(slot: Slot) {
    const count = idsInSlot(slot.key).length;
    return (
      <button
        key={slot.key}
        type="button"
        className={`equipment-slot-btn ${count > 0 ? 'has-items' : ''}`}
        onClick={() => setOpenSlot(openSlot === slot.key ? null : slot.key)}
      >
        <span>{slot.label}</span>
        <span className="equipment-slot-count">
          {count}/{slot.capacity}
        </span>
      </button>
    );
  }

  const activeSlot = ALL_SLOTS.find((s) => s.key === openSlot);

  return (
    <div className="card">
      <h3 className="card-title">Экипировка</h3>
      <p className="muted">
        Клик по слоту — выбрать, какие предметы туда «надеты». Счётчик только для наглядности, превышать
        можно.
      </p>
      <div className="equipment-wrap">
        <div className="equipment-slot-list">{LEFT_SLOTS.map(renderSlotButton)}</div>

        <svg className="equipment-silhouette" viewBox="0 0 100 220" fill="none" stroke="var(--border)" strokeWidth="2">
          <circle cx="50" cy="20" r="14" />
          <line x1="50" y1="34" x2="50" y2="110" />
          <line x1="50" y1="50" x2="18" y2="100" />
          <line x1="50" y1="50" x2="82" y2="100" />
          <line x1="50" y1="110" x2="25" y2="205" />
          <line x1="50" y1="110" x2="75" y2="205" />
          <line x1="30" y1="55" x2="70" y2="55" />
        </svg>

        <div className="equipment-slot-list">{RIGHT_SLOTS.map(renderSlotButton)}</div>
      </div>

      {activeSlot && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4>{activeSlot.label}</h4>
          {character.items.length === 0 && <p className="muted">Сначала добавьте предметы на вкладке «Снаряжение».</p>}
          {character.items.map((item) => (
            <label key={item.id} className="toggle" style={{ display: 'flex', marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={idsInSlot(activeSlot.key).includes(item.id)}
                onChange={() => toggleItemInSlot(activeSlot.key, item.id)}
              />
              {item.name || 'Без названия'}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
