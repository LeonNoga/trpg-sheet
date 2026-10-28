import { useEffect, useRef, useState } from 'react';

/** Слово «Подсказка» под выбором редкости класса: по нажатию открывается небольшое окошко, как у характеристик. */
export function ClassHint({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="class-hint" ref={ref}>
      <button type="button" className="class-hint-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Подсказка
      </button>
      {open && (
        <div className="hover-card class-hint-card" role="note">
          {lines.map((line) => (
            <div className="hover-card-line" key={line}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
