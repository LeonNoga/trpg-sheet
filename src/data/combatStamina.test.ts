import { describe, expect, it } from 'vitest';
import { createBlankCharacter } from './defaults';
import { spendCombatStamina } from './abilityUse';

describe('расход выносливости за бой', () => {
  it.each([[5, 3], [2, 0], [1, -1], [0, -2], [-2, -4]])(
    '%s → %s: списывает ровно 2 и сохраняет остальные данные', (before, after) => {
      const character = createBlankCharacter('tech');
      character.pools = { hp: 7, staminaPoints: before, resourcePoints: 8 };
      character.usage = { ability: { cooldown: true, daily: true } };
      const original = structuredClone(character);
      const result = spendCombatStamina(character);
      expect(result).toEqual({ ...original, pools: { ...original.pools, staminaPoints: after } });
      expect(character).toEqual(original);
    },
  );

  it('последовательные нажатия учитывают каждое списание', () => {
    const character = createBlankCharacter('magic');
    character.pools.staminaPoints = 6;
    const result = spendCombatStamina(spendCombatStamina(spendCombatStamina(character)));
    expect(result.pools.staminaPoints).toBe(0);
  });
});
