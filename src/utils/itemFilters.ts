import type { BonusKey, EquipItem, Rarity, SlotType } from '../types';

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
