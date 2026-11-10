import { useState } from 'react';
import { BonusEditor } from './BonusEditor';
import { bonusLabel } from '../data/statsConfig';
import {
  activeEffects,
  bonusSummary,
  effectRemaining,
  formatClock,
  formatRemaining,
  gameClock,
} from '../data/effects';
import type { ActiveEffect, BonusKey, Character } from '../types';

interface Props {
  character: Character;
  /** Время идёт (секунды), без расхода выносливости. */
  onAdvance: (seconds: number) => void;
  onEndCombat: () => void;
  onAddEffect: (effect: ActiveEffect) => void;
  onRemoveEffect: (id: string) => void;
}

function untilText(effect: ActiveEffect, clock: number): string {
  switch (effect.until) {
    case 'time':
      return `осталось ${formatRemaining(effectRemaining(effect, clock) ?? 0)}`;
    case 'combat':
      return 'до конца боя';
    case 'rest':
      return 'до отдыха';
    default:
      return 'до снятия';
  }
}

function TimeDialog({ character, onAdvance, onEndCombat, onClose }: Pick<Props, 'character' | 'onAdvance' | 'onEndCombat'> & { onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'1' | '60' | '3600'>('60');
  const seconds = Math.round(Number(amount.replace(',', '.')) * Number(unit));
  const valid = amount.trim() !== '' && Number.isFinite(seconds) && seconds > 0;
  const clock = gameClock(character);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">Игровое время</h3>
        <p>
          Таймер: <b>{formatClock(clock)}</b>
        </p>
        <p className="muted">
          Таймер показывает время с начала боя (или с последнего отдыха). Он идёт по «Тику боя» (15 секунд, −2
          выносливости) и по кнопкам ниже, где выносливость не тратится. «Конец боя» и любой отдых сбрасывают его в 0:00 —
          у эффектов и откатов остаётся прежнее оставшееся время.
        </p>
        <div className="quick-amounts">
          {[
            ['+10 с', 10],
            ['+30 с', 30],
            ['+1 мин', 60],
            ['+5 мин', 300],
            ['+10 мин', 600],
            ['+1 час', 3600],
          ].map(([label, value]) => (
            <button key={String(label)} type="button" className="btn btn-sm" onClick={() => onAdvance(Number(value))}>
              {label}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            placeholder="Сколько прошло"
            style={{ maxWidth: 150 }}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) {
                onAdvance(seconds);
                setAmount('');
              }
            }}
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>
            <option value="1">секунд</option>
            <option value="60">минут</option>
            <option value="3600">часов</option>
          </select>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!valid}
            onClick={() => {
              onAdvance(seconds);
              setAmount('');
            }}
          >
            Пройти
          </button>
        </div>
        <div className="item-actions">
          <button
            className="btn"
            onClick={() => {
              onEndCombat();
              onClose();
            }}
            title="Сбросить таймер, закончить эффекты «до конца боя» и откаты «раз в бой»"
          >
            🏁 Конец боя (сбросить таймер)
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

type Until = 'seconds' | 'minutes' | 'hours' | 'combat' | 'manual';

function EffectDialog({ character, onAdd, onClose }: { character: Character; onAdd: (effect: ActiveEffect) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [bonuses, setBonuses] = useState<Partial<Record<BonusKey, number>>>({});
  const [until, setUntil] = useState<Until>('minutes');
  const [amount, setAmount] = useState('1');
  const clock = gameClock(character);
  const timed = until === 'seconds' || until === 'minutes' || until === 'hours';
  const per = { seconds: 1, minutes: 60, hours: 3600 }[until as 'seconds'] ?? 0;
  const length = Math.round(Number(amount.replace(',', '.')) * per);
  const valid = name.trim() !== '' && (!timed || (Number.isFinite(length) && length > 0));

  function submit() {
    if (!valid) return;
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      bonuses: Object.fromEntries(Object.entries(bonuses).filter(([, v]) => v)),
      startedAt: clock,
      ...(timed ? { until: 'time' as const, endsAt: clock + length } : { until: until === 'combat' ? ('combat' as const) : ('manual' as const) }),
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">Добавить эффект вручную</h3>
        <p className="muted">Например, бонус от союзника или благословение мастера. Штраф вписывается со знаком «−».</p>
        <div className="field">
          <label>Название</label>
          <input value={name} autoFocus placeholder="Благословение" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Бонусы и штрафы</label>
          <BonusEditor value={bonuses} onChange={setBonuses} path={character.path} />
        </div>
        <div className="field">
          <label>Сколько действует</label>
          <div className="row">
            {timed && (
              <input
                type="number"
                inputMode="decimal"
                min={1}
                value={amount}
                style={{ maxWidth: 100 }}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
            <select value={until} onChange={(e) => setUntil(e.target.value as Until)}>
              <option value="seconds">секунд</option>
              <option value="minutes">минут</option>
              <option value="hours">часов</option>
              <option value="combat">до конца боя</option>
              <option value="manual">пока не сниму</option>
            </select>
          </div>
        </div>
        <div className="item-actions">
          <button className="btn btn-primary" disabled={!valid} onClick={submit}>
            Добавить
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

/** Строка под ресурсами: игровое время и действующие временные эффекты (бонусы и штрафы, оставшееся время). */
export function EffectsBar({ character, onAdvance, onEndCombat, onAddEffect, onRemoveEffect }: Props) {
  const [timeOpen, setTimeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const clock = gameClock(character);
  const effects = activeEffects(character);

  return (
    <div className="effects-bar">
      <button type="button" className="clock-chip" onClick={() => setTimeOpen(true)} title="Время с начала боя или последнего отдыха: нажмите, чтобы подвинуть">
        ⏱ {formatClock(clock)}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onEndCombat} title="Сбросить таймер, закончить эффекты «до конца боя» и откаты «раз в бой»">
        🏁 Конец боя
      </button>
      {effects.map((effect) => {
        const summary = bonusSummary(effect.bonuses, (k) => bonusLabel(k, character.path));
        const values = Object.values(effect.bonuses);
        const negative = values.length > 0 && values.every((v) => Number(v) < 0);
        return (
          <span
            key={effect.id}
            className={`effect-chip ${negative ? 'neg' : ''}`}
            title={`${effect.name}${summary ? `: ${summary}` : ''} — ${untilText(effect, clock)}`}
          >
            <span className="effect-name">{effect.name}</span>
            {summary && <span className="effect-bonus">{summary}</span>}
            <span className="effect-left">{untilText(effect, clock)}</span>
            <button type="button" aria-label={`Снять эффект «${effect.name}»`} onClick={() => onRemoveEffect(effect.id)}>
              ✕
            </button>
          </span>
        );
      })}
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAddOpen(true)}>
        + эффект
      </button>
      {timeOpen && <TimeDialog character={character} onAdvance={onAdvance} onEndCombat={onEndCombat} onClose={() => setTimeOpen(false)} />}
      {addOpen && <EffectDialog character={character} onAdd={onAddEffect} onClose={() => setAddOpen(false)} />}
    </div>
  );
}
