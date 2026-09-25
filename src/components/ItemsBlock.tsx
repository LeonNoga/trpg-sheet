import { useState } from 'react';
import { ItemCard } from './ItemCard';
import { ItemEditor } from './ItemEditor';
import { createBlankEquipItem } from '../data/defaults';
import type { EquipItem, Path } from '../types';

interface Props {
  title: string;
  kind: 'item' | 'ability';
  items: EquipItem[];
  path?: Path;
  onChange: (items: EquipItem[]) => void;
}

export function ItemsBlock({ title, kind, items, path, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const editingItem = editingId ? items.find((i) => i.id === editingId) ?? null : null;

  function saveEdited(item: EquipItem) {
    onChange(items.map((i) => (i.id === item.id ? item : i)));
    setEditingId(null);
  }

  function saveNew(item: EquipItem) {
    onChange([...items, item]);
    setCreating(false);
  }

  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  function toggleEquipped(id: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, equipped: !i.equipped } : i)));
  }

  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      {items.length === 0 && !creating && <p className="muted">Пока пусто.</p>}

      {items.map((item) =>
        editingItem?.id === item.id ? (
          <ItemEditor key={item.id} item={editingItem} path={path} onSave={saveEdited} onCancel={() => setEditingId(null)} />
        ) : (
          <ItemCard
            key={item.id}
            item={item}
            path={path}
            showEquipToggle={kind === 'item'}
            onToggleEquipped={() => toggleEquipped(item.id)}
            onEdit={() => setEditingId(item.id)}
            onDelete={() => remove(item.id)}
          />
        ),
      )}

      {creating && (
        <ItemEditor item={createBlankEquipItem(kind)} path={path} onSave={saveNew} onCancel={() => setCreating(false)} />
      )}

      {!creating && (
        <button className="btn" onClick={() => setCreating(true)}>
          + {kind === 'item' ? 'Добавить предмет' : 'Добавить умение'}
        </button>
      )}
    </div>
  );
}
