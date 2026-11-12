import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface Props {
  /** Что показывается на странице (кнопка, значок, миниатюра). */
  children: ReactNode;
  /** Содержимое окошка. */
  panel: ReactNode;
  className?: string;
  title?: string;
}

/**
 * Окошко с подробностями: при наведении мыши показывается рядом (сверху или снизу — где хватает места, всегда в пределах
 * экрана), по нажатию закрепляется (так работает на телефоне) и закрывается нажатием снаружи или Escape.
 */
export function FloatingPanel({ children, panel, className, title }: Props) {
  const anchor = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;

  useEffect(() => {
    if (!pinned) return;
    const close = (e: Event) => {
      if (!anchor.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node)) setPinned(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [pinned]);

  useLayoutEffect(() => {
    const pop = popRef.current;
    const el = anchor.current;
    if (!open || !pop || !el) return;
    const place = () => {
      const a = el.getBoundingClientRect();
      const w = pop.offsetWidth;
      const h = pop.offsetHeight;
      const gap = 6;
      const margin = 8;
      const below = window.innerHeight - a.bottom - gap - margin;
      const above = a.top - gap - margin;
      let top: number;
      if (h <= below) top = a.bottom + gap;
      else if (h <= above) top = a.top - gap - h;
      else top = below >= above ? a.bottom + gap : a.top - gap - h;
      top = Math.min(Math.max(top, margin), Math.max(margin, window.innerHeight - h - margin));
      const left = Math.min(Math.max(a.left, margin), Math.max(margin, window.innerWidth - w - margin));
      pop.style.top = `${top}px`;
      pop.style.left = `${left}px`;
      pop.style.visibility = 'visible';
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(pop);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  return (
    <span
      ref={anchor}
      className={`floating-anchor ${className ?? ''}`}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setPinned((p) => !p)}
    >
      {children}
      {open && (
        <div ref={popRef} className={`floating-panel ${pinned ? 'pinned' : ''}`} role="dialog" onClick={(e) => e.stopPropagation()}>
          {panel}
        </div>
      )}
    </span>
  );
}
