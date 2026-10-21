import { useEffect, useState } from 'react';
import bodyUrl from '../assets/body.png';
import { RARITY_LABELS, SLOT_TYPE_LABELS } from '../data/statsConfig';
import type { Character, EquipItem, SlotType } from '../types';

type Pt = [number, number];

type Shape =
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; w: number }
  | { t: 'poly'; pts: Pt[]; r?: number };

interface SlotDef {
  key: string;
  type: SlotType;
  label: string;
  capacity: number;
  side: 'L' | 'R';
  row: number;
  /** Точка на теле, куда ведёт линия от рамки. */
  anchor: Pt;
  /** Зона на теле, которая подсвечивается, когда в слот что-то надето. */
  zone: Shape[];
}

const CENTER = 1000; // зеркалирование: x → 1000 - x
const mx = (x: number) => CENTER - x;

// Фигура — картинка body.png (контур человека), помещённая в область 278..722 × 10..770 схемы.
// Зоны ниже заданы в координатах схемы: левая сторона на экране — это x < 500, правая — зеркальная.
const FIGURE = { x: 278, y: 10, w: 445, h: 760 };

/** Левая зона + её зеркальная копия справа. */
function pair(shape: Extract<Shape, { t: 'ellipse' | 'line' | 'rect' }>): Shape[] {
  if (shape.t === 'ellipse') return [shape, { ...shape, cx: mx(shape.cx), rot: -(shape.rot ?? 0) }];
  if (shape.t === 'line') return [shape, { ...shape, x1: mx(shape.x1), x2: mx(shape.x2) }];
  return [shape, { ...shape, x: mx(shape.x) - shape.w }];
}

// Слоты и их положение — по бумажной карточке: слева очки/плащ/…/кольца 1–5, справа головной убор/серьги/…/обувь.
const SLOTS: SlotDef[] = [
  { key: 'glasses', type: 'glasses', label: 'Очки/линзы', capacity: 1, side: 'L', row: 0, anchor: [472, 61], zone: [{ t: 'rect', x: 464, y: 52, w: 72, h: 16, r: 8 }] },
  { key: 'cloak', type: 'cloak', label: 'Плащ', capacity: 1, side: 'L', row: 1, anchor: [426, 148], zone: [{ t: 'rect', x: 420, y: 138, w: 160, h: 20, r: 10 }] },
  { key: 'shoulders', type: 'shoulders', label: 'Наплечники', capacity: 1, side: 'L', row: 2, anchor: [388, 176], zone: pair({ t: 'ellipse', cx: 410, cy: 176, rx: 30, ry: 24, rot: -20 }) },
  { key: 'elbows', type: 'elbows', label: 'Налокотники', capacity: 1, side: 'L', row: 3, anchor: [356, 303], zone: pair({ t: 'ellipse', cx: 374, cy: 303, rx: 20, ry: 22 }) },
  { key: 'bracers', type: 'bracers', label: 'Наручи', capacity: 1, side: 'L', row: 4, anchor: [350, 346], zone: pair({ t: 'line', x1: 364, y1: 326, x2: 346, y2: 362, w: 26 }) },
  { key: 'bracelets', type: 'bracelets', label: 'Браслеты', capacity: 4, side: 'L', row: 5, anchor: [322, 380], zone: pair({ t: 'ellipse', cx: 337, cy: 376, rx: 17, ry: 8, rot: 27 }) },
  {
    key: 'ringsLeft', type: 'rings', label: 'Кольца 1–5', capacity: 5, side: 'L', row: 6, anchor: [300, 424],
    zone: [
      { t: 'ellipse', cx: 299, cy: 424, rx: 6, ry: 6 },
      { t: 'ellipse', cx: 312, cy: 428, rx: 6, ry: 6 },
      { t: 'ellipse', cx: 325, cy: 424, rx: 6, ry: 6 },
    ],
  },
  { key: 'thigh', type: 'thigh', label: 'Набедренник', capacity: 1, side: 'L', row: 7, anchor: [444, 480], zone: pair({ t: 'line', x1: 466, y1: 432, x2: 458, y2: 520, w: 52 }) },
  { key: 'shins', type: 'shins', label: 'Поножи', capacity: 1, side: 'L', row: 8, anchor: [436, 650], zone: pair({ t: 'line', x1: 446, y1: 596, x2: 440, y2: 696, w: 36 }) },

  { key: 'headwear', type: 'headwear', label: 'Головной убор', capacity: 1, side: 'R', row: 0, anchor: [540, 36], zone: [{ t: 'ellipse', cx: 500, cy: 36, rx: 42, ry: 24 }] },
  { key: 'earrings', type: 'earrings', label: 'Серьги', capacity: 4, side: 'R', row: 1, anchor: [548, 86], zone: pair({ t: 'ellipse', cx: 459, cy: 84, rx: 8, ry: 10 }) },
  { key: 'amulets', type: 'amulets', label: 'Амулеты', capacity: 3, side: 'R', row: 2, anchor: [522, 170], zone: [{ t: 'ellipse', cx: 500, cy: 170, rx: 26, ry: 14 }] },
  { key: 'armor', type: 'armor', label: 'Броня', capacity: 1, side: 'R', row: 3, anchor: [556, 262], zone: [{ t: 'rect', x: 440, y: 186, w: 120, h: 188, r: 16 }] },
  { key: 'belt', type: 'belt', label: 'Пояс', capacity: 1, side: 'R', row: 4, anchor: [560, 388], zone: [{ t: 'rect', x: 434, y: 378, w: 132, h: 20, r: 8 }] },
  { key: 'gloves', type: 'gloves', label: 'Перчатки', capacity: 1, side: 'R', row: 5, anchor: [696, 404], zone: pair({ t: 'ellipse', cx: 314, cy: 408, rx: 26, ry: 34, rot: 22 }) },
  {
    key: 'ringsRight', type: 'rings', label: 'Кольца 6–10', capacity: 5, side: 'R', row: 6, anchor: [700, 424],
    zone: [
      { t: 'ellipse', cx: 701, cy: 424, rx: 6, ry: 6 },
      { t: 'ellipse', cx: 688, cy: 428, rx: 6, ry: 6 },
      { t: 'ellipse', cx: 675, cy: 424, rx: 6, ry: 6 },
    ],
  },
  { key: 'knees', type: 'knees', label: 'Наколенники', capacity: 1, side: 'R', row: 7, anchor: [572, 561], zone: pair({ t: 'ellipse', cx: 451, cy: 561, rx: 24, ry: 22 }) },
  { key: 'boots', type: 'boots', label: 'Обувь', capacity: 1, side: 'R', row: 8, anchor: [578, 738], zone: pair({ t: 'ellipse', cx: 438, cy: 738, rx: 30, ry: 28 }) },
];

function renderShape(shape: Shape, key: string | number, expand: number, props: Record<string, unknown>) {
  switch (shape.t) {
    case 'ellipse':
      return (
        <ellipse
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx + expand / 2}
          ry={shape.ry + expand / 2}
          transform={shape.rot ? `rotate(${shape.rot} ${shape.cx} ${shape.cy})` : undefined}
          {...props}
        />
      );
    case 'rect':
      return (
        <rect
          key={key}
          x={shape.x - expand / 2}
          y={shape.y - expand / 2}
          width={shape.w + expand}
          height={shape.h + expand}
          rx={(shape.r ?? 0) + expand / 2}
          {...props}
        />
      );
    case 'line': {
      // Капсула вместо <line>: так у всех зон одинаково работают заливка и обводка выбранного слота.
      const len = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
      const cx = (shape.x1 + shape.x2) / 2;
      const cy = (shape.y1 + shape.y2) / 2;
      const angle = (Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1) * 180) / Math.PI;
      const w = shape.w + expand;
      return (
        <rect
          key={key}
          x={cx - (len + w) / 2}
          y={cy - w / 2}
          width={len + w}
          height={w}
          rx={w / 2}
          transform={`rotate(${angle} ${cx} ${cy})`}
          {...props}
        />
      );
    }
    case 'poly':
      return (
        <polygon
          key={key}
          points={shape.pts.map((p) => p.join(',')).join(' ')}
          strokeWidth={(shape.r ?? 0) + expand}
          strokeLinejoin="round"
          stroke={String(props.fill)}
          {...props}
        />
      );
  }
}

const BOX_W = 210;
const BOX_H = 58;
const boxPos = (slot: SlotDef) => ({ x: slot.side === 'L' ? 10 : 780, y: 8 + slot.row * 80 });

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function useNarrow(): boolean {
  const query = '(max-width: 600px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setNarrow(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return narrow;
}

interface Props {
  character: Character;
  onChange: (slots: Record<string, string[]>) => void;
}

export function EquipmentSilhouette({ character, onChange }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const narrow = useNarrow();

  // Только существующие предметы: удалённые не должны занимать слот.
  const existingIds = new Set(character.items.map((i) => i.id));
  const idsIn = (key: string) => (character.equippedSlots[key] ?? []).filter((id) => existingIds.has(id));
  const itemsIn = (key: string): EquipItem[] =>
    idsIn(key)
      .map((id) => character.items.find((i) => i.id === id))
      .filter((i): i is EquipItem => !!i);
  const isOver = (slot: SlotDef) => idsIn(slot.key).length > slot.capacity;

  function toggle(slotKey: string, itemId: string) {
    const current = idsIn(slotKey);
    const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId];
    onChange({ ...character.equippedSlots, [slotKey]: next });
  }

  const active = SLOTS.find((s) => s.key === openKey) ?? null;
  const select = (slot: SlotDef) => setOpenKey(openKey === slot.key ? null : slot.key);

  function candidatesFor(slot: SlotDef): EquipItem[] {
    if (showAll) return character.items;
    const placed = new Set(idsIn(slot.key));
    // Подходящие по типу слота + уже стоящие в этом слоте (чтобы их можно было снять).
    return character.items.filter((i) => i.slot === slot.type || placed.has(i.id));
  }

  return (
    <div className="card">
      <h3 className="card-title">Экипировка</h3>
      <p className="muted">
        Нажмите на слот, чтобы выбрать, что в него надето: показываются предметы с подходящим типом слота. На один
        слот можно надеть несколько предметов — если больше обычного, слот подсветится красным, но запрета нет.
      </p>

      <svg
        className="equipment-diagram"
        viewBox={narrow ? '270 4 460 772' : '0 0 1000 780'}
        role="img"
        aria-label="Схема экипировки"
      >
        {!narrow &&
          SLOTS.map((slot) => {
            const { x, y } = boxPos(slot);
            const startX = slot.side === 'L' ? x + BOX_W : x;
            return (
              <line
                key={`l-${slot.key}`}
                x1={startX}
                y1={y + BOX_H / 2}
                x2={slot.anchor[0]}
                y2={slot.anchor[1]}
                stroke="#222"
                strokeWidth={2}
              />
            );
          })}

        <image href={bodyUrl} x={FIGURE.x} y={FIGURE.y} width={FIGURE.w} height={FIGURE.h} />

        {SLOTS.map((slot) => {
          const has = idsIn(slot.key).length > 0;
          const over = isOver(slot);
          const selected = openKey === slot.key;
          return (
            <g
              key={`z-${slot.key}`}
              className="equipment-zone"
              onClick={() => select(slot)}
              style={{ cursor: 'pointer' }}
            >
              <title>{slot.label}</title>
              {slot.zone.map((z, i) =>
                renderShape(z, i, 0, {
                  fill: over ? '#c0392b' : 'var(--accent)',
                  fillOpacity: has ? 0.55 : 0.001,
                  stroke: over ? '#c0392b' : selected || has ? 'var(--accent)' : 'none',
                  strokeWidth: 2,
                  strokeDasharray: selected && !has ? '6 4' : undefined,
                  pointerEvents: 'all',
                }),
              )}
            </g>
          );
        })}

        {!narrow &&
          SLOTS.map((slot) => {
            const { x, y } = boxPos(slot);
            const items = itemsIn(slot.key);
            const count = idsIn(slot.key).length;
            const over = isOver(slot);
            const selected = openKey === slot.key;
            return (
              <g key={`b-${slot.key}`} onClick={() => select(slot)} style={{ cursor: 'pointer' }}>
                <rect
                  x={x}
                  y={y}
                  width={BOX_W}
                  height={BOX_H}
                  rx={14}
                  fill={count > 0 ? 'var(--accent-soft)' : '#fff'}
                  stroke={over ? '#c0392b' : selected || count > 0 ? 'var(--accent)' : '#222'}
                  strokeWidth={selected || over ? 4 : 2.5}
                />
                <text x={x + 12} y={y + 25} fontSize={22} fontWeight={600} fill="#222">
                  {slot.label}
                </text>
                <text x={x + 12} y={y + 48} fontSize={17} fill="#555">
                  {truncate(items.map((i) => i.name || 'Без названия').join(', '), 17)}
                </text>
                <text
                  x={x + BOX_W - 12}
                  y={y + 48}
                  fontSize={20}
                  textAnchor="end"
                  fontWeight={over ? 700 : 400}
                  fill={over ? '#c0392b' : '#666'}
                >
                  {count}/{slot.capacity}
                </text>
              </g>
            );
          })}
      </svg>

      {narrow && (
        <div className="equipment-slot-grid">
          {SLOTS.map((slot) => {
            const count = idsIn(slot.key).length;
            return (
              <button
                key={slot.key}
                type="button"
                className={`equipment-slot-btn ${count > 0 ? 'has-items' : ''} ${isOver(slot) ? 'over' : ''}`}
                onClick={() => select(slot)}
              >
                <span>{slot.label}</span>
                <span className="equipment-slot-count">
                  {count}/{slot.capacity}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <div className="card" style={{ marginTop: 12 }}>
          <h4>
            {active.label}{' '}
            <span className="muted">
              — {idsIn(active.key).length}/{active.capacity}
            </span>
          </h4>
          {isOver(active) && (
            <p className="error-text">Надето больше, чем обычно допустимо для этого слота ({active.capacity}) — это разрешено.</p>
          )}
          {candidatesFor(active).length === 0 && (
            <p className="muted">
              Нет предметов с типом слота «{SLOT_TYPE_LABELS[active.type]}». Укажите тип слота в карточке предмета или
              включите показ всех предметов.
            </p>
          )}
          {candidatesFor(active).map((item) => (
            <label key={item.id} className="toggle" style={{ display: 'flex', marginBottom: 4 }}>
              <input type="checkbox" checked={idsIn(active.key).includes(item.id)} onChange={() => toggle(active.key, item.id)} />
              <span>
                {item.name || 'Без названия'}
                <span className="muted">
                  {item.rarity ? ` · ${RARITY_LABELS[item.rarity]}` : ''}
                  {item.slot !== active.type ? ` · слот: ${item.slot ? SLOT_TYPE_LABELS[item.slot] : 'не указан'}` : ''}
                </span>
              </span>
            </label>
          ))}
          <label className="toggle" style={{ display: 'flex', marginTop: 8 }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Показать все предметы, а не только с этим типом слота
          </label>
        </div>
      )}
    </div>
  );
}
