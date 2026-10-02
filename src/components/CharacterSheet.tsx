import { useEffect, useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { StatBudgetBar } from './StatsEditor';
import { CharacteristicsPanel } from './CharacteristicsPanel';
import { SkillsEditor } from './SkillsEditor';
import { ItemsBlock } from './ItemsBlock';
import { NumberField } from './NumberField';
import { SpeciesBonusesCard, DnaListsCard } from './TraitBlocks';
import { EquipmentSilhouette } from './EquipmentSilhouette';
import { SkillTrainingScreen } from './SkillTrainingScreen';
import { AdditionalInfoTab } from './AdditionalInfoTab';
import { PATH_LABELS, PATH_SPECIES_FIELD_LABEL, PATH_TRAIT_LABELS, STARTING_STAT_POINTS } from '../data/statsConfig';
import { MAX_LEVEL, POINTS_PER_LEVEL } from '../data/progression';
import { exportCharacter } from '../storage/exportImport';
import type {
  Character,
  EquipItem,
  InitiativeSource,
  PoolKey,
  ResistanceSource,
  SkillLevel,
  StatKey,
  TraitList,
} from '../types';

interface Props {
  characterId: string;
  onBack: () => void;
}

type Tab = 'character' | 'equipment' | 'abilities' | 'training' | 'info';

const TABS: { key: Tab; label: string }[] = [
  { key: 'character', label: 'Персонаж' },
  { key: 'equipment', label: 'Снаряжение' },
  { key: 'abilities', label: 'Умения' },
  { key: 'training', label: 'Прокачка навыков' },
  { key: 'info', label: 'Доп. информация' },
];

export function CharacterSheet({ characterId, onBack }: Props) {
  const { characters, updateCharacter, removeCharacter } = useAppData();
  const character = characters.find((c) => c.id === characterId);
  const [tab, setTab] = useState<Tab>('character');
  const [xpToAdd, setXpToAdd] = useState('');
  const [levelDraft, setLevelDraft] = useState(character?.level ?? 1);

  useEffect(() => {
    if (character) setLevelDraft(character.level);
  }, [character?.level]);

  if (!character) {
    return (
      <div className="empty-state">
        Персонаж не найден.
        <div>
          <button className="btn" onClick={onBack}>
            Назад
          </button>
        </div>
      </div>
    );
  }

  function patch(updater: (c: Character) => Character) {
    updateCharacter(updater(character!));
  }

  function changeStat(key: StatKey, value: number) {
    patch((c) => ({ ...c, baseStats: { ...c.baseStats, [key]: value } }));
  }

  function changePool(key: PoolKey, value: number) {
    patch((c) => ({ ...c, pools: { ...c.pools, [key]: value } }));
  }

  function changeInitiativeSource(source: InitiativeSource) {
    patch((c) => ({ ...c, initiativeSource: source }));
  }

  function changeResistanceSource(source: ResistanceSource) {
    patch((c) => ({ ...c, resistanceSource: source }));
  }

  function changeSkill(skill: string, level: SkillLevel) {
    patch((c) => ({ ...c, skills: { ...c.skills, [skill]: level } }));
  }

  function changeTrainingDays(skill: string, days: number) {
    patch((c) => ({ ...c, skillTrainingDays: { ...c.skillTrainingDays, [skill]: Math.max(0, days) } }));
  }

  function levelUpSkill(skill: string, newLevel: SkillLevel) {
    patch((c) => ({
      ...c,
      skills: { ...c.skills, [skill]: newLevel },
      skillTrainingDays: { ...c.skillTrainingDays, [skill]: 0 },
    }));
  }

  function addExperience() {
    const amount = Number(xpToAdd);
    if (!amount) return;
    patch((c) => ({ ...c, experience: c.experience + amount }));
    setXpToAdd('');
  }

  function commitLevelDraft() {
    const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.round(levelDraft) || 1));
    if (clamped === character!.level) {
      setLevelDraft(character!.level);
      return;
    }
    const newBudget = STARTING_STAT_POINTS + POINTS_PER_LEVEL * (clamped - 1);
    const confirmed = confirm(
      `Установить уровень ${clamped} вручную?\n\nОпыт будет сброшен в 0, а бюджет очков характеристик пересчитан: ` +
        `${STARTING_STAT_POINTS} + ${POINTS_PER_LEVEL} × ${clamped - 1} = ${newBudget}.`,
    );
    if (!confirmed) {
      setLevelDraft(character!.level);
      return;
    }
    patch((c) => ({ ...c, level: clamped, experience: 0, statPointsBudget: newBudget }));
  }

  function handleDelete() {
    if (confirm(`Удалить персонажа «${character!.characterName || 'без имени'}»? Это необратимо.`)) {
      removeCharacter(character!.id);
      onBack();
    }
  }

  const traitLabels = PATH_TRAIT_LABELS[character.path];

  return (
    <div className={`theme-${character.path}`}>
      <div className="top-actions">
        <button className="btn" onClick={onBack}>
          ← К списку
        </button>
        <button className="btn" onClick={() => exportCharacter(character)}>
          Экспорт в JSON
        </button>
        <button className="btn btn-danger" onClick={handleDelete}>
          Удалить персонажа
        </button>
      </div>

      <div className="card">
        <span className="pill-badge">{PATH_LABELS[character.path]}</span>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field">
            <label>Имя игрока</label>
            <input
              value={character.playerName}
              onChange={(e) => patch((c) => ({ ...c, playerName: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Имя персонажа</label>
            <input
              value={character.characterName}
              onChange={(e) => patch((c) => ({ ...c, characterName: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>{PATH_SPECIES_FIELD_LABEL[character.path]}</label>
            <input value={character.species} onChange={(e) => patch((c) => ({ ...c, species: e.target.value }))} />
          </div>
        </div>

        <div className="header-fields-grid">
          <div className="field">
            <label>Уровень</label>
            <NumberField
              min={1}
              max={MAX_LEVEL}
              value={levelDraft}
              onChange={setLevelDraft}
              onBlur={commitLevelDraft}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              title="Изменить вручную: опыт обнулится, бюджет очков пересчитается"
            />
          </div>
          <div className="field">
            <label>Опыт (кошелёк)</label>
            <NumberField value={character.experience} onChange={(v) => patch((c) => ({ ...c, experience: v }))} />
          </div>
          <div className="field">
            <label>Добавить опыт</label>
            <div className="xp-add-row">
              <input
                type="number"
                value={xpToAdd}
                placeholder="+ сколько"
                onChange={(e) => setXpToAdd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExperience()}
              />
              <button type="button" className="btn btn-sm" onClick={addExperience}>
                +
              </button>
            </div>
          </div>
          <div className="field">
            <label>Бюджет очков характеристик</label>
            <NumberField value={character.statPointsBudget} onChange={(v) => patch((c) => ({ ...c, statPointsBudget: v }))} />
          </div>
        </div>
      </div>

      <div className="sheet-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`nav-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'character' && (
        <>
          <div className="row">
            <div style={{ flex: 1, minWidth: 260 }}>
              <SpeciesBonusesCard
                title={traitLabels.bonuses}
                list={character.speciesBonuses}
                onChange={(speciesBonuses) => patch((c) => ({ ...c, speciesBonuses }))}
              />
            </div>
            <div style={{ flex: 2, minWidth: 320 }}>
              <DnaListsCard
                titles={[traitLabels.dnaA, traitLabels.dnaB]}
                lists={character.dnaLists}
                onChange={(dnaLists: TraitList[]) => patch((c) => ({ ...c, dnaLists }))}
              />
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Характеристики и показатели</h3>
            <StatBudgetBar character={character} />
            <CharacteristicsPanel
              character={character}
              onChangeStat={changeStat}
              onChangePool={changePool}
              onChangeInitiativeSource={changeInitiativeSource}
              onChangeResistanceSource={changeResistanceSource}
            />
          </div>

          <div className="card">
            <h3 className="card-title">Навыки</h3>
            <SkillsEditor character={character} onChangeSkill={changeSkill} />
          </div>
        </>
      )}

      {tab === 'equipment' && (
        <>
          <EquipmentSilhouette character={character} onChange={(equippedSlots) => patch((c) => ({ ...c, equippedSlots }))} />
          <ItemsBlock
            title="Предметы"
            kind="item"
            items={character.items}
            path={character.path}
            onChange={(items: EquipItem[]) => patch((c) => ({ ...c, items }))}
          />
        </>
      )}

      {tab === 'abilities' && (
        <ItemsBlock
          title="Умения"
          kind="ability"
          items={character.abilities}
          path={character.path}
          onChange={(abilities: EquipItem[]) => patch((c) => ({ ...c, abilities }))}
        />
      )}

      {tab === 'training' && (
        <SkillTrainingScreen character={character} onChangeDays={changeTrainingDays} onLevelUp={levelUpSkill} />
      )}

      {tab === 'info' && <AdditionalInfoTab character={character} onPatch={patch} />}
    </div>
  );
}
