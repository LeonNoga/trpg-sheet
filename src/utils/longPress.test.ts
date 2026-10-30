import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLongPress } from './longPress';
import { createBlankCharacter } from '../data/defaults';
import { spendCombatStamina } from '../data/abilityUse';

describe('долгий тап карточки ресурса', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('долгий тап открывает подсказку и не списывает выносливость при отпускании', () => {
    const gesture = createLongPress();
    const show = vi.fn();
    let character = createBlankCharacter('tech');
    character.pools.staminaPoints = 10;
    gesture.start(20, 30, show);
    vi.advanceTimersByTime(500);
    gesture.cancel(); // pointerup
    // Capture must consume the subsequent click before the stamina button receives it.
    if (!gesture.consumeClick()) character = spendCombatStamina(character);
    expect(show).toHaveBeenCalledTimes(1);
    expect(character.pools.staminaPoints).toBe(10);
  });

  it('короткий тап списывает ровно 2, не открывая подсказку', () => {
    const gesture = createLongPress();
    const show = vi.fn();
    let character = createBlankCharacter('tech');
    character.pools.staminaPoints = 10;
    gesture.start(0, 0, show);
    vi.advanceTimersByTime(499);
    gesture.cancel();
    if (!gesture.consumeClick()) character = spendCombatStamina(character);
    vi.runAllTimers();
    expect(show).not.toHaveBeenCalled();
    expect(character.pools.staminaPoints).toBe(8);
  });

  it('после долгого тапа следующий короткий тап работает обычно', () => {
    const gesture = createLongPress();
    gesture.start(0, 0, vi.fn());
    vi.advanceTimersByTime(500);
    gesture.cancel();
    // Some browsers do not send a click at all after a long press.
    gesture.start(0, 0, vi.fn());
    gesture.cancel();
    expect(gesture.consumeClick()).toBe(false);
  });

  it('движение пальца для прокрутки отменяет таймер и подавляет случайный клик', () => {
    const gesture = createLongPress();
    const show = vi.fn();
    gesture.start(0, 0, show);
    gesture.move(0, 15);
    vi.runAllTimers();
    expect(show).not.toHaveBeenCalled();
    expect(gesture.consumeClick()).toBe(true);
  });

  it('отмена жеста или размонтирование убирает отложенное открытие', () => {
    const gesture = createLongPress();
    const show = vi.fn();
    gesture.start(0, 0, show);
    gesture.cancel();
    vi.runAllTimers();
    expect(show).not.toHaveBeenCalled();
  });
});
