import { modifier, totalStat } from './formulas';
import type { Character } from '../types';

export const ATHLETICS = 'Атлетика';

export type JumpKey = 'longRun' | 'longStand' | 'highRun' | 'highStand';

export interface JumpResult {
  key: JumpKey;
  label: string;
  /** Формула как в правилах. */
  formula: string;
  /** Итог в метрах, не меньше 0. */
  meters: number;
  /** Подстановка значений персонажа — «как произведён подсчёт». */
  working: string;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Число по-русски: запятая вместо точки, без лишних нулей. */
export function formatNumber(x: number): string {
  return round2(x).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

const signed = (x: number) => (x < 0 ? `(${formatNumber(x)})` : formatNumber(x));

interface Spec {
  key: JumpKey;
  label: string;
  base: number;
  /** Делитель при Модификаторе Силы (1 — без деления). */
  strengthDiv: number;
  athleticsDiv: number;
  formula: string;
}

const SPECS: Spec[] = [
  { key: 'longRun', label: 'В длину с разбега', base: 3, strengthDiv: 1, athleticsDiv: 5, formula: '3 + Мод. Силы + (Бонус Атлетики / 5)' },
  { key: 'longStand', label: 'В длину с места', base: 1, strengthDiv: 1, athleticsDiv: 10, formula: '1 + Мод. Силы + (Бонус Атлетики / 10)' },
  { key: 'highRun', label: 'В высоту с разбега', base: 0.5, strengthDiv: 2, athleticsDiv: 10, formula: '0,5 + (Мод. Силы / 2) + (Бонус Атлетики / 10)' },
  { key: 'highStand', label: 'В высоту с места', base: 0.3, strengthDiv: 3, athleticsDiv: 15, formula: '0,3 + (Мод. Силы / 3) + (Бонус Атлетики / 15)' },
];

export function computeJumps(character: Character): JumpResult[] {
  const strengthMod = modifier(totalStat(character, 'strength'));
  const athletics = character.skills[ATHLETICS] ?? 0;
  return SPECS.map((spec) => {
    const strengthPart = strengthMod / spec.strengthDiv;
    const athleticsPart = athletics / spec.athleticsDiv;
    const raw = spec.base + strengthPart + athleticsPart;
    const meters = round2(Math.max(0, raw));
    const strengthText = spec.strengthDiv === 1 ? signed(strengthMod) : `${signed(strengthMod)} / ${spec.strengthDiv}`;
    const working =
      `${formatNumber(spec.base)} + ${strengthText} + ${formatNumber(athletics)} / ${spec.athleticsDiv}` +
      ` = ${formatNumber(raw)}${raw < 0 ? ', минимум 0' : ''}`;
    return { key: spec.key, label: spec.label, formula: spec.formula, meters, working };
  });
}
