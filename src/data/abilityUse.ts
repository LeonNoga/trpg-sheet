import { computeDerivedStats, modifier, totalStat } from './formulas';
import type { MilestoneRestore } from './milestones';
import type { Character, EquipItem } from '../types';

/** Ячейка учёта применения способности: идёт ли откат и израсходован ли дневной лимит. */
export interface UsageState {
  cooldown?: boolean;
  daily?: boolean;
}

export interface AbilityCost {
  /** Пункты Ресурса Пути (Дух / Энергия / Биоэнергия). */
  resource: number;
  stamina: number;
}

export const milestoneUsageKey = (stat: string, threshold: number) => `m:${stat}:${threshold}`;

/** «Потребляет 10 единиц Духа и 5 единиц Выносливости» → { resource: 10, stamina: 5 }. */
export function parseActivationCost(text?: string): AbilityCost {
  const cost: AbilityCost = { resource: 0, stamina: 0 };
  if (!text) return cost;
  const pattern = /(\d+)\s*(?:единиц\S*\s+)?([А-Яа-яЁё]+)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const word = m[2].toLowerCase();
    const value = Number(m[1]);
    if (/^вынослив/.test(word)) cost.stamina += value;
    else if (/^(дух|энерги|биоэнерги)/.test(word)) cost.resource += value;
  }
  return cost;
}

/** «1 раз в день / за день / в сутки» — способность можно применить один раз до нового дня. */
export function isDailyLimited(item: Pick<EquipItem, 'activation' | 'cooldown' | 'effect'>): boolean {
  const text = `${item.activation ?? ''} ${item.cooldown ?? ''}`.toLowerCase();
  return /раз\s+(в|за)\s+(день|сутки)|1\s*\/\s*(день|сутки)/.test(text);
}

/** Есть ли у способности откат, который стоит отмечать (не «Отсутствует»). */
export function hasCooldown(item: Pick<EquipItem, 'cooldown'>): boolean {
  const text = (item.cooldown ?? '').trim().toLowerCase();
  return text !== '' && !/отсутству|нет\b|^[-—–]$/.test(text);
}

/** Скидка на траты Ресурса Пути от Интеллекта: 25% на 50+ (вверх, минимум 1), 50% на 100+ (вниз, минимум 1); лучшая из двух. */
export function reduceResourceCost(character: Character, cost: number): { value: number; note?: string } {
  if (cost <= 0) return { value: cost };
  const intellect = totalStat(character, 'intellect');
  if (intellect >= 100) return { value: Math.max(1, Math.floor(cost * 0.5)), note: 'Абсолютный контур −50%' };
  if (intellect >= 50) return { value: Math.max(1, Math.ceil(cost * 0.75)), note: 'Чистый контур −25%' };
  return { value: cost };
}

export interface UseResult {
  character: Character;
  /** Чего не хватило (для предупреждения до применения). */
  shortage: string[];
}

/** Проверяет, хватает ли пулов на трату. */
export function checkShortage(character: Character, cost: AbilityCost): string[] {
  const lacks: string[] = [];
  if (cost.stamina > character.pools.staminaPoints) {
    lacks.push(`Выносливости: ${character.pools.staminaPoints} из ${cost.stamina}`);
  }
  if (cost.resource > character.pools.resourcePoints) {
    lacks.push(`Ресурса Пути: ${character.pools.resourcePoints} из ${cost.resource}`);
  }
  return lacks;
}

/** Списывает стоимость из пулов и отмечает откат/дневной лимит. */
export function applyUse(
  character: Character,
  key: string,
  cost: AbilityCost,
  flags: { cooldown?: boolean; daily?: boolean },
): Character {
  const usage = { ...(character.usage ?? {}) };
  if (flags.cooldown || flags.daily) {
    usage[key] = { ...usage[key], ...(flags.cooldown ? { cooldown: true } : {}), ...(flags.daily ? { daily: true } : {}) };
  }
  return {
    ...character,
    pools: {
      ...character.pools,
      staminaPoints: character.pools.staminaPoints - cost.stamina,
      resourcePoints: character.pools.resourcePoints - cost.resource,
    },
    usage,
  };
}

export function clearUsage(character: Character, key: string, which: 'cooldown' | 'daily'): Character {
  const usage = { ...(character.usage ?? {}) };
  const entry = { ...usage[key] };
  delete entry[which];
  if (!entry.cooldown && !entry.daily) delete usage[key];
  else usage[key] = entry;
  return { ...character, usage };
}

/** «Новый день» (сутки): снимает откаты и дневные ограничения; пулы не трогает. */
export function startNewDay(character: Character): Character {
  return { ...character, usage: {} };
}

/** Сколько здоровья даёт длительный отдых: модификатор Живучести (с предметами), но не меньше 1. */
export function longRestHealing(character: Character): number {
  return Math.max(1, modifier(totalStat(character, 'vitality')));
}

/**
 * «Длительный отдых» (долгий сон): всё, что и новый день; выносливость и ресурс — до максимума;
 * здоровье восстанавливается на модификатор Живучести (но не выше максимума).
 */
export function longRest(character: Character): Character {
  const max = computeDerivedStats(character);
  return {
    ...character,
    usage: {},
    pools: {
      hp: Math.max(character.pools.hp, Math.min(max.hp, character.pools.hp + longRestHealing(character))),
      staminaPoints: max.staminaPoints,
      resourcePoints: max.resourcePoints,
    },
  };
}

export const SHORT_REST_STEP_MINUTES = 10;

export interface ShortRestGains {
  /** Сколько полных десятиминуток отдыха посчитано (остаток минут не считается). */
  periods: number;
  /** Прибавка за одну десятиминутку: модификатор характеристики, но не меньше 1. */
  staminaPerPeriod: number;
  resourcePerPeriod: number;
  /** Итоговая прибавка с учётом максимума пула. */
  stamina: number;
  resource: number;
}

/**
 * Короткий отдых: за каждые полные 10 минут выносливость и ресурс (Дух / Энергия / Биоэнергия) восстанавливаются
 * на модификатор Выносливости / Ресурса (не меньше 1), но не выше максимума.
 */
export function shortRestGains(character: Character, minutes: number): ShortRestGains {
  const periods = Math.max(0, Math.floor((Number.isFinite(minutes) ? minutes : 0) / SHORT_REST_STEP_MINUTES));
  const staminaPerPeriod = Math.max(1, modifier(totalStat(character, 'endurance')));
  const resourcePerPeriod = Math.max(1, modifier(totalStat(character, 'resource')));
  const max = computeDerivedStats(character);
  const room = (current: number, limit: number) => Math.max(0, limit - current);
  return {
    periods,
    staminaPerPeriod,
    resourcePerPeriod,
    stamina: Math.min(periods * staminaPerPeriod, room(character.pools.staminaPoints, max.staminaPoints)),
    resource: Math.min(periods * resourcePerPeriod, room(character.pools.resourcePoints, max.resourcePoints)),
  };
}

export function shortRest(character: Character, minutes: number): Character {
  const gains = shortRestGains(character, minutes);
  return {
    ...character,
    pools: {
      ...character.pools,
      staminaPoints: character.pools.staminaPoints + gains.stamina,
      resourcePoints: character.pools.resourcePoints + gains.resource,
    },
  };
}

/** Название способности из слота «классовых» списков (Видовые ДНК / Классовые умения / Технологии Модели) — для скидки −50% на стоимость. */
export function isClassAbility(character: Character, abilityName: string): boolean {
  const key = abilityName.trim().toLowerCase();
  if (!key) return false;
  return (character.dnaLists[0]?.slots ?? []).some((slot) => slot.trim().toLowerCase() === key);
}

const halveDown = (value: number) => (value > 0 ? Math.max(1, Math.floor(value / 2)) : 0);

export interface AbilityCostResult {
  /** Итоговая стоимость с учётом всех скидок. */
  cost: AbilityCost;
  /** Стоимость по тексту карточки. */
  base: AbilityCost;
  /** Какие скидки сработали — для подсказки. */
  notes: string[];
}

/**
 * Стоимость применения способности: из текста активации, затем −50% для классовых умений (округление вниз, минимум 1)
 * и скидка Интеллекта на траты ресурса (она считается от уже сниженной цены).
 */
export function computeAbilityCost(character: Character, item: Pick<EquipItem, 'name' | 'activation'>): AbilityCostResult {
  const base = parseActivationCost(item.activation);
  const notes: string[] = [];
  let { resource, stamina } = base;
  if ((resource > 0 || stamina > 0) && isClassAbility(character, item.name)) {
    resource = halveDown(resource);
    stamina = halveDown(stamina);
    notes.push('классовое умение −50%');
  }
  const reduced = reduceResourceCost(character, resource);
  if (reduced.note && reduced.value !== resource) notes.push(reduced.note);
  return { cost: { resource: reduced.value, stamina }, base, notes };
}

/** Эффект активного бонуса порога: восстановление пулов и здоровья (применяется после списания стоимости). */
export function applyMilestoneRestore(character: Character, restore?: MilestoneRestore): Character {
  if (!restore) return character;
  const max = computeDerivedStats(character);
  const pools = { ...character.pools };
  const vitality = totalStat(character, 'vitality');
  switch (restore) {
    case 'stamina-half':
      pools.staminaPoints = Math.max(pools.staminaPoints, Math.min(max.staminaPoints, pools.staminaPoints + Math.ceil(max.staminaPoints / 2)));
      break;
    case 'stamina-full':
      pools.staminaPoints = Math.max(pools.staminaPoints, max.staminaPoints);
      break;
    case 'resource-half':
      pools.resourcePoints = Math.max(pools.resourcePoints, Math.min(max.resourcePoints, pools.resourcePoints + Math.ceil(max.resourcePoints / 2)));
      break;
    case 'resource-full':
      pools.resourcePoints = Math.max(pools.resourcePoints, max.resourcePoints);
      break;
    case 'hp-half-vitality':
      pools.hp = Math.max(pools.hp, Math.min(max.hp, pools.hp + Math.floor(vitality / 2)));
      break;
    case 'last-stand':
      // Хиты становятся равными модификатору Живучести (не меньше 1) — вместо потери сознания.
      pools.hp = Math.max(1, modifier(vitality));
      break;
  }
  return { ...character, pools };
}
