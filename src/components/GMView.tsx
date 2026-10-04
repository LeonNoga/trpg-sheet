import { useState } from 'react';
import { CharacterList } from './CharacterList';
import { LootTray } from './LootTray';

interface Props {
  onOpenCharacter: (id: string) => void;
  onCreateMasterCharacter: () => void;
}

export function GMView({ onOpenCharacter, onCreateMasterCharacter }: Props) {
  const [tab, setTab] = useState<'players' | 'master' | 'loot'>('players');

  return (
    <div>
      <div className="section-tabs">
        <button className={`nav-tab ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>
          Персонажи игроков
        </button>
        <button className={`nav-tab ${tab === 'master' ? 'active' : ''}`} onClick={() => setTab('master')}>
          Персонажи мастера
        </button>
        <button className={`nav-tab ${tab === 'loot' ? 'active' : ''}`} onClick={() => setTab('loot')}>
          Трей предметов и умений
        </button>
      </div>

      {tab === 'players' && (
        <CharacterList
          roster="gm-player"
          onOpen={onOpenCharacter}
          onCreate={() => {}}
          hideCreate
          importLabel="Импортировать JSON игрока"
          emptyHint="Импортируйте JSON-файлы, присланные игроками."
        />
      )}

      {tab === 'master' && (
        <CharacterList
          roster="gm-master"
          onOpen={onOpenCharacter}
          onCreate={onCreateMasterCharacter}
          importLabel="Импортировать JSON"
          emptyHint="Создайте своего первого NPC/персонажа мастера."
        />
      )}

      {tab === 'loot' && <LootTray />}
    </div>
  );
}
