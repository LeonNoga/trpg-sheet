import { STAT_ORDER } from './statsConfig';
import type { BonusKey, Character, DerivedKey, EquipItem, InitiativeSource, StatKey } from '../types';

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

export function computeDerivedStats(character: Character): DerivedStats {
  const modAgility = modifier(totalStat(character, 'agility'));
  const modIntellect = modifier(totalStat(character, 'intellect'));
  const modPerception = modifier(totalStat(character, 'perception'));
  const modFortitude = modifier(totalStat(character, 'fortitude'));
  const modKeyStat = modifier(totalStat(character, character.keyStat));

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
    resistance: 18 + modKeyStat + bonus('resistance'),
    staminaPoints: totalStat(character, 'endurance') + bonus('staminaPoints'),
    resourcePoints: totalStat(character, 'resource') + bonus('resourcePoints'),
  };
}
