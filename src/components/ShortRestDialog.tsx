import { useState } from 'react';
import { SHORT_REST_STEP_MINUTES, shortRestGains } from '../data/abilityUse';
import { PATH_RESOURCE_LABEL } from '../data/statsConfig';
import type { Character } from '../types';

interface Props {
  character: Character;
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
}

/** Короткий отдых: вводится, сколько минут отдыхал персонаж; считаются полные десятиминутки и показывается прибавка. */
export function ShortRestDialog({ character, onConfirm, onCancel }: Props) {
  const [text, setText] = useState('10');
  const minutes = Number(text);
  const gains = shortRestGains(character, minutes);
  const resourceName = PATH_RESOURCE_LABEL[character.path];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">Короткий отдых</h3>
        <p className="muted">
          За каждые полные {SHORT_REST_STEP_MINUTES} минут восстанавливается модификатор Выносливости и ресурса (
          {resourceName}), но не меньше 1. Остаток меньше десяти минут не считается.
        </p>
        <div className="field" style={{ maxWidth: 220 }}>
          <label>Сколько минут отдыхал персонаж</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={SHORT_REST_STEP_MINUTES}
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <p>
          Десятиминуток: <b>{gains.periods}</b>
          <br />
          Выносливость: <b>+{gains.stamina}</b>{' '}
          <span className="muted">(по {gains.staminaPerPeriod} за 10 минут)</span>
          <br />
          {resourceName}: <b>+{gains.resource}</b> <span className="muted">(по {gains.resourcePerPeriod} за 10 минут)</span>
        </p>
        <div className="item-actions">
          <button className="btn btn-primary" disabled={gains.periods === 0} onClick={() => onConfirm(minutes)}>
            Отдохнуть
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
