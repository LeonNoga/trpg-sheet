import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ItemCard } from './ItemCard';
import { SelectionToolbar } from './SelectionToolbar';
import { ItemEditor } from './ItemEditor';
import { ItemFilterBar } from './ItemFilterBar';
import { EMPTY_ITEM_FILTERS, applyItemFilters } from '../utils/itemFilters';
import type { ItemFilterState } from '../utils/itemFilters';
import { createBlankEquipItem } from '../data/defaults';
import { useUndo } from '../state/useUndo';
import { reinsertRemoved } from '../utils/undoHelpers';
import type { EquipItem, Path } from '../types';

interface Props {
  title: string;
  kind: 'item' | 'ability';
  items: EquipItem[];
  path?: Path;
  onChange: (items: EquipItem[]) => void;
  addLabel: string;
  emptyText: string;
  /** Дополнительные элементы над списком (например, массовая загрузка карточек). */
  toolbar?: ReactNode;
  /** Вторая половина артефакта (умение/предмет) — добавляется в другой список персонажа. */
  onCompanion?: (item: EquipItem) => void;
  /** Дополнительный блок под каждой карточкой. */
  cardExtra?: (item: EquipItem) => ReactNode;
}

export function ItemsBlock({ title, kind, items, path, onChange, addLabel, emptyText, toolbar, onCompanion, cardExtra }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState<ItemFilterState>(EMPTY_ITEM_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { showUndo } = useUndo();
  // Актуальный список для отмены: к моменту нажатия «Отменить» он мог измениться.
  const itemsRef = useRef(items);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    itemsRef.current = items;
    onChangeRef.current = onChange;
  });

  const visible = useMemo(() => applyItemFilters(items, filters), [items, filters]);
  const editingItem = editingId ? items.find((i) => i.id === editingId) ?? null : null;

  function saveEdited(item: EquipItem) {
    onChange(items.map((i) => (i.id === item.id ? { ...item, review: undefined } : i)));
    setEditingId(null);
  }

  function saveNew(item: EquipItem) {
    onChange([...items, item]);
    setCreating(false);
  }

  function remove(id: string) {
    const index = items.findIndex((i) => i.id === id);
    const removed = items[index];
    if (!removed) return;
    onChange(items.filter((i) => i.id !== id));
    showUndo(`Удалено: «${removed.name || 'Без названия'}»`, () =>
      onChangeRef.current(reinsertRemoved(itemsRef.current, [{ item: removed, index }])),
    );
  }

  function toggleSelected(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  function toggleEquipped(id: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, equipped: !i.equipped } : i)));
  }

  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      {!creating && (
        <div className="top-actions">
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            {addLabel}
          </button>
        </div>
      )}
      {creating && (
        <ItemEditor
          item={createBlankEquipItem(kind)}
          path={path}
          onSave={saveNew}
          onCancel={() => setCreating(false)}
          onCompanion={onCompanion}
        />
      )}
      {toolbar}

      <ItemFilterBar
        items={items}
        state={filters}
        onChange={setFilters}
        shownCount={visible.length}
        path={path}
        gear={kind === 'item'}
      />

      <SelectionToolbar
        allItems={items}
        visibleItems={visible}
        selected={selected}
        onSelectedChange={setSelected}
        onChangeAll={onChange}
      />

      {items.length === 0 && !creating && <p className="muted">{emptyText}</p>}

      {visible.map((item) =>
        editingItem?.id === item.id ? (
          <ItemEditor
            key={item.id}
            item={editingItem}
            path={path}
            onSave={saveEdited}
            onCancel={() => setEditingId(null)}
            onCompanion={onCompanion}
          />
        ) : (
          <ItemCard
            key={item.id}
            item={item}
            path={path}
            showEquipToggle={kind === 'item'}
            selected={selected.has(item.id)}
            onSelect={(on) => toggleSelected(item.id, on)}
            onToggleEquipped={() => toggleEquipped(item.id)}
            extra={cardExtra?.(item)}
            onDismissReview={() => onChange(items.map((i) => (i.id === item.id ? { ...i, review: undefined } : i)))}
            onEdit={() => setEditingId(item.id)}
            onDelete={() => remove(item.id)}
          />
        ),
      )}
    </div>
  );
}
