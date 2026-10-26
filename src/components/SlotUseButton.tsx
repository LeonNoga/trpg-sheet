import { useEffect, useRef, useState } from 'react';

/** Что известно о способности из слота: чтобы нарисовать кнопку применения и её состояние. */
export interface SlotUseInfo {
  id: string;
  /** Короткая подпись стоимости на кнопке: «−8 Дух, −5 Вын.» (пусто, если стоимости нет). */
  costText: string;
  /** Подсказка при наведении на активную кнопку. */
  tooltip: string;
  /** Способность на откате или дневной лимит израсходован — кнопка серая. */
  cooling: boolean;
  /** Причины блокировки: «Откат: 5 минут.», «Уже использовано сегодня». */
  reasons: string[];
}

interface Props {
  info: SlotUseInfo;
  onUse: () => void;
  onResetCooldown: () => void;
}

/**
 * Кнопка применения способности рядом со слотом. Обычная — тратит стоимость и ставит откат. Серая (откат идёт) —
 * не применяется, а при наведении (на телефоне — по нажатию) показывает, какой откат, и кнопку «Откат прошёл».
 */
export function SlotUseButton({ info, onUse, onResetCooldown }: Props) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [pinned]);

  const showCard = info.cooling && (hover || pinned);

  return (
    <span
      className="slot-use-wrap"
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={`btn btn-sm slot-use ${info.cooling ? 'cooling' : ''}`}
        title={info.cooling ? undefined : info.tooltip}
        aria-label={info.tooltip}
        onClick={() => (info.cooling ? setPinned((p) => !p) : onUse())}
      >
        ⚡
      </button>
      {showCard && (
        <div className="hover-card slot-use-card" role="tooltip">
          {info.reasons.map((reason) => (
            <div className="hover-card-line" key={reason}>
              {reason}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              onResetCooldown();
              setPinned(false);
              setHover(false);
            }}
          >
            Откат прошёл
          </button>
        </div>
      )}
    </span>
  );
}
