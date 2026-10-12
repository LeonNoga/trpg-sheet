import { useEffect, useState } from 'react';
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
const mirrorLine = (s: Extract<Shape, { t: 'line' }>): Shape => ({ ...s, x1: mx(s.x1), x2: mx(s.x2) });
const mirrorEllipse = (s: Extract<Shape, { t: 'ellipse' }>): Shape => ({ ...s, cx: mx(s.cx), rot: -(s.rot ?? 0) });

// Слоты и их положение — по бумажной карточке: слева очки/плащ/…/кольца 1–5, справа головной убор/серьги/…/обувь.
const SLOTS: SlotDef[] = [
  { key: 'glasses', type: 'glasses', label: 'Очки/линзы', capacity: 1, side: 'L', row: 0, anchor: [466, 128], zone: [{ t: 'rect', x: 460, y: 120, w: 80, h: 18, r: 8 }] },
  { key: 'cloak', type: 'cloak', label: 'Плащ', capacity: 1, side: 'L', row: 1, anchor: [410, 216], zone: [{ t: 'rect', x: 402, y: 204, w: 196, h: 28, r: 12 }] },
  {
    key: 'shoulders', type: 'shoulders', label: 'Наплечники', capacity: 1, side: 'L', row: 2, anchor: [420, 232],
    zone: [{ t: 'ellipse', cx: 424, cy: 230, rx: 34, ry: 24 }, { t: 'ellipse', cx: 576, cy: 230, rx: 34, ry: 24 }],
  },
  {
    key: 'elbows', type: 'elbows', label: 'Налокотники', capacity: 1, side: 'L', row: 3, anchor: [358, 336],
    zone: [{ t: 'ellipse', cx: 356, cy: 336, rx: 24, ry: 24 }, { t: 'ellipse', cx: 644, cy: 336, rx: 24, ry: 24 }],
  },
  {
    key: 'bracers', type: 'bracers', label: 'Наручи', capacity: 1, side: 'L', row: 4, anchor: [340, 398],
    zone: [
      { t: 'line', x1: 350, y1: 356, x2: 330, y2: 430, w: 36 },
      { t: 'line', x1: 650, y1: 356, x2: 670, y2: 430, w: 36 },
    ],
  },
  {
    key: 'bracelets', type: 'bracelets', label: 'Браслеты', capacity: 4, side: 'L', row: 5, anchor: [326, 448],
    zone: [{ t: 'ellipse', cx: 326, cy: 448, rx: 20, ry: 9, rot: 16 }, { t: 'ellipse', cx: 674, cy: 448, rx: 20, ry: 9, rot: -16 }],
  },
  {
    key: 'ringsLeft', type: 'rings', label: 'Кольца 1–5', capacity: 5, side: 'L', row: 6, anchor: [308, 506],
    zone: [
      { t: 'ellipse', cx: 298, cy: 506, rx: 7, ry: 7 },
      { t: 'ellipse', cx: 312, cy: 512, rx: 7, ry: 7 },
      { t: 'ellipse', cx: 326, cy: 506, rx: 7, ry: 7 },
    ],
  },
  {
    key: 'thigh', type: 'thigh', label: 'Набедренник', capacity: 1, side: 'L', row: 7, anchor: [452, 540],
    zone: [
      { t: 'line', x1: 461, y1: 504, x2: 455, y2: 580, w: 72 },
      { t: 'line', x1: 539, y1: 504, x2: 545, y2: 580, w: 72 },
    ],
  },
  {
    key: 'shins', type: 'shins', label: 'Поножи', capacity: 1, side: 'L', row: 8, anchor: [446, 672],
    zone: [
      { t: 'line', x1: 450, y1: 636, x2: 445, y2: 706, w: 48 },
      { t: 'line', x1: 550, y1: 636, x2: 555, y2: 706, w: 48 },
    ],
  },

  { key: 'headwear', type: 'headwear', label: 'Головной убор', capacity: 1, side: 'R', row: 0, anchor: [520, 92], zone: [{ t: 'ellipse', cx: 500, cy: 100, rx: 44, ry: 26 }] },
  {
    key: 'earrings', type: 'earrings', label: 'Серьги', capacity: 4, side: 'R', row: 1, anchor: [544, 152],
    zone: [{ t: 'ellipse', cx: 458, cy: 152, rx: 9, ry: 9 }, { t: 'ellipse', cx: 542, cy: 152, rx: 9, ry: 9 }],
  },
  { key: 'amulets', type: 'amulets', label: 'Амулеты', capacity: 3, side: 'R', row: 2, anchor: [514, 240], zone: [{ t: 'ellipse', cx: 500, cy: 242, rx: 26, ry: 18 }] },
  { key: 'armor', type: 'armor', label: 'Броня', capacity: 1, side: 'R', row: 3, anchor: [572, 300], zone: [{ t: 'rect', x: 424, y: 238, w: 152, h: 160, r: 16 }] },
  { key: 'belt', type: 'belt', label: 'Пояс', capacity: 1, side: 'R', row: 4, anchor: [570, 422], zone: [{ t: 'rect', x: 424, y: 410, w: 152, h: 24, r: 8 }] },
  {
    key: 'gloves', type: 'gloves', label: 'Перчатки', capacity: 1, side: 'R', row: 5, anchor: [684, 478],
    zone: [{ t: 'ellipse', cx: 314, cy: 480, rx: 22, ry: 32, rot: 8 }, { t: 'ellipse', cx: 686, cy: 480, rx: 22, ry: 32, rot: -8 }],
  },
  {
    key: 'ringsRight', type: 'rings', label: 'Кольца 6–10', capacity: 5, side: 'R', row: 6, anchor: [692, 508],
    zone: [
      { t: 'ellipse', cx: 674, cy: 506, rx: 7, ry: 7 },
      { t: 'ellipse', cx: 688, cy: 512, rx: 7, ry: 7 },
      { t: 'ellipse', cx: 702, cy: 506, rx: 7, ry: 7 },
    ],
  },
  {
    key: 'knees', type: 'knees', label: 'Наколенники', capacity: 1, side: 'R', row: 7, anchor: [552, 612],
    zone: [{ t: 'ellipse', cx: 452, cy: 612, rx: 28, ry: 26 }, { t: 'ellipse', cx: 548, cy: 612, rx: 28, ry: 26 }],
  },
  {
    key: 'boots', type: 'boots', label: 'Обувь', capacity: 1, side: 'R', row: 8, anchor: [572, 742],
    zone: [{ t: 'ellipse', cx: 432, cy: 742, rx: 42, ry: 22 }, { t: 'ellipse', cx: 568, cy: 742, rx: 42, ry: 22 }],
  },
];

// Силуэт: объединение фигур (голова, торс, конечности). Рисуется дважды — тёмным контуром и белой заливкой,
// поэтому на стыках нет лишних линий и получается единый контур, как на бумажной карточке.
const L_ARM: Shape[] = [
  { t: 'line', x1: 414, y1: 226, x2: 356, y2: 334, w: 42 },
  { t: 'line', x1: 356, y1: 334, x2: 326, y2: 446, w: 32 },
  { t: 'ellipse', cx: 314, cy: 480, rx: 17, ry: 30, rot: 8 },
];
const L_LEG: Shape[] = [
  { t: 'line', x1: 461, y1: 490, x2: 452, y2: 610, w: 76 },
  { t: 'line', x1: 452, y1: 610, x2: 445, y2: 712, w: 54 },
  { t: 'ellipse', cx: 432, cy: 742, rx: 38, ry: 18 },
];
const mirrorShape = (s: Shape): Shape =>
  s.t === 'line' ? mirrorLine(s) : s.t === 'ellipse' ? mirrorEllipse(s) : s;

const BODY: Shape[] = [
  { t: 'ellipse', cx: 500, cy: 130, rx: 40, ry: 50 },
  { t: 'line', x1: 500, y1: 170, x2: 500, y2: 208, w: 34 },
  { t: 'poly', r: 28, pts: [[418, 222], [582, 222], [574, 330], [556, 420], [566, 468], [434, 468], [444, 420], [426, 330]] },
  ...L_ARM,
  ...L_ARM.map(mirrorShape),
  ...L_LEG,
  ...L_LEG.map(mirrorShape),
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
    case 'line':
      return (
        <line
          key={key}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          strokeWidth={shape.w + expand}
          strokeLinecap="round"
          stroke={String(props.fill)}
          {...props}
        />
      );
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

  const idsIn = (key: string) => character.equippedSlots[key] ?? [];
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
        viewBox={narrow ? '270 60 460 720' : '0 0 1000 780'}
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

        {BODY.map((s, i) => renderShape(s, `o${i}`, 12, { fill: '#222' }))}
        {BODY.map((s, i) => renderShape(s, `f${i}`, 0, { fill: '#fff' }))}

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
                  fillOpacity: has ? 0.6 : 0.001,
                  stroke: selected ? 'var(--accent)' : 'none',
                  strokeDasharray: selected ? '6 4' : undefined,
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
