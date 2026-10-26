import type { SlotType } from '../types';

// Типы слотов экипировки и лимит слотов умений по уровню.

export const SLOT_TYPES: { key: SlotType; label: string }[] = [
  { key: 'headwear', label: 'Головной убор' },
  { key: 'glasses', label: 'Очки/линзы' },
  { key: 'earrings', label: 'Серьги' },
  { key: 'amulets', label: 'Амулеты' },
  { key: 'cloak', label: 'Плащ' },
  { key: 'shoulders', label: 'Наплечники' },
  { key: 'armor', label: 'Броня' },
  { key: 'elbows', label: 'Налокотники' },
  { key: 'bracers', label: 'Наручи' },
  { key: 'bracelets', label: 'Браслеты' },
  { key: 'gloves', label: 'Перчатки' },
  { key: 'rings', label: 'Кольца' },
  { key: 'belt', label: 'Пояс' },
  { key: 'thigh', label: 'Набедренник' },
  { key: 'knees', label: 'Наколенники' },
  { key: 'shins', label: 'Поножи' },
  { key: 'boots', label: 'Обувь' },
  { key: 'weapon', label: 'Оружие (одноручное)' },
  { key: 'twohanded', label: 'Оружие (двуручное)' },
  { key: 'shield', label: 'Щит' },
];

export const SLOT_TYPE_LABELS = Object.fromEntries(SLOT_TYPES.map((t) => [t.key, t.label])) as Record<SlotType, string>;

// Сколько слотов в списке ДНК / Технологии / Умения открыто на данном уровне.
export const ABILITY_SLOT_STEPS: { level: number; slots: number }[] = [
  { level: 1, slots: 3 },
  { level: 25, slots: 4 },
  { level: 50, slots: 5 },
  { level: 100, slots: 6 },
];

export function abilitySlotLimit(level: number): number {
  return ABILITY_SLOT_STEPS.filter((s) => level >= s.level).at(-1)!.slots;
}
