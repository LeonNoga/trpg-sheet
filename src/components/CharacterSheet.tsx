import { useAppData } from '../state/AppDataContext';
import { StatsEditor, StatBudgetBar } from './StatsEditor';
import { DerivedStatsPanel } from './DerivedStatsPanel';
import { SkillsEditor } from './SkillsEditor';
import { ItemsBlock } from './ItemsBlock';
import { PATH_LABELS } from '../data/statsConfig';
import { exportCharacter } from '../storage/exportImport';
import type { Character, EquipItem, SkillLevel, StatKey } from '../types';

interface Props {
  characterId: string;
  onBack: () => void;
}

export function CharacterSheet({ characterId, onBack }: Props) {
  const { characters, updateCharacter, removeCharacter } = useAppData();
  const character = characters.find((c) => c.id === characterId);

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

  function changeSkill(skill: string, level: SkillLevel) {
    patch((c) => ({ ...c, skills: { ...c.skills, [skill]: level } }));
  }

  function handleDelete() {
    if (confirm(`Удалить персонажа «${character!.characterName || 'без имени'}»? Это необратимо.`)) {
      removeCharacter(character!.id);
      onBack();
    }
  }

  return (
    <div>
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
            <label>Вид</label>
            <input value={character.species} onChange={(e) => patch((c) => ({ ...c, species: e.target.value }))} />
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ maxWidth: 120 }}>
            <label>Уровень</label>
            <input type="number" value={character.level} readOnly />
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Опыт (кошелёк)</label>
            <input
              type="number"
              value={character.experience}
              onChange={(e) => patch((c) => ({ ...c, experience: Number(e.target.value) }))}
            />
          </div>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Бюджет очков характеристик</label>
            <input
              type="number"
              value={character.statPointsBudget}
              onChange={(e) => patch((c) => ({ ...c, statPointsBudget: Number(e.target.value) }))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Характеристики</h3>
        <StatBudgetBar character={character} />
        <StatsEditor character={character} onChangeStat={changeStat} />
      </div>

      <div className="card">
        <h3 className="card-title">Показатели</h3>
        <DerivedStatsPanel character={character} />
      </div>

      <div className="card">
        <h3 className="card-title">Навыки</h3>
        <SkillsEditor character={character} onChangeSkill={changeSkill} />
      </div>

      <ItemsBlock
        title="Предметы"
        kind="item"
        items={character.items}
        path={character.path}
        onChange={(items: EquipItem[]) => patch((c) => ({ ...c, items }))}
      />

      <ItemsBlock
        title="Умения"
        kind="ability"
        items={character.abilities}
        path={character.path}
        onChange={(abilities: EquipItem[]) => patch((c) => ({ ...c, abilities }))}
      />
    </div>
  );
}
