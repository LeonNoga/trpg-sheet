import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { modifier } from '../data/formulas';
import type { BonusSource, DerivedBreakdown } from '../data/formulas';

interface Props {
  card: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Оболочка с всплывающей карточкой: на компьютере карточка появляется при наведении, на телефоне —
 * по нажатию на сам блок (не на поля ввода и кнопки внутри); повторное нажатие или нажатие вне блока закрывает.
 */
export function HoverCard({ card, children, className }: Props) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [pinned]);

  return (
    <div
      ref={ref}
      className={`hover-wrap ${className ?? ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, select, button, textarea, label')) return;
        setPinned((p) => !p);
      }}
    >
      {children}
      {(hover || pinned) && (
        <div className="hover-card" role="tooltip">
          {card}
        </div>
      )}
    </div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function SourceList({ items, empty }: { items: BonusSource[]; empty?: string }) {
  if (items.length === 0) return empty ? <div className="hover-card-empty">{empty}</div> : null;
  return (
    <ul className="hover-card-sources">
      {items.map((s, i) => (
        <li key={i}>
          <span>{s.name}</span>
          <b className={s.value < 0 ? 'neg' : 'pos'}>{signed(s.value)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Характеристика тремя блоками, как на бумажной карточке: база + предметы = итог, и что это даёт в модификаторе. */
export function StatBreakdownCard({ label, base, sources }: { label: string; base: number; sources: BonusSource[] }) {
  const itemsTotal = sources.reduce((s, x) => s + x.value, 0);
  const total = base + itemsTotal;
  const mod = modifier(total);
  return (
    <>
      <div className="hover-card-title">{label}</div>
      <div className="hover-card-blocks">
        <div>
          <span>{base}</span>
          <small>база</small>
        </div>
        <i>+</i>
        <div>
          <span className={itemsTotal < 0 ? 'neg' : undefined}>{itemsTotal}</span>
          <small>предметы</small>
        </div>
        <i>=</i>
        <div>
          <span>{total}</span>
          <small>итого</small>
        </div>
      </div>
      <div className="hover-card-line">
        Модификатор: <b>{signed(mod)}</b>
      </div>
      <SourceList items={sources} empty="Предметы бонусов не дают" />
    </>
  );
}

/** Показатель по слагаемым формулы и предметам, у которых есть бонус именно к нему (в т.ч. штрафы). */
export function DerivedBreakdownCard({ label, breakdown }: { label: string; breakdown: DerivedBreakdown }) {
  return (
    <>
      <div className="hover-card-title">{label}</div>
      <ul className="hover-card-sources">
        {breakdown.parts.map((p, i) => (
          <li key={p.label}>
            <span>{p.label}</span>
            <b>{i === 0 ? p.value : signed(p.value)}</b>
          </li>
        ))}
      </ul>
      {breakdown.note && <div className="hover-card-note">{breakdown.note}</div>}
      {breakdown.items.length > 0 && <div className="hover-card-sub">Предметы</div>}
      <SourceList items={breakdown.items} />
      <div className="hover-card-line">
        Итого: <b>{breakdown.total}</b>
      </div>
    </>
  );
}

