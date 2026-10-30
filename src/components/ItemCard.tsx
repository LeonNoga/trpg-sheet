import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { bonusLabel, ITEM_PATH_LABELS, PATH_LABELS, RARITY_LABELS, SLOT_TYPE_LABELS } from '../data/statsConfig';
import { PathIcon } from './PathIcon';
import type { BonusKey, EquipItem, Path } from '../types';

/** Команда «развернуть/свернуть все»: у каждой строки своё состояние, но по новой версии команды оно перезаписывается. */
export interface ExpandCommand {
  open: boolean;
  version: number;
}

interface Props {
  item: EquipItem;
  path?: Path;
  showEquipToggle: boolean;
  /** Если задан onSelect — слева в строке появляется чекбокс выбора для массовых действий. */
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onToggleEquipped: () => void;
  /** Дополнительный блок в раскрытой части (например, кнопка «Применить» у способностей). */
  extra?: ReactNode;
  /** Подтвердить, что распознанные данные проверены — убирает значок «Проверьте». */
  onDismissReview?: () => void;
  expandCommand?: ExpandCommand;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Превью фото при наведении: окно привязано к значку, но выводится сверху или снизу — туда, где хватает места,
 * и не выходит за границы окна. Позиция выставляется напрямую в style (пересчёт при загрузке картинки и прокрутке).
 */
function ThumbPreview({ anchorRef, src, alt }: { anchorRef: RefObject<HTMLElement | null>; src: string; alt: string }) {
  const popRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const pop = popRef.current;
    const anchor = anchorRef.current;
    if (!pop || !anchor) return;
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const w = pop.offsetWidth;
      const h = pop.offsetHeight;
      const gap = 6;
      const margin = 8;
      const below = window.innerHeight - a.bottom - gap - margin;
      const above = a.top - gap - margin;
      let top: number;
      if (h <= below) top = a.bottom + gap;
      else if (h <= above) top = a.top - gap - h;
      else top = below >= above ? a.bottom + gap : a.top - gap - h; // не влезает никуда — к стороне, где больше места, ниже прижмём
      top = Math.min(Math.max(top, margin), Math.max(margin, window.innerHeight - h - margin));
      const left = Math.min(Math.max(a.right - w, margin), Math.max(margin, window.innerWidth - w - margin));
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
  }, [anchorRef]);

  return (
    <span className="item-thumb-pop" ref={popRef}>
      <img src={src} alt={alt} />
    </span>
  );
}

/**
 * Запись в ленте предметов/умений: компактная строка (название, редкость, слот, артефакт, бонусы — у умений
 * активация/откат/каст/длительность), по нажатию раскрывается описание. Фото — значок: при наведении (на телефоне —
 * по нажатию) показывается превью.
 */
export function ItemCard({
  item,
  path,
  showEquipToggle,
  selected,
  onSelect,
  extra,
  onDismissReview,
  expandCommand,
  onToggleEquipped,
  onEdit,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [seenVersion, setSeenVersion] = useState(expandCommand?.version);
  if (expandCommand && expandCommand.version !== seenVersion) {
    setSeenVersion(expandCommand.version);
    setOpen(expandCommand.open);
  }

  // Фото карточки: на компьютере превью при наведении, по нажатию — на весь экран (так же на телефоне).
  const [lightbox, setLightbox] = useState(false);
  const [hovering, setHovering] = useState(false);
  const thumbRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const bonusEntries = Object.entries(item.statBonuses) as [BonusKey, number][];
  const isAbility = item.kind === 'ability';
  const abilityFields: [string, string | undefined][] = [
    ['⚡', item.activation],
    ['⏳', item.cooldown],
    ['🎯', item.cast],
    ['⌛', item.duration],
  ];
  const abilityLabels = ['Активация', 'Откат', 'Каст', 'Длительность'];
  const rarityClass = item.rarity ? `rarity-${item.rarity}` : '';
  const sub = [
    item.rarity ? RARITY_LABELS[item.rarity] : null,
    isAbility ? item.category : item.slot ? SLOT_TYPE_LABELS[item.slot] : null,
    item.level ? `ур. ${item.level}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const hasBody = !!(item.flavorText || item.effect || extra);
  // Предмет или умение другого пути (не того, что у персонажа) — предупреждаем, чтобы случайно не добавить чужое.
  const foreignPath = !!path && !!item.path && item.path !== 'none' && item.path !== path;
  const foreignHint = foreignPath ? `Другой путь: ${ITEM_PATH_LABELS[item.path!]}. У персонажа — ${PATH_LABELS[path!]}.` : '';

  return (
    <div className={`item-card ${item.equipped && showEquipToggle ? 'equipped' : ''} ${rarityClass} ${selected ? 'selected' : ''} ${open ? 'open' : ''} ${foreignPath ? 'foreign' : ''}`}>
      <div
        className="item-card-head"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('input, button, label, .item-thumb')) return;
          setOpen((o) => !o);
        }}
      >
        {onSelect && (
          <label className="item-select" title="Выбрать для массового действия">
            <input type="checkbox" checked={!!selected} onChange={(e) => onSelect(e.target.checked)} />
          </label>
        )}

        <div className="item-title">
          <h4>
            <PathIcon path={item.path} />
            {item.name || 'Без названия'}
            {item.artifact && <span className="item-tag">Артефакт</span>}
            {foreignPath && (
              <span className="item-tag item-tag-warn" title={foreignHint}>
                ⚠ Чужой путь
              </span>
            )}
          </h4>
          {sub && <div className="item-meta">{sub}</div>}

          {!isAbility && bonusEntries.length > 0 && (
            <div className="item-bonuses">
              {bonusEntries.map(([key, value]) => (
                <span className={`bonus-chip ${value < 0 ? 'neg' : ''}`} key={key}>
                  {bonusLabel(key, path)} {value >= 0 ? `+${value}` : value}
                </span>
              ))}
            </div>
          )}

          {isAbility && abilityFields.some(([, v]) => v) && (
            <div className="item-props">
              {abilityFields.map(([icon, value], i) =>
                value ? (
                  <span key={abilityLabels[i]} title={abilityLabels[i]}>
                    {icon} <b>{abilityLabels[i]}:</b> {value}
                  </span>
                ) : null,
              )}
            </div>
          )}
        </div>

        <div className="item-right">
          {showEquipToggle && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={item.equipped}
                onChange={() => {
                  if (!item.equipped && foreignPath && !confirm(`${foreignHint}
Всё равно надеть?`)) return;
                  onToggleEquipped();
                }}
              />
              {item.equipped ? 'Надето' : 'Снято'}
            </label>
          )}
          {item.image && (
            <span
              className="item-thumb"
              ref={thumbRef}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              <button
                type="button"
                className="btn btn-sm item-thumb-btn"
                aria-label="Открыть фото карточки"
                onClick={() => setLightbox(true)}
              >
                🖼
              </button>
              {hovering && <ThumbPreview anchorRef={thumbRef} src={item.image} alt={item.name} />}
            </span>
          )}
          <button
            type="button"
            className="item-arrow"
            aria-label={open ? 'Свернуть' : 'Развернуть'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            ▾
          </button>
        </div>
      </div>

      {item.review && item.review.length > 0 && (
        <div className="review-badge">
          <span>⚠ Проверьте: {item.review.join(', ')}</span>
          {onDismissReview && (
            <button className="btn btn-sm btn-ghost" onClick={onDismissReview}>
              Всё верно
            </button>
          )}
        </div>
      )}

      {lightbox && item.image && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(false)}>
          <img src={item.image} alt={item.name} />
          <button type="button" className="btn lightbox-close" aria-label="Закрыть">
            ✕
          </button>
        </div>
      )}

      {open && (
        <div className="item-body">
          {item.flavorText && <p className="item-flavor">«{item.flavorText}»</p>}
          {item.effect && <p className="item-effect">{item.effect}</p>}
          {!hasBody && <p className="muted item-effect">Описания нет.</p>}
          {extra}
          <div className="item-actions">
            <button className="btn btn-sm" onClick={onEdit}>
              Изменить
            </button>
            <button className="btn btn-sm btn-danger" onClick={onDelete}>
              Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
