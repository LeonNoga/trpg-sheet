import { useMemo, useRef, useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { ItemCard } from './ItemCard';
import { ItemEditor } from './ItemEditor';
import { createBlankEquipItem } from '../data/defaults';
import { ALL_BONUS_KEYS, ITEM_PATH_LABELS, RARITY_LABELS, RARITY_ORDER, bonusLabel } from '../data/statsConfig';
import { exportTray, importTrayFromFile } from '../storage/exportImport';
import { BulkCardUpload } from './BulkCardUpload';
import { PasteImportButton } from './FileDialogs';
import { SelectionToolbar } from './SelectionToolbar';
import { useUndo } from '../state/UndoContext';
import { reinsertRemoved } from '../utils/undoHelpers';
import type { BonusKey, EquipItem, ItemPath, Rarity } from '../types';

type KindFilter = 'all' | 'item' | 'ability';
type RarityFilter = 'all' | 'none' | Rarity;
type PathFilter = 'all' | ItemPath;
type BonusFilter = 'all' | BonusKey;

const PATH_FILTER_ORDER: ItemPath[] = ['genetic', 'magic', 'tech', 'none'];

export function LootTray() {
  const { lootTray, updateLootTray, addToLootTray, characters, updateCharacter } = useAppData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingKind, setCreatingKind] = useState<'item' | 'ability' | null>(null);
  const [giveTarget, setGiveTarget] = useState<Record<string, string>>({});
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [pathFilter, setPathFilter] = useState<PathFilter>('all');
  const [bonusFilter, setBonusFilter] = useState<BonusFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const trayInput = useRef<HTMLInputElement>(null);
  const { showUndo } = useUndo();
  const trayRef = useRef(lootTray);
  trayRef.current = lootTray;

  const filtersActive = kindFilter !== 'all' || rarityFilter !== 'all' || pathFilter !== 'all' || bonusFilter !== 'all' || query.trim() !== '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lootTray.filter((item) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      if (rarityFilter === 'none' ? !!item.rarity : rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;
      if (pathFilter !== 'all' && (item.path ?? 'none') !== pathFilter) return false;
      if (bonusFilter !== 'all' && !item.statBonuses[bonusFilter]) return false;
      if (q && !`${item.name} ${item.category ?? ''} ${item.effect ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lootTray, kindFilter, rarityFilter, pathFilter, bonusFilter, query]);

  const bonusKeys = useMemo(
    () => ALL_BONUS_KEYS.filter((k) => lootTray.some((i) => i.statBonuses[k])),
    [lootTray],
  );

  const editingItem = editingId ? lootTray.find((i) => i.id === editingId) ?? null : null;

  function resetFilters() {
    setKindFilter('all');
    setRarityFilter('all');
    setPathFilter('all');
    setBonusFilter('all');
    setQuery('');
  }

  function saveEdited(item: EquipItem) {
    updateLootTray(lootTray.map((i) => (i.id === item.id ? { ...item, review: undefined } : i)));
    setEditingId(null);
  }

  function saveNew(item: EquipItem) {
    addToLootTray([item]);
    setCreatingKind(null);
  }

  function remove(id: string) {
    const index = lootTray.findIndex((i) => i.id === id);
    const removed = lootTray[index];
    if (!removed) return;
    updateLootTray(lootTray.filter((i) => i.id !== id));
    showUndo(`Удалено из трея: «${removed.name || 'Без названия'}»`, () =>
      updateLootTray(reinsertRemoved(trayRef.current, [{ item: removed, index }])),
    );
  }

  function giveToCharacter(item: EquipItem) {
    const target = characters.find((c) => c.id === giveTarget[item.id]);
    if (!target) return;
    // Выданный предмет попадает в инвентарь «снятым» — бонусы включаются, когда игрок его наденет.
    const copy: EquipItem = { ...item, id: crypto.randomUUID(), equipped: item.kind === 'ability' };
    updateCharacter(
      item.kind === 'ability'
        ? { ...target, abilities: [...target.abilities, copy] }
        : { ...target, items: [...target.items, copy] },
    );
  }

  async function handleImportTray(file: File | undefined) {
    if (trayInput.current) trayInput.current.value = '';
    if (!file) return;
    try {
      const incoming = await importTrayFromFile(file);
      const incomingIds = new Set(incoming.map((i) => i.id));
      const overwritten = lootTray.filter((i) => incomingIds.has(i.id)).length;
      const ok = confirm(
        `В файле записей: ${incoming.length}. Из них уже есть в трее (будут перезаписаны): ${overwritten}. Добавить?`,
      );
      if (!ok) return;
      updateLootTray([...incoming, ...lootTray.filter((i) => !incomingIds.has(i.id))]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось прочитать файл трея.');
    }
  }

  const editorForNew = creatingKind ? createBlankEquipItem(creatingKind) : null;

  return (
    <div className="card">
      <h3 className="card-title">Трей предметов и умений</h3>
      <p className="muted">
        Всё, что выпало, но ещё не роздано. Карточки можно загрузить фото пачкой — текст распознаётся и поля
        заполняются сами (проверьте результат), а весь трей переносится между устройствами файлом.
      </p>

      <div className="top-actions">
        <button className="btn" onClick={() => setCreatingKind('item')} disabled={!!creatingKind}>
          + Предмет
        </button>
        <button className="btn" onClick={() => setCreatingKind('ability')} disabled={!!creatingKind}>
          + Умение
        </button>
        <button className="btn" onClick={() => exportTray(lootTray)} disabled={lootTray.length === 0}>
          Экспорт трея
        </button>
        <button className="btn" onClick={() => trayInput.current?.click()}>
          Импорт трея
        </button>
        <PasteImportButton onFile={handleImportTray} label="Импорт текстом" />
        <input
          ref={trayInput}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => handleImportTray(e.target.files?.[0])}
        />
      </div>

      <BulkCardUpload onCard={(item) => addToLootTray([item])} getExisting={() => trayRef.current} />

      {editorForNew && (
        <ItemEditor
          item={editorForNew}
          onSave={saveNew}
          onCancel={() => setCreatingKind(null)}
          onCompanion={(extra) => addToLootTray([extra])}
        />
      )}

      <div className="tray-filters">
        <input
          className="tray-search"
          placeholder="Поиск по названию и тексту"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)}>
          <option value="all">Предметы и умения</option>
          <option value="item">Только предметы</option>
          <option value="ability">Только умения</option>
        </select>
        <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value as RarityFilter)}>
          <option value="all">Любая редкость</option>
          {RARITY_ORDER.map((r) => (
            <option key={r} value={r}>
              {RARITY_LABELS[r]}
            </option>
          ))}
          <option value="none">Редкость не указана</option>
        </select>
        <select value={pathFilter} onChange={(e) => setPathFilter(e.target.value as PathFilter)}>
          <option value="all">Любой путь</option>
          {PATH_FILTER_ORDER.map((p) => (
            <option key={p} value={p}>
              {ITEM_PATH_LABELS[p]}
            </option>
          ))}
        </select>
        {bonusKeys.length > 0 && (
          <select value={bonusFilter} onChange={(e) => setBonusFilter(e.target.value as BonusFilter)}>
            <option value="all">Любой бонус</option>
            {bonusKeys.map((k) => (
              <option key={k} value={k}>
                Бонус: {bonusLabel(k)}
              </option>
            ))}
          </select>
        )}
        {filtersActive && (
          <button className="btn btn-sm btn-ghost" onClick={resetFilters}>
            Сбросить
          </button>
        )}
      </div>
      <p className="muted">
        Показано {filtered.length} из {lootTray.length}
      </p>

      <SelectionToolbar
        allItems={lootTray}
        visibleItems={filtered}
        selected={selected}
        onSelectedChange={setSelected}
        onChangeAll={updateLootTray}
      />

      {lootTray.length === 0 && <p className="muted">Трей пуст.</p>}

      {filtered.map((item) =>
        editingItem?.id === item.id ? (
          <ItemEditor
            key={item.id}
            item={editingItem}
            onSave={saveEdited}
            onCancel={() => setEditingId(null)}
            onCompanion={(extra) => addToLootTray([extra])}
          />
        ) : (
          <div key={item.id}>
            <ItemCard
              item={item}
              showEquipToggle={false}
              onDismissReview={() => updateLootTray(lootTray.map((i) => (i.id === item.id ? { ...i, review: undefined } : i)))}
              selected={selected.has(item.id)}
              onSelect={(on) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (on) next.add(item.id);
                  else next.delete(item.id);
                  return next;
                })
              }
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
    </div>
  );
}
