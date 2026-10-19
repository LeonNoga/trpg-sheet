import { PATH_RESOURCE_LABEL, RESISTANCE_ALLOWED_STATS, STAT_ORDER } from './statsConfig';
import type { BonusKey, Character, DerivedKey, EquipItem, InitiativeSource, ResistanceSource, StatKey } from '../types';

export function modifier(total: number): number {
  return Math.floor((total - 10) / 5);
}

function equippedBonusSources(character: Character): EquipItem[] {
  return [...character.items, ...character.abilities].filter((it) => it.equipped);
}

export function bonusSum(character: Character, key: BonusKey): number {
  return equippedBonusSources(character).reduce(
    (sum, it) => sum + (it.statBonuses[key] ?? 0),
    0,
  );
}

export function totalStat(character: Character, stat: StatKey): number {
  return character.baseStats[stat] + bonusSum(character, stat);
}

export function sumBaseStats(character: Character): number {
  return STAT_ORDER.reduce((sum, key) => sum + (character.baseStats[key] ?? 0), 0);
}

export interface DerivedStats {
  hp: number;
  defense: number;
  speed: number;
  passivePerception: number;
  initiative: number;
  resistance: number;
  staminaPoints: number;
  resourcePoints: number;
}

/** Какая характеристика сейчас фактически определяет Инициативу — для отображения в UI. */
export function currentInitiativeStat(character: Character): Exclude<InitiativeSource, 'auto'> {
  if (character.initiativeSource && character.initiativeSource !== 'auto') return character.initiativeSource;
  const mods: [Exclude<InitiativeSource, 'auto'>, number][] = [
    ['agility', modifier(totalStat(character, 'agility'))],
    ['intellect', modifier(totalStat(character, 'intellect'))],
    ['perception', modifier(totalStat(character, 'perception'))],
  ];
  return mods.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

/** Какая характеристика сейчас фактически определяет Сложность Сопротивления — для отображения в UI. */
export function currentResistanceStat(character: Character): Exclude<ResistanceSource, 'auto'> {
  const allowed = RESISTANCE_ALLOWED_STATS[character.path];
  if (character.resistanceSource && character.resistanceSource !== 'auto' && (allowed as string[]).includes(character.resistanceSource)) {
    return character.resistanceSource;
  }
  const mods = allowed.map((stat): [Exclude<ResistanceSource, 'auto'>, number] => [stat, modifier(totalStat(character, stat))]);
  return mods.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

export function computeDerivedStats(character: Character): DerivedStats {
  const modAgility = modifier(totalStat(character, 'agility'));
  const modIntellect = modifier(totalStat(character, 'intellect'));
  const modPerception = modifier(totalStat(character, 'perception'));
  const modFortitude = modifier(totalStat(character, 'fortitude'));
  const modResistanceStat = modifier(totalStat(character, currentResistanceStat(character)));

  const initiativeMods = { agility: modAgility, intellect: modIntellect, perception: modPerception };
  const initiativeBase =
    character.initiativeSource && character.initiativeSource !== 'auto'
      ? initiativeMods[character.initiativeSource]
      : Math.max(modAgility, modIntellect, modPerception);

  const bonus = (key: DerivedKey) => bonusSum(character, key);

  return {
    hp: totalStat(character, 'vitality') + character.level + bonus('hp'),
    defense: 18 + modFortitude + bonus('defense'),
    speed: 5 + modAgility + bonus('speed'),
    passivePerception: 18 + modPerception + bonus('passivePerception'),
    initiative: initiativeBase + bonus('initiative'),
    resistance: 18 + modResistanceStat + bonus('resistance'),
    staminaPoints: totalStat(character, 'endurance') + bonus('staminaPoints'),
    resourcePoints: totalStat(character, 'resource') + bonus('resourcePoints'),
  };
}

export interface BonusSource {
  name: string;
  value: number;
}

/** Какие надетые предметы/умения и сколько именно дают к характеристике или показателю (в т.ч. штрафы). */
export function bonusSources(character: Character, key: BonusKey): BonusSource[] {
  return equippedBonusSources(character)
    .filter((it) => (it.statBonuses[key] ?? 0) !== 0)
    .map((it) => ({ name: it.name || 'Без названия', value: it.statBonuses[key] ?? 0 }));
}

export interface DerivedPart {
  label: string;
  value: number;
}

export interface DerivedBreakdown {
  /** Слагаемые расчёта без предметов: база формулы, модификаторы, уровень. */
  parts: DerivedPart[];
  /** Пояснение к формуле (например, по какой характеристике считается инициатива). */
  note?: string;
  items: BonusSource[];
  total: number;
}

/** Из чего складывается показатель — то же, что считает computeDerivedStats, но по слагаемым. */
export function derivedBreakdown(character: Character, key: DerivedKey): DerivedBreakdown {
  const mod = (stat: StatKey) => modifier(totalStat(character, stat));
  const items = bonusSources(character, key);
  let parts: DerivedPart[];
  let note: string | undefined;

  switch (key) {
    case 'hp':
      parts = [
        { label: 'Живучесть', value: totalStat(character, 'vitality') },
        { label: 'Уровень', value: character.level },
      ];
      break;
    case 'defense':
      parts = [
        { label: 'База', value: 18 },
        { label: 'Мод. Стойкости', value: mod('fortitude') },
      ];
      break;
    case 'speed':
      parts = [
        { label: 'База', value: 5 },
        { label: 'Мод. Ловкости', value: mod('agility') },
      ];
      break;
    case 'passivePerception':
      parts = [
        { label: 'База', value: 18 },
        { label: 'Мод. Восприятия', value: mod('perception') },
      ];
      break;
    case 'initiative': {
      const picked = currentInitiativeStat(character);
      parts = [{ label: `Мод. ${STAT_NAMES[picked]}`, value: mod(picked) }];
      note =
        `Ловкость ${signed(mod('agility'))}, Интеллект ${signed(mod('intellect'))}, Восприятие ${signed(mod('perception'))}` +
        (character.initiativeSource === 'auto' || !character.initiativeSource ? ' — берётся наибольший' : ' — выбрано вручную');
      break;
    }
    case 'resistance': {
      const picked = currentResistanceStat(character);
      parts = [
        { label: 'База', value: 18 },
        { label: `Мод. ${STAT_NAMES[picked]}`, value: mod(picked) },
      ];
      break;
    }
    case 'staminaPoints':
      parts = [{ label: 'Выносливость', value: totalStat(character, 'endurance') }];
      break;
    case 'resourcePoints':
      parts = [{ label: PATH_RESOURCE_LABEL[character.path], value: totalStat(character, 'resource') }];
      break;
  }

  const total = parts.reduce((s, p) => s + p.value, 0) + items.reduce((s, i) => s + i.value, 0);
  return { parts, note, items, total };
}

const STAT_NAMES: Record<'agility' | 'intellect' | 'perception' | 'strength', string> = {
  agility: 'Ловкости',
  intellect: 'Интеллекта',
  perception: 'Восприятия',
  strength: 'Силы',
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}
