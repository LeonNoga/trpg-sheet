/**
 * Возвращает удалённые записи на прежние места в актуальный список (а не откатывает весь список целиком):
 * пока висело уведомление «Отменить», пользователь мог уже изменить другие записи.
 */
export function reinsertRemoved<T extends { id: string }>(
  current: T[],
  removed: { item: T; index: number }[],
): T[] {
  const present = new Set(current.map((i) => i.id));
  const result = [...current];
  for (const { item, index } of [...removed].sort((a, b) => a.index - b.index)) {
    if (present.has(item.id)) continue;
    result.splice(Math.min(index, result.length), 0, item);
  }
  return result;
}
