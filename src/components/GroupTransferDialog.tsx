import { useState } from 'react';
import type { Group } from '../types';

interface Props {
  title: string;
  /** Что будет перенесено — одной строкой. */
  summary: string;
  /** Группы, в которые можно отправить (без текущей). */
  groups: Group[];
  onConfirm: (targetGroupId: string, mode: 'copy' | 'move') => void;
  onCancel: () => void;
}

/** Выбор группы и способа: копировать (оригинал остаётся — так делают шаблоны) или перенести. */
export function GroupTransferDialog({ title, summary, groups, onConfirm, onCancel }: Props) {
  const [target, setTarget] = useState(groups[0]?.id ?? '');
  const [mode, setMode] = useState<'copy' | 'move'>('copy');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">{title}</h3>
        <p className="muted">{summary}</p>
        <div className="field">
          <label>В группу</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} autoFocus>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                📁 {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="toggle">
            <input type="radio" name="transfer-mode" checked={mode === 'copy'} onChange={() => setMode('copy')} />
            Копировать — здесь остаётся, в той группе появится копия с полным здоровьем
          </label>
          <label className="toggle">
            <input type="radio" name="transfer-mode" checked={mode === 'move'} onChange={() => setMode('move')} />
            Перенести — здесь убрать (и из боя этой группы)
          </label>
        </div>
        <div className="item-actions">
          <button className="btn btn-primary" disabled={!target} onClick={() => onConfirm(target, mode)}>
            {mode === 'copy' ? 'Копировать' : 'Перенести'}
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
