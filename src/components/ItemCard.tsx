import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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

  const [imagePinned, setImagePinned] = useState(false);
  const thumbRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!imagePinned) return;
    const close = (e: Event) => {
      if (!thumbRef.current?.contains(e.target as Node)) setImagePinned(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [imagePinned]);

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
            <span className="item-thumb" ref={thumbRef}>
              <button
                type="button"
                className="btn btn-sm item-thumb-btn"
                aria-label="Показать фото карточки"
                aria-expanded={imagePinned}
                onClick={() => setImagePinned((p) => !p)}
              >
                🖼
              </button>
              <span className={`item-thumb-pop ${imagePinned ? 'pinned' : ''}`}>
                <img src={item.image} alt={item.name} />
              </span>
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
