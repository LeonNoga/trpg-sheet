import { useMemo, useRef, useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { ItemCard } from './ItemCard';
import { ItemEditor } from './ItemEditor';
import { createBlankEquipItem } from '../data/defaults';
import { ITEM_PATH_LABELS, RARITY_LABELS, RARITY_ORDER } from '../data/statsConfig';
import { exportTray, importTrayFromFile } from '../storage/exportImport';
import { fileToImageDataUrl } from '../utils/file';
import { createOcrSession, itemFromCardText } from '../utils/ocrCards';
import type { OcrSession } from '../utils/ocrCards';
import type { EquipItem, ItemPath, Rarity } from '../types';

type KindFilter = 'all' | 'item' | 'ability';
type RarityFilter = 'all' | 'none' | Rarity;
type PathFilter = 'all' | ItemPath;

interface BulkState {
  running: boolean;
  done: number;
  total: number;
  current: string;
  items: number;
  abilities: number;
  problems: string[];
}

const PATH_FILTER_ORDER: ItemPath[] = ['genetic', 'magic', 'tech', 'none'];

export function LootTray() {
  const { lootTray, updateLootTray, addToLootTray, characters, updateCharacter } = useAppData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingKind, setCreatingKind] = useState<'item' | 'ability' | null>(null);
  const [giveTarget, setGiveTarget] = useState<Record<string, string>>({});
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [pathFilter, setPathFilter] = useState<PathFilter>('all');
  const [query, setQuery] = useState('');
  const [bulk, setBulk] = useState<BulkState | null>(null);
  const cancelRef = useRef(false);
  const cardsInput = useRef<HTMLInputElement>(null);
  const trayInput = useRef<HTMLInputElement>(null);

  const filtersActive = kindFilter !== 'all' || rarityFilter !== 'all' || pathFilter !== 'all' || query.trim() !== '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lootTray.filter((item) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      if (rarityFilter === 'none' ? !!item.rarity : rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;
      if (pathFilter !== 'all' && (item.path ?? 'none') !== pathFilter) return false;
      if (q && !`${item.name} ${item.category ?? ''} ${item.effect ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lootTray, kindFilter, rarityFilter, pathFilter, query]);

  const editingItem = editingId ? lootTray.find((i) => i.id === editingId) ?? null : null;

  function resetFilters() {
    setKindFilter('all');
    setRarityFilter('all');
    setPathFilter('all');
    setQuery('');
  }

  function saveEdited(item: EquipItem) {
    updateLootTray(lootTray.map((i) => (i.id === item.id ? item : i)));
    setEditingId(null);
  }

  function saveNew(item: EquipItem) {
    addToLootTray([item]);
    setCreatingKind(null);
  }

  function remove(id: string) {
    updateLootTray(lootTray.filter((i) => i.id !== id));
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

  async function handleBulkFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'));
    if (cardsInput.current) cardsInput.current.value = '';
    if (files.length === 0) return;

    cancelRef.current = false;
    setBulk({ running: true, done: 0, total: files.length, current: '', items: 0, abilities: 0, problems: [] });

    let session: OcrSession | null = null;
    try {
      session = await createOcrSession();
      for (const file of files) {
        if (cancelRef.current) break;
        setBulk((b) => b && { ...b, current: file.name });
        try {
          const image = await fileToImageDataUrl(file);
          const text = await session.recognize(image);
          const item = itemFromCardText(text, image, file.name.replace(/\.[^.]+$/, ''));
          addToLootTray([item]);
          setBulk(
            (b) =>
              b && {
                ...b,
                items: b.items + (item.kind === 'item' ? 1 : 0),
                abilities: b.abilities + (item.kind === 'ability' ? 1 : 0),
                problems: text ? b.problems : [...b.problems, `${file.name}: текст не распознан, добавлено без данных`],
              },
          );
        } catch (err) {
          console.error(err);
          setBulk((b) => b && { ...b, problems: [...b.problems, `${file.name}: не удалось обработать файл`] });
        }
        setBulk((b) => b && { ...b, done: b.done + 1 });
      }
    } catch (err) {
      console.error(err);
      setBulk(
        (b) =>
          b && {
            ...b,
            problems: [...b.problems, 'Не удалось запустить распознавание (при первом запуске нужен интернет для загрузки языка).'],
          },
      );
    } finally {
      await session?.terminate();
      setBulk((b) => b && { ...b, running: false });
    }
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
        <button className="btn btn-primary" onClick={() => cardsInput.current?.click()} disabled={bulk?.running}>
          Загрузить карточки (OCR)
        </button>
        <button className="btn" onClick={() => exportTray(lootTray)} disabled={lootTray.length === 0}>
          Экспорт трея
        </button>
        <button className="btn" onClick={() => trayInput.current?.click()}>
          Импорт трея
        </button>
        <input
          ref={cardsInput}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleBulkFiles(e.target.files)}
        />
        <input
          ref={trayInput}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => handleImportTray(e.target.files?.[0])}
        />
      </div>

      {bulk && (
        <div className="budget-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {bulk.running ? (
            <>
              <strong>
                Распознаём карточки: {bulk.done} из {bulk.total}
              </strong>
              <span className="muted">{bulk.current}</span>
              <div>
                <button className="btn btn-sm" onClick={() => (cancelRef.current = true)}>
                  Остановить
                </button>
              </div>
            </>
          ) : (
            <>
              <strong>
                Готово: добавлено предметов — {bulk.items}, умений — {bulk.abilities}
                {bulk.done < bulk.total ? ` (остановлено на ${bulk.done} из ${bulk.total})` : ''}
              </strong>
              {bulk.problems.map((p) => (
                <span className="error-text" key={p}>
                  {p}
                </span>
              ))}
              <div>
                <button className="btn btn-sm btn-ghost" onClick={() => setBulk(null)}>
                  Скрыть
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {editorForNew && (
        <ItemEditor item={editorForNew} onSave={saveNew} onCancel={() => setCreatingKind(null)} />
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
        {filtersActive && (
          <button className="btn btn-sm btn-ghost" onClick={resetFilters}>
            Сбросить
          </button>
        )}
      </div>
      <p className="muted">
        Показано {filtered.length} из {lootTray.length}
      </p>

      {lootTray.length === 0 && <p className="muted">Трей пуст.</p>}

      {filtered.map((item) =>
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
    </div>
  );
}
