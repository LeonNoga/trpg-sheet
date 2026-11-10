import type { ActiveEffect, BonusKey, Character, EquipItem } from '../types';

/** Раунд боя и «Тик боя» — 15 секунд. */
export const ROUND_SECONDS = 15;
export const HOUR_SECONDS = 3600;
export const DAY_SECONDS = 24 * HOUR_SECONDS;

const UNIT_SECONDS: [RegExp, number][] = [
  [/^сек/, 1],
  [/^с$/, 1],
  [/^мин/, 60],
  [/^час/, HOUR_SECONDS],
  [/^ч$/, HOUR_SECONDS],
  [/^(раунд|ход|тик)/, ROUND_SECONDS],
  [/^(сут|дн|день)/, DAY_SECONDS],
];

const unitSeconds = (unit: string): number => UNIT_SECONDS.find(([re]) => re.test(unit))?.[1] ?? 0;

/** Первое «число + единица времени» в тексте: «30 секунд», «1 минуту», «2 раунда», «3 ч». Без числа — «минуту», «раунд» как 1. */
export function parseSpan(text: string): number | null {
  const lower = text.toLowerCase();
  const counted = /(\d+(?:[.,]\d+)?)\s*(секунд[а-яё]*|сек\.?|с(?![а-яё])|минут[а-яё]*|мин\.?|час[а-яё]*|ч(?![а-яё])|раунд[а-яё]*|ход[а-яё]*|тик[а-яё]*|сут[а-яё]*|дн[а-яё]*|день)/.exec(lower);
  if (counted) {
    const per = unitSeconds(counted[2].replace('.', ''));
    if (per > 0) return Math.round(Number(counted[1].replace(',', '.')) * per);
  }
  const single = /(?:^|[\s(])(секунду|минуту|час|раунд|ход|тик|сутки|день)(?![а-яё])/.exec(lower);
  if (single) return unitSeconds(single[1]);
  return null;
}

const COMBAT_END = /до\s+конца\s+(боя|сражения|схватки|столкновения)|на\s+время\s+(боя|сражения|схватки)|до\s+окончания\s+(боя|сражения)|раз\s+(в|за)\s+бой/;
const REST_END = /до\s+(следующего\s+)?(длительного\s+)?(отдыха|сна)/;
const DAILY = /раз\s+(в|за)\s+(день|сутки)|1\s*\/\s*(день|сутки)/;
const CONDITIONAL = /\(\s*или(?![а-яё])|или\s+до(?![а-яё])|пока(?![а-яё])/;

export type ParsedDuration =
  | { kind: 'none' }
  | { kind: 'instant' }
  | { kind: 'seconds'; seconds: number; conditional: boolean }
  | { kind: 'combat' }
  | { kind: 'rest' };

/** Длительность умения из текста карточки. «Мгновенно (эффекты длятся до конца боя)» — это до конца боя, а не мгновенно. */
export function parseDuration(text?: string): ParsedDuration {
  const lower = (text ?? '').toLowerCase().trim();
  if (!lower) return { kind: 'none' };
  if (COMBAT_END.test(lower)) return { kind: 'combat' };
  if (REST_END.test(lower)) return { kind: 'rest' };
  const seconds = parseSpan(lower);
  if (seconds !== null && seconds > 0) return { kind: 'seconds', seconds, conditional: CONDITIONAL.test(lower) };
  if (/^(мгновенн|немедленн)/.test(lower)) return { kind: 'instant' };
  return { kind: 'none' };
}

export type ParsedCooldown =
  | { kind: 'none' }
  | { kind: 'daily' }
  | { kind: 'combat' }
  | { kind: 'seconds'; seconds: number }
  | { kind: 'unknown' };

/** Откат из текста карточки: «10 минут», «1 раз в день», «до конца боя». Не распознанное считается «неизвестным» — отмечается вручную. */
export function parseCooldown(text?: string): ParsedCooldown {
  const lower = (text ?? '').toLowerCase().trim();
  if (!lower || /отсутству|^нет(?![а-яё])|^[-—–]$/.test(lower)) return { kind: 'none' };
  if (DAILY.test(lower)) return { kind: 'daily' };
  if (COMBAT_END.test(lower)) return { kind: 'combat' };
  const seconds = parseSpan(lower);
  if (seconds !== null && seconds > 0) return { kind: 'seconds', seconds };
  return { kind: 'unknown' };
}

const nonZero = (bonuses?: Partial<Record<BonusKey, number>>): Partial<Record<BonusKey, number>> =>
  Object.fromEntries(Object.entries(bonuses ?? {}).filter(([, v]) => v)) as Partial<Record<BonusKey, number>>;

/**
 * Эффект, который запускает применение умения: по длительности из текста и полю «Бонус при активации».
 * Мгновенные умения без бонусов эффекта не создают. Бонусы без понятной длительности действуют, пока их не снимут вручную.
 */
export function buildEffect(
  item: Pick<EquipItem, 'id' | 'name' | 'duration' | 'activeBonuses'>,
  clock: number,
  id: string = crypto.randomUUID(),
): ActiveEffect | null {
  const bonuses = nonZero(item.activeBonuses);
  const hasBonuses = Object.keys(bonuses).length > 0;
  const duration = parseDuration(item.duration);
  const base = { id, name: item.name.trim() || 'Умение', sourceId: item.id, bonuses, startedAt: clock };
  switch (duration.kind) {
    case 'seconds':
      return { ...base, until: 'time', endsAt: clock + duration.seconds };
    case 'combat':
      return { ...base, until: 'combat' };
    case 'rest':
      return { ...base, until: 'rest' };
    default:
      return hasBonuses ? { ...base, until: 'manual' } : null;
  }
}

export const gameClock = (character: Pick<Character, 'clock'>): number => character.clock ?? 0;

export function isEffectActive(effect: ActiveEffect, clock: number): boolean {
  return effect.until !== 'time' || (effect.endsAt ?? 0) > clock;
}

export function activeEffects(character: Pick<Character, 'effects' | 'clock'>): ActiveEffect[] {
  const clock = gameClock(character);
  return (character.effects ?? []).filter((e) => isEffectActive(e, clock));
}

/** Сумма бонусов действующих временных эффектов к характеристике или показателю. */
export function effectBonus(character: Pick<Character, 'effects' | 'clock'>, key: BonusKey): number {
  return activeEffects(character).reduce((sum, e) => sum + (e.bonuses[key] ?? 0), 0);
}

/** Сколько секунд осталось у эффекта; null — у эффекта нет срока. */
export function effectRemaining(effect: ActiveEffect, clock: number): number | null {
  return effect.until === 'time' ? Math.max(0, (effect.endsAt ?? 0) - clock) : null;
}

/** «45 с», «2 мин 30 с», «1 ч 05 мин», «2 д 3 ч». */
export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} с`;
  if (s < HOUR_SECONDS) {
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest ? `${m} мин ${rest} с` : `${m} мин`;
  }
  if (s < DAY_SECONDS) {
    const h = Math.floor(s / HOUR_SECONDS);
    const m = Math.floor((s % HOUR_SECONDS) / 60);
    return m ? `${h} ч ${String(m).padStart(2, '0')} мин` : `${h} ч`;
  }
  const d = Math.floor(s / DAY_SECONDS);
  const h = Math.floor((s % DAY_SECONDS) / HOUR_SECONDS);
  return h ? `${d} д ${h} ч` : `${d} д`;
}

/** Часы на экране: «0:45», «12:05», «1:02:30», «2д 3:15:00». */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / DAY_SECONDS);
  const h = Math.floor((s % DAY_SECONDS) / HOUR_SECONDS);
  const m = Math.floor((s % HOUR_SECONDS) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}д ${h}:${two(m)}:${two(sec)}`;
  if (h > 0) return `${h}:${two(m)}:${two(sec)}`;
  return `${m}:${two(sec)}`;
}

/** Номер тика боя (раунда) от начала отсчёта часов. */
export const tickOf = (seconds: number): number => Math.floor(seconds / ROUND_SECONDS);

const STAT_WORDS: [RegExp, BonusKey][] = [
  [/^сил/, 'strength'],
  [/^ловк/, 'agility'],
  [/^живуч/, 'vitality'],
  [/^стойк/, 'fortitude'],
  [/^интеллект/, 'intellect'],
  [/^мудр/, 'wisdom'],
  [/^харизм/, 'charisma'],
  [/^(дух|энерги|биоэнерги)/, 'resource'],
  [/^вынослив/, 'endurance'],
  [/^восприят/, 'perception'],
];

function keyFromPhrase(phrase: string): BonusKey | null {
  const p = phrase.toLowerCase().trim();
  if (/пассивн/.test(p)) return 'passivePerception';
  if (/сопротивл|^сс$/.test(p)) return 'resistance';
  if (/защит|^пз$/.test(p)) return 'defense';
  if (/скорост/.test(p)) return 'speed';
  if (/инициатив/.test(p)) return 'initiative';
  const words = p.split(/\s+/);
  if (/^пункт/.test(words[0])) {
    const next = words[1] ?? '';
    if (/^вынослив/.test(next)) return 'staminaPoints';
    if (/^(здоров|хит)/.test(next)) return 'hp';
    if (/^(дух|энерги|биоэнерги)/.test(next)) return 'resourcePoints';
    return null;
  }
  const last = words[words.length - 1];
  if (/^(здоров|хит|хп)/.test(last)) return 'hp';
  return STAT_WORDS.find(([re]) => re.test(last))?.[1] ?? null;
}

/**
 * Подсказка для редактора умения: ищет в описании «+20 к Силе», «−2 ПЗ», «+10 пунктов здоровья».
 * Это только предложение — игрок подтверждает или правит значения.
 */
export function suggestActiveBonuses(text?: string): Partial<Record<BonusKey, number>> {
  const result: Partial<Record<BonusKey, number>> = {};
  if (!text) return result;
  const pattern = /([+\-−–]\s?\d+)\s*(?:(?:к|в)\s+)?((?:пассивн[а-яё]*\s+|пункт[а-яё]*\s+|показател[а-яё]*\s+|сложност[а-яё]*\s+)?[а-яё]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const value = Number(m[1].replace(/[−–]/g, '-').replace(/\s/g, ''));
    const key = keyFromPhrase(m[2]);
    if (key && value && result[key] === undefined) result[key] = value;
  }
  return result;
}

/** «Сила +20, ПЗ −2» — краткая запись бонусов для плашек. */
export function bonusSummary(bonuses: Partial<Record<BonusKey, number>>, label: (key: BonusKey) => string): string {
  return Object.entries(bonuses)
    .filter(([, v]) => v)
    .map(([k, v]) => `${label(k as BonusKey)} ${Number(v) > 0 ? '+' : '−'}${Math.abs(Number(v))}`)
    .join(', ');
}
