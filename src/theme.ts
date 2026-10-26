export type Theme = 'auto' | 'light' | 'dark';

const KEY = 'trpg-theme';
const ORDER: Theme[] = ['auto', 'light', 'dark'];

export const THEME_LABELS: Record<Theme, string> = {
  auto: 'Авто',
  light: 'Светлая',
  dark: 'Тёмная',
};

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    return ORDER.includes(stored as Theme) ? (stored as Theme) : 'auto';
  } catch {
    return 'auto';
  }
}

/** Применяет тему к странице; «Авто» следует системной настройке (prefers-color-scheme). */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // без localStorage (приватный режим) тема просто не запомнится
  }
}

export function nextTheme(theme: Theme): Theme {
  return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
}
