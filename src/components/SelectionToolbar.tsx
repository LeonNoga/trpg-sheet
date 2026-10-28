import { useEffect, useRef, useState } from 'react';
import { createOcrSession, reparsedItem } from '../utils/ocrCards';
import { reinsertRemoved } from '../utils/undoHelpers';
import { useUndo } from '../state/useUndo';
import type { OcrSession } from '../utils/ocrCards';
import type { EquipItem } from '../types';

interface Props {
  /** Все записи списка (не только показанные) — по ним применяется результат. */
  allItems: EquipItem[];
  /** Записи, видимые сейчас с учётом фильтров: «выбрать все» действует на них. */
  visibleItems: EquipItem[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  onChangeAll: (next: EquipItem[]) => void;
  /** Развернуть / свернуть все записи ленты. */
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

interface ReparseState {
  running: boolean;
  done: number;
  total: number;
  skipped: string[];
  failed: string[];
}

/** Панель массовых действий над выбранными чекбоксами карточками: удалить и перепарсить (повторный OCR по фото). */
export function SelectionToolbar({ allItems, visibleItems, selected, onSelectedChange, onChangeAll, onExpandAll, onCollapseAll }: Props) {
  const [state, setState] = useState<ReparseState | null>(null);
  const cancelRef = useRef(false);
  const { showUndo } = useUndo();
  // Распознавание идёт долго; результат применяем к свежему списку, а не к тому, что был при запуске.
  const latest = useRef({ allItems, onChangeAll });
  useEffect(() => {
    latest.current = { allItems, onChangeAll };
  });

  if (allItems.length === 0) return null;

  const visibleIds = visibleItems.map((i) => i.id);
  const selectedCount = allItems.filter((i) => selected.has(i.id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const running = !!state?.running;

  function toggleAllVisible() {
    const next = new Set(selected);
    if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    onSelectedChange(next);
  }

  function deleteSelected() {
    if (!confirm(`Удалить выбранные записи: ${selectedCount}?`)) return;
    const removed = latest.current.allItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => selected.has(item.id));
    latest.current.onChangeAll(latest.current.allItems.filter((i) => !selected.has(i.id)));
    onSelectedChange(new Set());
    showUndo(`Удалено записей: ${removed.length}`, () =>
      latest.current.onChangeAll(reinsertRemoved(latest.current.allItems, removed)),
    );
  }

  async function reparseSelected() {
    const targets = allItems.filter((i) => selected.has(i.id));
    const withImage = targets.filter((i) => i.image);
    const skipped = targets.filter((i) => !i.image).map((i) => i.name || 'Без названия');
    if (withImage.length === 0) {
      setState({ running: false, done: 0, total: 0, skipped, failed: [] });
      return;
    }
    const ok = confirm(
      `Перепарсить записей: ${withImage.length}. Текст будет заново распознан по фото, а название, редкость, уровень, ` +
        `описание, эффект и бонусы заменятся результатом — ручные правки в этих полях пропадут. Продолжить?`,
    );
    if (!ok) return;

    cancelRef.current = false;
    setState({ running: true, done: 0, total: withImage.length, skipped, failed: [] });
    const updated = new Map<string, EquipItem>();
    const failed: string[] = [];
    let session: OcrSession | null = null;
    try {
      session = await createOcrSession();
      for (const item of withImage) {
        if (cancelRef.current) break;
        try {
          updated.set(item.id, reparsedItem(item, await session.recognize(item.image!)));
        } catch (err) {
          console.error(err);
          failed.push(item.name || 'Без названия');
        }
        setState((s) => s && { ...s, done: s.done + 1, failed: [...failed] });
      }
    } catch (err) {
      console.error(err);
      failed.push('Не удалось запустить распознавание (при первом запуске нужен интернет для загрузки языка).');
    } finally {
      await session?.terminate();
      if (updated.size > 0) {
        const { allItems: current, onChangeAll: apply } = latest.current;
        apply(current.map((i) => updated.get(i.id) ?? i));
      }
      setState((s) => s && { ...s, running: false, failed: [...failed] });
    }
  }

  return (
    <div className="selection-toolbar">
      {onExpandAll && (
        <button className="btn btn-sm" onClick={onExpandAll}>
          Развернуть все
        </button>
      )}
      {onCollapseAll && (
        <button className="btn btn-sm" onClick={onCollapseAll}>
          Свернуть все
        </button>
      )}
      <label className="toggle">
        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={running} />
        Выбрать все показанные
      </label>
      <span className="muted">Выбрано: {selectedCount}</span>
      <button className="btn btn-sm" disabled={selectedCount === 0 || running} onClick={reparseSelected}>
        Перепарсить (OCR)
      </button>
      <button className="btn btn-sm btn-danger" disabled={selectedCount === 0 || running} onClick={deleteSelected}>
        Удалить выбранные
      </button>
      {selectedCount > 0 && !running && (
        <button className="btn btn-sm btn-ghost" onClick={() => onSelectedChange(new Set())}>
          Снять выбор
        </button>
      )}

      {state && (
        <div className="budget-bar" style={{ flexDirection: 'column', alignItems: 'stretch', flexBasis: '100%' }}>
          {state.running ? (
            <>
              <strong>
                Перепарсиваем: {state.done} из {state.total}
              </strong>
              <div>
                <button className="btn btn-sm" onClick={() => (cancelRef.current = true)}>
                  Остановить
                </button>
              </div>
            </>
          ) : (
            <>
              <strong>
                Готово: обновлено {state.done - state.failed.length} из {state.total}
              </strong>
              {state.skipped.length > 0 && (
                <span className="muted">Без фото (пропущены): {state.skipped.join(', ')}</span>
              )}
              {state.failed.map((f) => (
                <span className="error-text" key={f}>
                  {f}
                </span>
              ))}
              <div>
                <button className="btn btn-sm btn-ghost" onClick={() => setState(null)}>
                  Скрыть
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
