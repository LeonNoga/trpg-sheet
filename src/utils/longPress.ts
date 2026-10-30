/** Keeps the synthetic click after a long press from reaching a card action. */
export function createLongPress() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  let startX = 0;
  let startY = 0;
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  return {
    start(x: number, y: number, show: () => void) {
      cancel();
      suppressClick = false;
      startX = x; startY = y;
      timer = setTimeout(() => { suppressClick = true; show(); }, 500);
    },
    move(x: number, y: number) {
      if (Math.hypot(x - startX, y - startY) > 10) { cancel(); suppressClick = true; }
    },
    cancel,
    reset() { cancel(); suppressClick = false; },
    consumeClick() {
      const result = suppressClick;
      suppressClick = false;
      return result;
    },
  };
}
