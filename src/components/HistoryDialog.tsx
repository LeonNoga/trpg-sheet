import { useEffect, useState } from 'react';
import { useAppData } from '../state/useAppData';
import type { Snapshot } from '../storage/db';
import type { Character } from '../types';

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Прежние версии карточки (снимок делается раз в ~15 минут правок и перед перезаписью импортом/копией). */
export function HistoryDialog({ character, onClose }: { character: Character; onClose: () => void }) {
  const { getSnapshots, restoreSnapshot } = useAppData();
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);

  useEffect(() => {
    void getSnapshots(character.id).then(setSnapshots);
  }, [character.id, getSnapshots]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">История версий</h3>
        <p className="muted">
          Приложение само сохраняет прежние состояния карточки. Возврат не теряет текущую версию — она тоже попадёт в
          историю. Фото карточек и портрет в историю не копируются: у записей, которые остались в карточке, они сохранятся.
        </p>
        {snapshots === null && <p className="muted">Загрузка…</p>}
        {snapshots?.length === 0 && <p className="muted">Пока нет сохранённых версий — они появятся после первых правок.</p>}
        {snapshots?.map((snap) => (
          <div className="history-row" key={snap.at}>
            <div>
              <b>{formatTime(snap.at)}</b>
              <div className="muted">
                Ур. {snap.character.level} · предметов {snap.character.items.length} · умений {snap.character.abilities.length}
              </div>
            </div>
            <button
              className="btn btn-sm"
              onClick={() => {
                if (confirm(`Вернуть карточку к версии от ${formatTime(snap.at)}? Текущее состояние сохранится в истории.`)) {
                  restoreSnapshot(snap);
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
