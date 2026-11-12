import { useEffect, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { describeGroupEntry } from '../data/groupLog';
import type { Group, GroupSnapshot } from '../types';

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Журнал группы: что и когда менялось — игроки, противники, бой, лут. Здоровье и инициатива, набранные подряд, сливаются. */
export function GroupLogDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  const { groupLogs } = useAppData();
  const [query, setQuery] = useState('');
  const all = [...(groupLogs[group.id] ?? [])].reverse();
  const q = query.trim().toLowerCase();
  const entries = q ? all.filter((e) => describeGroupEntry(e).toLowerCase().includes(q)) : all;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box changelog-box">
        <h3 className="card-title">Журнал группы «{group.name}»</h3>
        <p className="muted">
          Добавление и правки игроков и противников, здоровье, начало и конец боёв, состояния, лут и его выдача. Помнятся
          последние 500 записей; правки одного значения подряд сливаются в одну.
        </p>
        {all.length > 0 && (
          <input className="tray-search" placeholder="Поиск по журналу" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 8 }} />
        )}
        {all.length === 0 && <p className="muted">Пока пусто — записи появятся после первых правок.</p>}
        {all.length > 0 && entries.length === 0 && <p className="muted">Ничего не найдено.</p>}
        <div className="changelog-list">
          {entries.map((entry) => (
            <div className="changelog-row" key={entry.id}>
              <div className="changelog-main">
                <div>{describeGroupEntry(entry)}</div>
                <div className="muted">{formatTime(entry.at)}</div>
              </div>
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

/** Прежние состояния группы (снимок раз в ~15 минут правок): игроки, противники, подгруппы, бой, лут. */
export function GroupHistoryDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  const { getGroupSnapshots, restoreGroupSnapshot } = useAppData();
  const [snapshots, setSnapshots] = useState<GroupSnapshot[] | null>(null);

  useEffect(() => {
    void getGroupSnapshots(group.id).then(setSnapshots);
  }, [group.id, getGroupSnapshots]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">История группы «{group.name}»</h3>
        <p className="muted">
          Приложение само сохраняет прежние состояния группы. Возврат не теряет текущее — оно тоже попадёт в историю.
          Картинки в историю не копируются: у записей, которые остались в группе, они сохранятся.
        </p>
        {snapshots === null && <p className="muted">Загрузка…</p>}
        {snapshots?.length === 0 && <p className="muted">Пока нет сохранённых версий — они появятся после первых правок.</p>}
        {snapshots?.map((snap) => (
          <div className="history-row" key={snap.at}>
            <div>
              <b>{formatTime(snap.at)}</b>
              <div className="muted">
                Игроков {snap.members.length} · противников {snap.enemies.length} · лута {snap.loot.length}
                {snap.encounter?.active ? ' · бой шёл' : ''}
              </div>
            </div>
            <button
              className="btn btn-sm"
              onClick={() => {
                if (confirm(`Вернуть группу к версии от ${formatTime(snap.at)}? Текущее состояние сохранится в истории.`)) {
                  restoreGroupSnapshot(snap);
                  onClose();
                }
              }}
            >
              Вернуть
            </button>
          </div>
        ))}
        <div className="item-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
