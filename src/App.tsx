import { useState } from 'react';
import { AppDataProvider } from './state/AppDataContext';
import { CharacterList } from './components/CharacterList';
import { CreationWizard } from './components/CreationWizard';
import { CharacterSheet } from './components/CharacterSheet';
import { ReferenceSheetScreen } from './components/ReferenceSheetScreen';
import { GMView } from './components/GMView';
import type { Roster } from './types';

type View =
  | { screen: 'list' }
  | { screen: 'create'; roster: Roster }
  | { screen: 'sheet'; id: string; returnTo: 'list' | 'gm' }
  | { screen: 'reference' }
  | { screen: 'gm' };

function Shell() {
  const [view, setView] = useState<View>({ screen: 'list' });

  const topTab: 'list' | 'gm' | 'reference' =
    view.screen === 'gm' ? 'gm' : view.screen === 'reference' ? 'reference' : 'list';

  return (
    <>
      <header className="app-header">
        <h1>Карточка персонажа</h1>
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
      </header>

      <main className="app-main">
        {view.screen === 'list' && (
          <CharacterList
            roster="personal"
            onOpen={(id) => setView({ screen: 'sheet', id, returnTo: 'list' })}
            onCreate={() => setView({ screen: 'create', roster: 'personal' })}
          />
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
    </>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <Shell />
    </AppDataProvider>
  );
}
