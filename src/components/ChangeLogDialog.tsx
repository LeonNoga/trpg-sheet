import { useState } from 'react';
import { canRevert, describeEntry } from '../data/changeLog';
import type { ChangeEntry, Character } from '../types';

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

interface Props {
  character: Character;
  /** Отменяет запись (возвращает значение «до»). */
  onRevert: (entry: ChangeEntry) => void;
  onClose: () => void;
}

/** Журнал изменений: что и когда менялось в карточке (характеристики, уровни, снаряжение, умения, очки развития). */
export function ChangeLogDialog({ character, onRevert, onClose }: Props) {
  const [query, setQuery] = useState('');
  const all = [...(character.changeLog ?? [])].reverse();
  const q = query.trim().toLowerCase();
  const entries = q ? all.filter((e) => describeEntry(e).toLowerCase().includes(q)) : all;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box changelog-box">
        <h3 className="card-title">Журнал изменений</h3>
        <p className="muted">
          Что менялось в карточке: характеристики, навыки, уровни, снаряжение, умения, очки развития. Расход здоровья,
          выносливости и ресурса в игре не записывается. Помнятся последние {300} записей; журнал едет вместе с файлом JSON.
          «Отменить» доступно для числовых правок, пока значение не менялось после них.
        </p>
        {all.length > 0 && (
          <input
            className="tray-search"
            placeholder="Поиск по журналу"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 8 }}
          />
        )}
        {all.length === 0 && <p className="muted">Пока пусто — записи появятся после первых правок.</p>}
        {all.length > 0 && entries.length === 0 && <p className="muted">Ничего не найдено.</p>}
        <div className="changelog-list">
          {entries.map((entry) => (
            <div className="changelog-row" key={entry.id}>
              <div className="changelog-main">
                <div>{describeEntry(entry)}</div>
                <div className="muted">
                  {formatTime(entry.at)} · ур. {entry.lv}
                </div>
              </div>
              {canRevert(character, entry) && (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    if (confirm(`Отменить: ${describeEntry(entry)}?`)) onRevert(entry);
                  }}
                >
                  Отменить
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="item-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
