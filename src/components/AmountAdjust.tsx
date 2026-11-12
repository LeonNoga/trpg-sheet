import { useState } from 'react';

interface Props {
  current: number;
  max: number;
  onChange: (value: number) => void;
}

/** Урон и лечение: вводится число, «−» вычитает (можно уйти ниже нуля), «+» прибавляет, но не выше максимума. */
export function AmountAdjust({ current, max, onChange }: Props) {
  const [text, setText] = useState('');
  const amount = Math.abs(Number(text));
  const valid = text.trim() !== '' && Number.isFinite(amount) && amount > 0;

  function apply(sign: 1 | -1) {
    if (!valid) return;
    onChange(sign === 1 ? Math.max(current, Math.min(max, current + amount)) : current - amount);
    setText('');
  }

  return (
    <div className="pool-adjust">
      <button type="button" className="btn btn-sm" disabled={!valid} onClick={() => apply(-1)} title="Нанести урон">
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={text}
        placeholder="±"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply(-1)}
        aria-label="Урон или лечение"
      />
      <button type="button" className="btn btn-sm" disabled={!valid} onClick={() => apply(1)} title="Вылечить (до максимума)">
        +
      </button>
    </div>
  );
}
