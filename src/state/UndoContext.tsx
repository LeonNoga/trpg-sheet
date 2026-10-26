import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface UndoValue {
  /** Показывает уведомление «Удалено… Отменить»; undo вызывается по нажатию (в течение 8 секунд). */
  showUndo: (message: string, undo: () => void) => void;
}

const UndoContext = createContext<UndoValue | null>(null);

const VISIBLE_MS = 8000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; undo: () => void } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const counter = useRef(0);

  const showUndo = useCallback((message: string, undo: () => void) => {
    window.clearTimeout(timer.current);
    counter.current += 1;
    setToast({ id: counter.current, message, undo });
    timer.current = window.setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      {toast && (
        <div className="undo-toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          <button
            className="btn btn-sm"
            onClick={() => {
              toast.undo();
              window.clearTimeout(timer.current);
              setToast(null);
            }}
          >
            Отменить
          </button>
        </div>
      )}
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}
