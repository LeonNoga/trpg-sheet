import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { createLongPress } from '../utils/longPress';

export function useIndicatorDetails<K extends string>(longPress = false) {
  const [hovered, setHovered] = useState<K | null>(null);
  const [pinned, setPinned] = useState<K | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef(createLongPress());
  const panelId = useId();
  const open = hovered ?? pinned;
  useEffect(() => {
    const close = () => { setHovered(null); setPinned(null); gesture.current.cancel(); };
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    const current = gesture.current;
    return () => {
      current.cancel();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return {
    root, panelId, open,
    toggle: (key: K) => { setHovered(null); setPinned((value) => value === key ? null : key); },
    leave: (event: PointerEvent) => { if (event.pointerType === 'mouse') setHovered(null); },
    handlers: (key: K) => ({
      onPointerEnter: (event: PointerEvent) => { if (event.pointerType === 'mouse') setHovered(key); },
      onPointerDown: (event: PointerEvent) => {
        if (!longPress) return;
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
          if (!event.isPrimary) { gesture.current.cancel(); return; }
          gesture.current.start(event.clientX, event.clientY, () => setPinned(key));
        } else gesture.current.reset();
      },
      onPointerMove: (event: PointerEvent) => { if (longPress && event.pointerType !== 'mouse') gesture.current.move(event.clientX, event.clientY); },
      onPointerUp: () => gesture.current.cancel(),
      onPointerCancel: () => gesture.current.cancel(),
      onClickCapture: (event: MouseEvent) => {
        if (longPress && gesture.current.consumeClick()) { event.preventDefault(); event.stopPropagation(); }
      },
      onContextMenu: (event: MouseEvent) => { if (longPress) event.preventDefault(); },
    }),
  };
}
