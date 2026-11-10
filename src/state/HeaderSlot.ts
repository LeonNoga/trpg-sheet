import { createContext } from 'react';

/** Место в шапке приложения (меню «⋯» на телефоне), куда экран персонажа выносит свои действия: экспорт, картинка, история… */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);
