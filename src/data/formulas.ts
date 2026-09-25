import { STAT_ORDER } from './statsConfig';
import type { BonusKey, Character, DerivedKey, EquipItem, StatKey } from '../types';

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

export function computeDerivedStats(character: Character): DerivedStats {
  const modAgility = modifier(totalStat(character, 'agility'));
  const modIntellect = modifier(totalStat(character, 'intellect'));
  const modPerception = modifier(totalStat(character, 'perception'));
  const modFortitude = modifier(totalStat(character, 'fortitude'));
  const modKeyStat = modifier(totalStat(character, character.keyStat));

  const bonus = (key: DerivedKey) => bonusSum(character, key);

  return {
    hp: totalStat(character, 'vitality') + character.level + bonus('hp'),
    defense: 18 + modFortitude + bonus('defense'),
    speed: 5 + modAgility + bonus('speed'),
    passivePerception: 18 + modPerception + bonus('passivePerception'),
    initiative: Math.max(modAgility, modIntellect, modPerception) + bonus('initiative'),
    resistance: 18 + modKeyStat + bonus('resistance'),
    staminaPoints: totalStat(character, 'endurance') + bonus('staminaPoints'),
    resourcePoints: totalStat(character, 'resource') + bonus('resourcePoints'),
  };
}
