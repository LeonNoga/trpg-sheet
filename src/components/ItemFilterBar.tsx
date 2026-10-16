import { useMemo } from 'react';
import { ALL_BONUS_KEYS, RARITY_LABELS, RARITY_ORDER, SLOT_TYPES, bonusLabel } from '../data/statsConfig';
import type { BonusKey, EquipItem, Path, Rarity, SlotType } from '../types';

export interface ItemFilterState {
  query: string;
  rarity: 'all' | 'none' | Rarity;
  level: 'all' | 'none' | number;
  equipped: 'all' | 'on' | 'off';
  bonus: 'all' | BonusKey;
  slot: 'all' | 'none' | SlotType;
}

export const EMPTY_ITEM_FILTERS: ItemFilterState = {
  query: '',
  rarity: 'all',
  level: 'all',
  equipped: 'all',
  bonus: 'all',
  slot: 'all',
};

export function filtersActive(f: ItemFilterState): boolean {
  return JSON.stringify(f) !== JSON.stringify(EMPTY_ITEM_FILTERS);
}

export function applyItemFilters(items: EquipItem[], f: ItemFilterState): EquipItem[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((item) => {
    if (q && !`${item.name} ${item.category ?? ''} ${item.flavorText ?? ''} ${item.effect ?? ''}`.toLowerCase().includes(q)) {
      return false;
    }
    if (f.rarity === 'none' ? !!item.rarity : f.rarity !== 'all' && item.rarity !== f.rarity) return false;
    if (f.level === 'none' ? item.level != null : f.level !== 'all' && item.level !== f.level) return false;
    if (f.equipped === 'on' && !item.equipped) return false;
    if (f.equipped === 'off' && item.equipped) return false;
    if (f.bonus !== 'all' && !item.statBonuses[f.bonus]) return false;
    if (f.slot === 'none' ? !!item.slot : f.slot !== 'all' && item.slot !== f.slot) return false;
    return true;
  });
}

interface Props {
  items: EquipItem[];
  state: ItemFilterState;
  onChange: (state: ItemFilterState) => void;
  shownCount: number;
  path?: Path;
  /** Какие фильтры показывать: для снаряжения — все, для умений — только общие. */
  gear?: boolean;
}

export function ItemFilterBar({ items, state, onChange, shownCount, path, gear }: Props) {
  const levels = useMemo(
    () => Array.from(new Set(items.map((i) => i.level).filter((l): l is number => l != null))).sort((a, b) => a - b),
    [items],
  );
  const bonusKeys = useMemo(() => {
    const keys = new Set<BonusKey>();
    items.forEach((i) => (Object.keys(i.statBonuses) as BonusKey[]).forEach((k) => i.statBonuses[k] && keys.add(k)));
    return ALL_BONUS_KEYS.filter((k) => keys.has(k));
  }, [items]);

  const set = <K extends keyof ItemFilterState>(key: K, value: ItemFilterState[K]) => onChange({ ...state, [key]: value });

  if (items.length === 0) return null;

  return (
    <>
      <div className="tray-filters">
        <input
          className="tray-search"
          placeholder="Поиск по названию и тексту"
          value={state.query}
          onChange={(e) => set('query', e.target.value)}
        />
        <select value={String(state.rarity)} onChange={(e) => set('rarity', e.target.value as ItemFilterState['rarity'])}>
          <option value="all">Любая редкость</option>
          {RARITY_ORDER.map((r) => (
            <option key={r} value={r}>
              {RARITY_LABELS[r]}
            </option>
          ))}
          <option value="none">Не указана</option>
        </select>
        <select
          value={String(state.level)}
          onChange={(e) => {
            const v = e.target.value;
            set('level', v === 'all' || v === 'none' ? v : Number(v));
          }}
        >
          <option value="all">Любой уровень</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              Уровень {l}
            </option>
          ))}
          <option value="none">Без уровня</option>
        </select>
        {bonusKeys.length > 0 && (
          <select value={String(state.bonus)} onChange={(e) => set('bonus', e.target.value as ItemFilterState['bonus'])}>
            <option value="all">Любой бонус</option>
            {bonusKeys.map((k) => (
              <option key={k} value={k}>
                Бонус: {bonusLabel(k, path)}
              </option>
            ))}
          </select>
        )}
        {gear && (
          <>
            <select value={state.equipped} onChange={(e) => set('equipped', e.target.value as ItemFilterState['equipped'])}>
              <option value="all">Надетые и нет</option>
              <option value="on">Только надетые</option>
              <option value="off">Только не надетые</option>
            </select>
            <select value={String(state.slot)} onChange={(e) => set('slot', e.target.value as ItemFilterState['slot'])}>
              <option value="all">Любой слот</option>
              {SLOT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
              <option value="none">Слот не указан</option>
            </select>
          </>
        )}
        {filtersActive(state) && (
          <button className="btn btn-sm btn-ghost" onClick={() => onChange(EMPTY_ITEM_FILTERS)}>
            Сбросить
          </button>
        )}
      </div>
      <p className="muted">
        Показано {shownCount} из {items.length}
      </p>
    </>
  );
}
