import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { ItemCard } from './ItemCard';
import type { ExpandCommand } from './ItemCard';
import { ItemEditor } from './ItemEditor';
import { createBlankEquipItem } from '../data/defaults';
import { ALL_BONUS_KEYS, ITEM_PATH_LABELS, RARITY_LABELS, RARITY_ORDER, bonusLabel } from '../data/statsConfig';
import { exportTray, importTrayFromFile } from '../storage/exportImport';
import { BulkCardUpload } from './BulkCardUpload';
import { PasteImportButton } from './FileDialogs';
import { SelectionToolbar } from './SelectionToolbar';
import { useUndo } from '../state/useUndo';
import { inGroup } from '../data/gm';
import { reinsertRemoved } from '../utils/undoHelpers';
import type { BonusKey, EquipItem, ItemPath, Rarity } from '../types';

type KindFilter = 'all' | 'item' | 'ability';
type RarityFilter = 'all' | 'none' | Rarity;
type PathFilter = 'all' | ItemPath;
type BonusFilter = 'all' | BonusKey;

const PATH_FILTER_ORDER: ItemPath[] = ['genetic', 'magic', 'tech', 'none'];

interface TrayProps {
  /** Группа, чей трей показывается: у каждой группы свой лут. */
  groupId: string;
}

export function LootTray({ groupId }: TrayProps) {
  const { lootTray: fullTray, updateLootTray: updateFullTray, addToLootTray: addToFullTray, characters, updateCharacter, groups } = useAppData();
  // Записи без группы числятся за первой. В трей группы входят только её записи; остальные при сохранении не трогаем.
  const lootTray = useMemo(() => fullTray.filter((i) => inGroup(i, groupId, groups)), [fullTray, groupId, groups]);
  const stamp = (items: EquipItem[]) => items.map((i) => ({ ...i, groupId }));
  const updateLootTray = (items: EquipItem[]) =>
    updateFullTray([...stamp(items), ...trayRefAll.current.filter((i) => !inGroup(i, groupId, groups))]);
  const addToLootTray = (items: EquipItem[]) => addToFullTray(stamp(items));
  const charactersRef = useRef(characters);
  const characterNow = (id: string) => charactersRef.current.find((c) => c.id === id);
  const recipients = characters.filter((c) => c.roster !== 'personal' && inGroup(c, groupId, groups));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingKind, setCreatingKind] = useState<'item' | 'ability' | null>(null);
  const [giveTarget, setGiveTarget] = useState<Record<string, string>>({});
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [pathFilter, setPathFilter] = useState<PathFilter>('all');
  const [bonusFilter, setBonusFilter] = useState<BonusFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expand, setExpand] = useState<ExpandCommand>({ open: false, version: 0 });
  const trayInput = useRef<HTMLInputElement>(null);
  const { showUndo } = useUndo();
  const trayRef = useRef(lootTray);
  const trayRefAll = useRef(fullTray);
  useEffect(() => {
    trayRef.current = lootTray;
    trayRefAll.current = fullTray;
    charactersRef.current = characters;
  });
  const [batchTarget, setBatchTarget] = useState('');
  const [moveTarget, setMoveTarget] = useState('');

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

  const selectedItems = lootTray.filter((i) => selected.has(i.id));

  /** Выданные предметы попадают в инвентарь «снятыми», умения — как есть; метка группы трея в карточку не переносится. */
  function giveSelected() {
    const target = characters.find((c) => c.id === batchTarget);
    if (!target || selectedItems.length === 0) return;
    const copies = selectedItems.map(({ groupId: _group, ...item }) => ({
      ...item,
      id: crypto.randomUUID(),
      equipped: item.kind === 'ability',
    }));
    updateCharacter({
      ...target,
      items: [...target.items, ...copies.filter((i) => i.kind === 'item')],
      abilities: [...target.abilities, ...copies.filter((i) => i.kind === 'ability')],
    });
    // Выданное из трея убираем — у мастера в трее остаётся то, что ещё не роздано.
    const givenIds = new Set(selectedItems.map((i) => i.id));
    updateLootTray(lootTray.filter((i) => !givenIds.has(i.id)));
    setSelected(new Set());
    showUndo(`Выдано персонажу «${target.characterName || 'Без имени'}»: ${copies.length}`, () => {
      const current = characterNow(target.id);
      if (current) {
        const ids = new Set<string>(copies.map((c) => c.id));
        updateCharacter({ ...current, items: current.items.filter((i) => !ids.has(i.id)), abilities: current.abilities.filter((i) => !ids.has(i.id)) });
      }
      updateFullTray([...stamp(selectedItems), ...trayRefAll.current]);
    });
  }

  function moveSelected() {
    if (!moveTarget || selectedItems.length === 0) return;
    const ids = new Set(selectedItems.map((i) => i.id));
    updateFullTray([...trayRefAll.current.map((i) => (ids.has(i.id) ? { ...i, groupId: moveTarget } : i))]);
    setSelected(new Set());
    setMoveTarget('');
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

      {selectedItems.length > 0 && (
        <div className="card batch-actions">
          <b>Выбрано: {selectedItems.length}</b>
          <div className="row">
            <select value={batchTarget} onChange={(e) => setBatchTarget(e.target.value)}>
              <option value="">Выдать персонажу…</option>
              {recipients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.characterName || 'Без имени'}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" disabled={!batchTarget} onClick={giveSelected}>
              Выдать выбранные
            </button>
            <button
              className="btn btn-sm"
              title="Файл с выбранными карточками для игрока: он загружает его на вкладке «Лут» у своего персонажа"
              onClick={() => void exportTray(selectedItems)}
            >
              Файл для игрока
            </button>
          </div>
          {groups.length > 1 && (
            <div className="row">
              <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                <option value="">Перенести в группу…</option>
                {groups
                  .filter((g) => g.id !== groupId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      📁 {g.name}
                    </option>
                  ))}
              </select>
              <button className="btn btn-sm" disabled={!moveTarget} onClick={moveSelected}>
                Перенести
              </button>
            </div>
          )}
        </div>
      )}

      <SelectionToolbar
        allItems={lootTray}
        visibleItems={filtered}
        selected={selected}
        onSelectedChange={setSelected}
        onChangeAll={updateLootTray}
        onExpandAll={() => setExpand((e) => ({ open: true, version: e.version + 1 }))}
        onCollapseAll={() => setExpand((e) => ({ open: false, version: e.version + 1 }))}
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
              expandCommand={expand}
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
                {recipients.map((c) => (
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
