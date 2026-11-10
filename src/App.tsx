import { useEffect, useRef, useState } from 'react';
import { AppDataProvider } from './state/AppDataContext';
import { CharacterList } from './components/CharacterList';
import { CreationWizard } from './components/CreationWizard';
import { CharacterSheet } from './components/CharacterSheet';
import { ReferenceSheetScreen } from './components/ReferenceSheetScreen';
import { GMView } from './components/GMView';
import { BackupPanel } from './components/BackupPanel';
import { ExportFallbackDialog, ImageFallbackDialog } from './components/FileDialogs';
import { NoticeBar } from './components/NoticeBar';
import { UndoProvider } from './state/UndoContext';
import { HeaderSlotContext } from './state/HeaderSlot';
import { applyTheme, loadTheme, nextTheme, THEME_LABELS } from './theme';
import type { Theme } from './theme';
import type { Roster } from './types';

type View =
  | { screen: 'list' }
  | { screen: 'create'; roster: Roster }
  | { screen: 'sheet'; id: string; returnTo: 'list' | 'gm' }
  | { screen: 'reference' }
  | { screen: 'gm' };

function Shell() {
  const [view, setView] = useState<View>({ screen: 'list' });
  const [theme, setTheme] = useState<Theme>(loadTheme);
  // Меню «⋯» на телефоне: навигация, тема и (на экране персонажа) его действия, которые он выносит в menuSlot.
  const [menuSlot, setMenuSlot] = useState<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    // Нативный слушатель: кнопки из портала экрана персонажа не проходят через React-родителей меню.
    const closeOnPress = (e: Event) => {
      if ((e.target as HTMLElement).closest('button')) menu.open = false;
    };
    menu.addEventListener('click', closeOnPress);
    return () => menu.removeEventListener('click', closeOnPress);
  }, []);

  function switchTheme() {
    const next = nextTheme(theme);
    applyTheme(next);
    setTheme(next);
  }

  const topTab: 'list' | 'gm' | 'reference' =
    view.screen === 'gm' ? 'gm' : view.screen === 'reference' ? 'reference' : 'list';

  return (
    <>
      <header className="app-header">
        {view.screen === 'sheet' && (
          <button className="btn btn-sm phone-only" onClick={() => setView({ screen: view.returnTo })}>
            ← К списку
          </button>
        )}
        <h1 className={view.screen === 'sheet' ? 'hide-on-phone' : ''}>Карточка персонажа</h1>
        <nav className="nav-tabs">
          <button className={`nav-tab ${topTab === 'list' ? 'active' : ''}`} onClick={() => setView({ screen: 'list' })}>
            Персонажи
          </button>
          <button className={`nav-tab ${topTab === 'gm' ? 'active' : ''}`} onClick={() => setView({ screen: 'gm' })}>
            Мастер-вид
          </button>
          <button
            className={`nav-tab ${topTab === 'reference' ? 'active' : ''}`}
            onClick={() => setView({ screen: 'reference' })}
          >
            Памятка и прогрессия
          </button>
        </nav>
        <button className="btn btn-sm theme-toggle" title="Тема оформления: нажмите, чтобы переключить" onClick={switchTheme}>
          ◐ {THEME_LABELS[theme]}
        </button>
        <details className="more-menu app-menu phone-only" ref={menuRef}>
          <summary className="btn btn-sm" aria-label="Меню">
            ⋯
          </summary>
          <div className="more-menu-list">
            <button className="btn btn-ghost" onClick={() => setView({ screen: 'list' })}>
              Персонажи
            </button>
            <button className="btn btn-ghost" onClick={() => setView({ screen: 'gm' })}>
              Мастер-вид
            </button>
            <button className="btn btn-ghost" onClick={() => setView({ screen: 'reference' })}>
              Памятка и прогрессия
            </button>
            <button className="btn btn-ghost" onClick={switchTheme}>
              ◐ Тема: {THEME_LABELS[theme]}
            </button>
            <div className="menu-slot" ref={setMenuSlot} />
          </div>
        </details>
      </header>

      <ExportFallbackDialog />
      <ImageFallbackDialog />
      <NoticeBar />

      <HeaderSlotContext.Provider value={menuSlot}>
      <main className="app-main">
        {view.screen === 'list' && (
          <>
            <CharacterList
              roster="personal"
              onOpen={(id) => setView({ screen: 'sheet', id, returnTo: 'list' })}
              onCreate={() => setView({ screen: 'create', roster: 'personal' })}
            />
            <BackupPanel />
          </>
        )}

        {view.screen === 'create' && (
          <CreationWizard
            roster={view.roster}
            onFinish={(id) => setView({ screen: 'sheet', id, returnTo: view.roster === 'gm-master' ? 'gm' : 'list' })}
            onCancel={() => setView(view.roster === 'gm-master' ? { screen: 'gm' } : { screen: 'list' })}
          />
        )}

        {view.screen === 'sheet' && (
          <CharacterSheet
            characterId={view.id}
            onBack={() => setView({ screen: view.returnTo })}
          />
        )}

        {view.screen === 'reference' && <ReferenceSheetScreen />}

        {view.screen === 'gm' && (
          <GMView
            onOpenCharacter={(id) => setView({ screen: 'sheet', id, returnTo: 'gm' })}
            onCreateMasterCharacter={() => setView({ screen: 'create', roster: 'gm-master' })}
          />
        )}
      </main>
      </HeaderSlotContext.Provider>
    </>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <UndoProvider>
        <Shell />
      </UndoProvider>
    </AppDataProvider>
  );
}
