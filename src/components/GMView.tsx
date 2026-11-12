import { useState } from 'react';
import { useAppData } from '../state/useAppData';
import { CharacterList } from './CharacterList';
import { CombatTab } from './CombatTab';
import { EnemiesTab } from './EnemiesTab';
import { GMBackupPanel } from './GMBackupPanel';
import { GroupBar } from './GroupBar';
import { LootList } from './LootList';
import { PlayersTab } from './PlayersTab';
import { inGroup } from '../data/gm';

interface Props {
  onOpenCharacter: (id: string) => void;
  onCreateMasterCharacter: () => void;
}

type Tab = 'players' | 'enemies' | 'combat' | 'master' | 'loot' | 'masterLoot';

/** Мастер-вид: сверху выбор группы игроков, внутри группы — игроки (мини-карточки), противники, бой, персонажи мастера и лут; общий лут мастера — отдельно. */
export function GMView({ onOpenCharacter, onCreateMasterCharacter }: Props) {
  const [tab, setTab] = useState<Tab>('players');
  const { activeGroupId, groups, characters, enemies, members, lootTray, masterLoot, encounters } = useAppData();

  const players = members.filter((m) => inGroup(m, activeGroupId, groups)).length;
  const master = characters.filter((c) => c.roster === 'gm-master' && inGroup(c, activeGroupId, groups)).length;
  const groupEnemies = enemies.filter((e) => inGroup(e, activeGroupId, groups)).length;
  const loot = lootTray.filter((i) => inGroup(i, activeGroupId, groups)).length;
  const fighting = encounters.some((e) => e.groupId === activeGroupId && e.active);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'players', label: `Игроки (${players})` },
    { key: 'enemies', label: `Противники (${groupEnemies})` },
    { key: 'combat', label: fighting ? '⚔ Бой (идёт)' : '⚔ Бой' },
    { key: 'master', label: `Персонажи мастера (${master})` },
    { key: 'loot', label: `Лут группы (${loot})` },
    { key: 'masterLoot', label: `📦 Лут мастера (${masterLoot.length})` },
  ];
  const groupless = tab === 'masterLoot';

  return (
    <div>
      <GMBackupPanel />
      <div className={groupless ? 'group-bar-dim' : undefined}>
        <GroupBar />
      </div>
      <div className="section-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`nav-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'players' && <PlayersTab />}

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

      {tab === 'loot' && <LootList scope="group" groupId={activeGroupId} />}

      {tab === 'masterLoot' && <LootList scope="master" />}
    </div>
  );
}
