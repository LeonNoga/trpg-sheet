import type { Character } from '../types';

const whole = (amount: number) => Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));

/** «Всосать»: переносит очки из жемчужины в запас очков развития персонажа (не больше, чем в жемчужине). */
export function absorbFromPearl(character: Character, pearlId: string, amount: number): Character {
  const pearl = (character.pearls ?? []).find((p) => p.id === pearlId);
  if (!pearl) return character;
  const moved = Math.min(whole(amount), Math.max(0, pearl.points));
  return {
    ...character,
    developmentPoints: character.developmentPoints + moved,
    pearls: (character.pearls ?? []).map((p) => (p.id === pearlId ? { ...p, points: p.points - moved } : p)),
  };
}

/** Обратно: вкладывает очки развития персонажа в жемчужину (не больше, чем есть в запасе). */
export function fillPearl(character: Character, pearlId: string, amount: number): Character {
  const pearl = (character.pearls ?? []).find((p) => p.id === pearlId);
  if (!pearl) return character;
  const moved = Math.min(whole(amount), Math.max(0, character.developmentPoints));
  return {
    ...character,
    developmentPoints: character.developmentPoints - moved,
    pearls: (character.pearls ?? []).map((p) => (p.id === pearlId ? { ...p, points: p.points + moved } : p)),
  };
}
