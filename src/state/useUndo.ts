import { createContext, useContext } from 'react';

export interface UndoValue {
  /** Показывает уведомление «Удалено… Отменить»; undo вызывается по нажатию (в течение 8 секунд). */
  showUndo: (message: string, undo: () => void) => void;
}

export const UndoContext = createContext<UndoValue | null>(null);

export function useUndo(): UndoValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}
