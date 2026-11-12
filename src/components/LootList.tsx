import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { ItemCard } from './ItemCard';
import type { ExpandCommand } from './ItemCard';
import { ItemEditor } from './ItemEditor';
import { createBlankEquipItem } from '../data/defaults';
import { ALL_BONUS_KEYS, ITEM_PATH_LABELS, RARITY_LABELS, RARITY_ORDER, bonusLabel } from '../data/statsConfig';
import { exportTray, importTrayFromFile, trayFileText } from '../storage/exportImport';
import { saveImageFiles, showTextToCopy } from '../storage/saveFile';
import { BulkCardUpload } from './BulkCardUpload';
import { PasteImportButton } from './FileDialogs';
import { SelectionToolbar } from './SelectionToolbar';
import { MasterImages } from './MasterImages';
import { useUndo } from '../state/useUndo';
import { inGroup } from '../data/gm';
import { reinsertRemoved } from '../utils/undoHelpers';
import type { BonusKey, EquipItem, ItemPath, Rarity } from '../types';

type KindFilter = 'all' | 'item' | 'ability';
type RarityFilter = 'all' | 'none' | Rarity;
type PathFilter = 'all' | ItemPath;
type BonusFilter = 'all' | BonusKey;
type GivenFilter = 'all' | 'given' | 'free';
type SortMode = 'stored' | 'new' | 'old';

const PATH_FILTER_ORDER: ItemPath[] = ['genetic', 'magic', 'tech', 'none'];
const DAY_MS = 24 * 3600 * 1000;
const currentTime = () => Date.now();

const formatDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'дата не указана');
const dateInputValue = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const startOfDay = (value: string) => new Date(`${value}T00:00:00`).getTime();
const endOfDay = (value: string) => new Date(`${value}T23:59:59.999`).getTime();

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bytes = atob(body);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type });
}

interface Props {
  /** group — лут выбранной группы; master — общий лут мастера (с хранилищем картинок). */
  scope: 'group' | 'master';
  groupId?: string;
}

/** Лут: записи с фильтрами (в том числе по дате добавления), массовые действия и отправка игрокам файлом, текстом или картинками. */
export function LootList({ scope, groupId = '' }: Props) {
  const {
    lootTray: fullTray,
    updateLootTray: updateFullTray,
    masterLoot,
    updateMasterLoot,
    groups,
    members,
  } = useAppData();
  const isMaster = scope === 'master';

  const items = useMemo(
    () => (isMaster ? masterLoot : fullTray).filter((i) => inGroup(i, groupId, groups)),
    [isMaster, masterLoot, fullTray, groupId, groups],
  );
  const latest = useRef({ items, fullTray, masterLoot });
  useEffect(() => {
    latest.current = { items, fullTray, masterLoot };
  });

  const stamp = (list: EquipItem[]) => list.map((i) => ({ ...i, groupId }));
  /** Заменяет записи этого лута целиком; записи других групп не трогает. */
  const setItems = (next: EquipItem[]) =>
    isMaster
      ? updateMasterLoot([...stamp(next), ...latest.current.masterLoot.filter((i) => !inGroup(i, groupId, groups))])
      : updateFullTray([...stamp(next), ...latest.current.fullTray.filter((i) => !inGroup(i, groupId, groups))]);
  const addItems = (added: EquipItem[]) => setItems([...added, ...latest.current.items]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingKind, setCreatingKind] = useState<'item' | 'ability' | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [pathFilter, setPathFilter] = useState<PathFilter>('all');
  const [bonusFilter, setBonusFilter] = useState<BonusFilter>('all');
  const [givenFilter, setGivenFilter] = useState<GivenFilter>('all');
  const [sort, setSort] = useState<SortMode>('stored');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expand, setExpand] = useState<ExpandCommand>({ open: false, version: 0 });
  const [recipient, setRecipient] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  const [masterTarget, setMasterTarget] = useState('');
  const trayInput = useRef<HTMLInputElement>(null);
  const { showUndo } = useUndo();

  const filtersActive =
    kindFilter !== 'all' ||
    rarityFilter !== 'all' ||
    pathFilter !== 'all' ||
    bonusFilter !== 'all' ||
    givenFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    query.trim() !== '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? startOfDay(dateFrom) : null;
    const to = dateTo ? endOfDay(dateTo) : null;
    const list = items.filter((item) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      if (rarityFilter === 'none' ? !!item.rarity : rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;
      if (pathFilter !== 'all' && (item.path ?? 'none') !== pathFilter) return false;
      if (bonusFilter !== 'all' && !item.statBonuses[bonusFilter]) return false;
      if (givenFilter === 'given' && !item.givenTo) return false;
      if (givenFilter === 'free' && item.givenTo) return false;
      if ((from !== null || to !== null) && !item.addedAt) return false;
      if (from !== null && (item.addedAt ?? 0) < from) return false;
      if (to !== null && (item.addedAt ?? 0) > to) return false;
      if (q && !`${item.name} ${item.category ?? ''} ${item.effect ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === 'stored') return list;
    return [...list].sort((a, b) => (sort === 'new' ? (b.addedAt ?? 0) - (a.addedAt ?? 0) : (a.addedAt ?? Infinity) - (b.addedAt ?? Infinity)));
  }, [items, kindFilter, rarityFilter, pathFilter, bonusFilter, givenFilter, dateFrom, dateTo, query, sort]);

  const bonusKeys = useMemo(() => ALL_BONUS_KEYS.filter((k) => items.some((i) => i.statBonuses[k])), [items]);
  const editingItem = editingId ? items.find((i) => i.id === editingId) ?? null : null;
  const selectedItems = items.filter((i) => selected.has(i.id));
  const groupMembers = members.filter((m) => inGroup(m, groupId, groups));

  function resetFilters() {
    setKindFilter('all');
    setRarityFilter('all');
    setPathFilter('all');
    setBonusFilter('all');
    setGivenFilter('all');
    setDateFrom('');
    setDateTo('');
    setQuery('');
  }

  function lastDays(days: number) {
    const now = currentTime();
    setDateFrom(dateInputValue(now - (days - 1) * DAY_MS));
    setDateTo(dateInputValue(now));
  }

  function saveEdited(item: EquipItem) {
    setItems(items.map((i) => (i.id === item.id ? { ...item, review: undefined } : i)));
    setEditingId(null);
  }

  function saveNew(item: EquipItem) {
    addItems([item]);
    setCreatingKind(null);
  }

  function remove(id: string) {
    const index = items.findIndex((i) => i.id === id);
    const removed = items[index];
    if (!removed) return;
    setItems(items.filter((i) => i.id !== id));
    showUndo(`Удалено из лута: «${removed.name || 'Без названия'}»`, () =>
      setItems(reinsertRemoved(latest.current.items, [{ item: removed, index }])),
    );
  }

  async function handleImportTray(file: File | undefined) {
    if (trayInput.current) trayInput.current.value = '';
    if (!file) return;
    try {
      const incoming = await importTrayFromFile(file);
      const incomingIds = new Set(incoming.map((i) => i.id));
      const overwritten = items.filter((i) => incomingIds.has(i.id)).length;
      if (!confirm(`В файле записей: ${incoming.length}. Из них уже есть (будут перезаписаны): ${overwritten}. Добавить?`)) return;
      setItems([...incoming, ...items.filter((i) => !incomingIds.has(i.id))]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось прочитать файл лута.');
    }
  }

  // ----- отправка игрокам -----

  function sendAsFile() {
    void exportTray(selectedItems);
  }

  function sendAsText() {
    showTextToCopy(
      'loot-for-players.json',
      trayFileText(selectedItems),
      'Текст для игроков',
      'Скопируйте текст и отправьте игрокам (в чат, Telegram). Игрок на вкладке «Лут» своего персонажа нажимает «Вставить текстом» рядом с «Загрузить файл от мастера» — и карточки попадают к нему в инвентарь.',
    );
  }

  async function sendAsImages() {
    const withImage = selectedItems.filter((i) => i.image);
    if (withImage.length === 0) {
      alert('У выбранных записей нет фото карточек.');
      return;
    }
    const files = withImage.map((i, index) => ({
      fileName: `${String(index + 1).padStart(2, '0')}-${(i.name || 'card').replace(/[\\/:*?"<>|]+/g, '_')}.png`,
      blob: dataUrlToBlob(i.image!),
    }));
    await saveImageFiles(files);
  }

  function markGiven() {
    let name = recipient;
    if (name === '__other') name = prompt('Кому выдано? (имя игрока)')?.trim() ?? '';
    if (!name) return;
    const ids = new Set(selectedItems.map((i) => i.id));
    setItems(items.map((i) => (ids.has(i.id) ? { ...i, givenTo: name, givenAt: currentTime() } : i)));
  }

  function clearGiven() {
    const ids = new Set(selectedItems.map((i) => i.id));
    setItems(items.map((i) => (ids.has(i.id) ? { ...i, givenTo: undefined, givenAt: undefined } : i)));
  }

  /** Лут мастера → лут группы: копия (оригинал остаётся в общем луте) или перенос. */
  function toGroup(move: boolean) {
    if (!targetGroup || selectedItems.length === 0) return;
    const now = currentTime();
    const copies = selectedItems.map((i) => ({ ...i, id: crypto.randomUUID(), groupId: targetGroup, addedAt: now, givenTo: undefined, givenAt: undefined }));
    const ids = new Set(selectedItems.map((i) => i.id));
    updateFullTray([...copies, ...latest.current.fullTray]);
    if (move) setItems(items.filter((i) => !ids.has(i.id)));
    setSelected(new Set());
    setTargetGroup('');
  }

  /** Лут мастера этой группы → лут мастера другой группы: копия или перенос. */
  function toOtherMaster(move: boolean) {
    if (!masterTarget || selectedItems.length === 0) return;
    const now = currentTime();
    const copies = selectedItems.map((i) => ({ ...i, id: crypto.randomUUID(), groupId: masterTarget, addedAt: now, givenTo: undefined, givenAt: undefined }));
    const ids = new Set(selectedItems.map((i) => i.id));
    const rest = move ? latest.current.masterLoot.filter((i) => !ids.has(i.id)) : latest.current.masterLoot;
    updateMasterLoot([...copies, ...rest]);
    setSelected(new Set());
    setMasterTarget('');
  }

  /** Лут группы → другая группа. */
  function moveToGroup() {
    if (!targetGroup || selectedItems.length === 0) return;
    const ids = new Set(selectedItems.map((i) => i.id));
    updateFullTray(latest.current.fullTray.map((i) => (ids.has(i.id) ? { ...i, groupId: targetGroup } : i)));
    setSelected(new Set());
    setTargetGroup('');
  }

  const editorForNew = creatingKind ? createBlankEquipItem(creatingKind) : null;
  const imagesCount = selectedItems.filter((i) => i.image).length;
  const otherGroups = groups.filter((g) => g.id !== groupId);

  return (
    <div>
      <div className="card">
        <h3 className="card-title">{isMaster ? 'Лут мастера' : 'Лут группы'}</h3>
        <p className="muted">
          {isMaster
            ? 'Запас мастера под эту команду: карточки и картинки, которые вы готовите заранее. У каждой группы он свой. Отсюда записи можно копировать или переносить в лут группы или в лут мастера другой группы и отправлять игрокам.'
            : 'Всё, что выпало этой группе, но ещё не роздано. Карточки можно загрузить фото пачкой — текст распознаётся и поля заполняются сами (проверьте результат). У каждой записи есть дата добавления.'}
        </p>

        <div className="top-actions">
          <button className="btn" onClick={() => setCreatingKind('item')} disabled={!!creatingKind}>
            + Предмет
          </button>
          <button className="btn" onClick={() => setCreatingKind('ability')} disabled={!!creatingKind}>
            + Умение
          </button>
          <button className="btn" onClick={() => void exportTray(items)} disabled={items.length === 0}>
            Экспорт всего
          </button>
          <button className="btn" onClick={() => trayInput.current?.click()}>
            Импорт файла
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

        <BulkCardUpload onCard={(item) => addItems([item])} getExisting={() => latest.current.items} />

        {editorForNew && (
          <ItemEditor item={editorForNew} onSave={saveNew} onCancel={() => setCreatingKind(null)} onCompanion={(extra) => addItems([extra])} />
        )}

        <div className="tray-filters">
          <input className="tray-search" placeholder="Поиск по названию и тексту" value={query} onChange={(e) => setQuery(e.target.value)} />
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
          {!isMaster && (
            <select value={givenFilter} onChange={(e) => setGivenFilter(e.target.value as GivenFilter)}>
              <option value="all">Выданные и нет</option>
              <option value="free">Ещё не выданы</option>
              <option value="given">Уже выданы</option>
            </select>
          )}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="stored">Как добавлялись</option>
            <option value="new">Сначала новые</option>
            <option value="old">Сначала старые</option>
          </select>
          {filtersActive && (
            <button className="btn btn-sm btn-ghost" onClick={resetFilters}>
              Сбросить
            </button>
          )}
        </div>
        <div className="tray-filters date-filter">
          <span className="muted">Добавлено:</span>
          <label className="date-field">
            с <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="date-field">
            по <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button className="btn btn-sm btn-ghost" onClick={() => lastDays(1)}>
            Сегодня
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => lastDays(7)}>
            7 дней
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => lastDays(30)}>
            30 дней
          </button>
        </div>
        <p className="muted">
          Показано {filtered.length} из {items.length}
        </p>

        {selectedItems.length > 0 && (
          <div className="card batch-actions">
            <b>Выбрано: {selectedItems.length}</b>
            <div className="row">
              <span className="muted">Отправить игрокам:</span>
              <button className="btn btn-sm" onClick={sendAsFile} title="Файл JSON: игрок загружает его на вкладке «Лут» у своего персонажа">
                Файлом
              </button>
              <button className="btn btn-sm" onClick={sendAsText} title="Текст, который можно вставить в чат; игрок вставляет его в приложении">
                Текстом
              </button>
              <button className="btn btn-sm" disabled={imagesCount === 0} onClick={() => void sendAsImages()} title="Фото карточек: игрок распознаёт их у себя">
                Картинками ({imagesCount})
              </button>
            </div>
            {!isMaster && (
              <div className="row">
                <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
                  <option value="">Отметить выданным…</option>
                  {groupMembers.map((m) => (
                    <option key={m.id} value={m.name || m.playerName}>
                      {m.name || m.playerName || 'Без имени'}
                    </option>
                  ))}
                  <option value="__other">Другое имя…</option>
                </select>
                <button className="btn btn-sm" disabled={!recipient} onClick={markGiven}>
                  Выдано
                </button>
                <button className="btn btn-sm btn-ghost" onClick={clearGiven}>
                  Снять отметку
                </button>
              </div>
            )}
            {isMaster && groups.length > 0 && (
              <div className="row">
                <select value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)}>
                  <option value="">В лут группы (не мастера)…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      📁 {g.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm" disabled={!targetGroup} onClick={() => toGroup(false)} title="В луте мастера запись остаётся">
                  Копировать
                </button>
                <button className="btn btn-sm" disabled={!targetGroup} onClick={() => toGroup(true)}>
                  Переместить
                </button>
              </div>
            )}
            {isMaster && otherGroups.length > 0 && (
              <div className="row">
                <select value={masterTarget} onChange={(e) => setMasterTarget(e.target.value)}>
                  <option value="">В лут мастера другой группы…</option>
                  {otherGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      📁 {g.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm" disabled={!masterTarget} onClick={() => toOtherMaster(false)} title="Здесь запись остаётся">
                  Копировать
                </button>
                <button className="btn btn-sm" disabled={!masterTarget} onClick={() => toOtherMaster(true)}>
                  Переместить
                </button>
              </div>
            )}
            {!isMaster && otherGroups.length > 0 && (
              <div className="row">
                <select value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)}>
                  <option value="">Перенести в другую группу…</option>
                  {otherGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      📁 {g.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm" disabled={!targetGroup} onClick={moveToGroup}>
                  Перенести
                </button>
              </div>
            )}
          </div>
        )}

        <SelectionToolbar
          allItems={items}
          visibleItems={filtered}
          selected={selected}
          onSelectedChange={setSelected}
          onChangeAll={setItems}
          onExpandAll={() => setExpand((e) => ({ open: true, version: e.version + 1 }))}
          onCollapseAll={() => setExpand((e) => ({ open: false, version: e.version + 1 }))}
        />

        {items.length === 0 && <p className="muted">Пока пусто.</p>}

        {filtered.map((item) =>
          editingItem?.id === item.id ? (
            <ItemEditor key={item.id} item={editingItem} onSave={saveEdited} onCancel={() => setEditingId(null)} onCompanion={(extra) => addItems([extra])} />
          ) : (
            <div key={item.id}>
              <ItemCard
                item={item}
                showEquipToggle={false}
                expandCommand={expand}
                onDismissReview={() => setItems(items.map((i) => (i.id === item.id ? { ...i, review: undefined } : i)))}
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
              <div className="loot-meta muted">
                📅 {formatDate(item.addedAt)}
                {item.givenTo && <span className="given-tag">выдано: {item.givenTo}</span>}
              </div>
            </div>
          ),
        )}
      </div>

      {isMaster && <MasterImages groupId={groupId} />}
    </div>
  );
}
