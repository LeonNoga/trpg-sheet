import { useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { ItemCard } from './ItemCard';
import { ItemEditor } from './ItemEditor';
import { createBlankEquipItem } from '../data/defaults';
import type { EquipItem } from '../types';

export function LootTray() {
  const { lootTray, updateLootTray, characters, updateCharacter } = useAppData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [giveTarget, setGiveTarget] = useState<Record<string, string>>({});

  const editingItem = editingId ? lootTray.find((i) => i.id === editingId) ?? null : null;

  function saveEdited(item: EquipItem) {
    updateLootTray(lootTray.map((i) => (i.id === item.id ? item : i)));
    setEditingId(null);
  }

  function saveNew(item: EquipItem) {
    updateLootTray([...lootTray, item]);
    setCreating(false);
  }

  function remove(id: string) {
    updateLootTray(lootTray.filter((i) => i.id !== id));
  }

  function giveToCharacter(item: EquipItem) {
    const targetId = giveTarget[item.id];
    const target = characters.find((c) => c.id === targetId);
    if (!target) return;
    const copy: EquipItem = { ...item, id: crypto.randomUUID() };
    updateCharacter({ ...target, items: [...target.items, copy] });
  }

  return (
    <div className="card">
      <h3 className="card-title">Трей лута мастера</h3>
      <p className="muted">Предметы без привязки к персонажу — что выпало, но ещё не роздано.</p>

      {lootTray.length === 0 && !creating && <p className="muted">Пусто.</p>}

      {lootTray.map((item) =>
        editingItem?.id === item.id ? (
          <ItemEditor key={item.id} item={editingItem} onSave={saveEdited} onCancel={() => setEditingId(null)} />
        ) : (
          <div key={item.id}>
            <ItemCard
              item={item}
              showEquipToggle={false}
              onToggleEquipped={() => {}}
              onEdit={() => setEditingId(item.id)}
              onDelete={() => remove(item.id)}
            />
            <div className="row" style={{ marginTop: -8, marginBottom: 10 }}>
              <select
                value={giveTarget[item.id] ?? ''}
                onChange={(e) => setGiveTarget((t) => ({ ...t, [item.id]: e.target.value }))}
              >
                <option value="">Выдать персонажу...</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.characterName || 'Без имени'}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm" disabled={!giveTarget[item.id]} onClick={() => giveToCharacter(item)}>
                Выдать
              </button>
            </div>
          </div>
        ),
      )}

      {creating && (
        <ItemEditor item={createBlankEquipItem('item')} onSave={saveNew} onCancel={() => setCreating(false)} />
      )}

      {!creating && (
        <button className="btn" onClick={() => setCreating(true)}>
          + Добавить предмет в трей
        </button>
      )}
    </div>
  );
}
