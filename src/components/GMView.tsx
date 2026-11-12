import { useState } from 'react';
import { useAppData } from '../state/useAppData';
import { CharacterList } from './CharacterList';
import { CombatTab } from './CombatTab';
import { EnemiesTab } from './EnemiesTab';
import { GroupBar } from './GroupBar';
import { LootTray } from './LootTray';
import { inGroup } from '../data/gm';

interface Props {
  onOpenCharacter: (id: string) => void;
  onCreateMasterCharacter: () => void;
}

type Tab = 'players' | 'enemies' | 'combat' | 'master' | 'loot';

/** Мастер-вид: сверху выбор группы игроков, внутри группы — игроки, противники, бой, персонажи мастера и лут. */
export function GMView({ onOpenCharacter, onCreateMasterCharacter }: Props) {
  const [tab, setTab] = useState<Tab>('players');
  const { activeGroupId, groups, characters, enemies, lootTray, encounters } = useAppData();

  const players = characters.filter((c) => c.roster === 'gm-player' && inGroup(c, activeGroupId, groups)).length;
  const master = characters.filter((c) => c.roster === 'gm-master' && inGroup(c, activeGroupId, groups)).length;
  const groupEnemies = enemies.filter((e) => inGroup(e, activeGroupId, groups)).length;
  const loot = lootTray.filter((i) => inGroup(i, activeGroupId, groups)).length;
  const fighting = encounters.some((e) => e.groupId === activeGroupId && e.active);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'players', label: `Игроки (${players})` },
    { key: 'enemies', label: `Противники (${groupEnemies})` },
    { key: 'combat', label: fighting ? '⚔ Бой (идёт)' : '⚔ Бой' },
    { key: 'master', label: `Персонажи мастера (${master})` },
    { key: 'loot', label: `Трей (${loot})` },
  ];

  return (
    <div>
      <GroupBar />
      <div className="section-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`nav-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'players' && (
        <CharacterList
          roster="gm-player"
          groupId={activeGroupId}
          onOpen={onOpenCharacter}
          onCreate={() => {}}
          hideCreate
          importLabel="Импортировать JSON игрока"
          emptyHint="В этой группе пока нет игроков. Импортируйте JSON-файлы, присланные игроками."
        />
      )}

      {tab === 'enemies' && <EnemiesTab />}

      {tab === 'combat' && <CombatTab />}

      {tab === 'master' && (
        <CharacterList
          roster="gm-master"
          groupId={activeGroupId}
          onOpen={onOpenCharacter}
          onCreate={onCreateMasterCharacter}
          importLabel="Импортировать JSON"
          emptyHint="Создайте своего первого NPC/персонажа мастера."
        />
      )}

      {tab === 'loot' && <LootTray groupId={activeGroupId} />}
    </div>
  );
}
