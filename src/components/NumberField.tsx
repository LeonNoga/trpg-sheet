import { useEffect, useState } from 'react';
import type { FocusEvent, InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (value: number) => void;
};

function stripLeadingZeros(raw: string): string {
  if (raw === '' || raw === '-') return raw;
  const sign = raw.startsWith('-') ? '-' : '';
  const digits = (sign ? raw.slice(1) : raw).replace(/^0+(?=\d)/, '');
  return sign + digits;
}

/**
 * Controlled number input that doesn't get stuck showing "01" when the
 * field is cleared and retyped — plain `<input type="number" value={n}>`
 * lags a render behind the DOM's own string value on fast/mobile typing.
 */
export function NumberField({ value, onChange, onBlur, ...rest }: Props) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function handleChange(raw: string) {
    const normalized = stripLeadingZeros(raw);
    setText(normalized);
    if (normalized === '' || normalized === '-') return;
    const num = Number(normalized);
    if (!Number.isNaN(num)) onChange(num);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    if (text === '' || text === '-' || Number.isNaN(Number(text))) {
      setText(String(value));
    }
    onBlur?.(e);
  }

  return (
    <input
      type="number"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      {...rest}
    />
  );
}
