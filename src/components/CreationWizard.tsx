import { useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { StatsEditor, StatBudgetBar } from './StatsEditor';
import { DerivedStatsPanel } from './DerivedStatsPanel';
import { SkillsEditor } from './SkillsEditor';
import { PATH_ALLOWED_KEY_STATS, PATH_LABELS, STAT_LABELS } from '../data/statsConfig';
import type { Character, KeyStat, Path, Roster, SkillLevel, StatKey } from '../types';

interface Props {
  roster: Roster;
  onFinish: (id: string) => void;
  onCancel: () => void;
}

const STEP_TITLES = ['Путь', 'Характеристики', 'Показатели', 'Навыки'];

export function CreationWizard({ roster, onFinish, onCancel }: Props) {
  const { createCharacter, updateCharacter } = useAppData();
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<Path>('genetic');
  const [keyStat, setKeyStat] = useState<KeyStat>('agility');
  const [character, setCharacter] = useState<Character | null>(null);

  function startBuild() {
    const created = createCharacter(path, keyStat, roster);
    setCharacter(created);
    setStep(1);
  }

  function patch(updater: (c: Character) => Character) {
    if (!character) return;
    const next = updater(character);
    setCharacter(next);
    updateCharacter(next);
  }

  function changeStat(key: StatKey, value: number) {
    patch((c) => ({ ...c, baseStats: { ...c.baseStats, [key]: value } }));
  }

  function changeSkill(skill: string, level: SkillLevel) {
    patch((c) => ({ ...c, skills: { ...c.skills, [skill]: level } }));
  }

  return (
    <div>
      <div className="wizard-steps">
        {STEP_TITLES.map((title, i) => (
          <div key={title} className={`wizard-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            {i + 1}. {title}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="card">
          <h3 className="card-title">Выберите путь развития</h3>
          <div className="path-options">
            {(Object.keys(PATH_LABELS) as Path[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`path-option ${path === p ? 'selected' : ''}`}
                onClick={() => {
                  setPath(p);
                  setKeyStat(PATH_ALLOWED_KEY_STATS[p][0]);
                }}
              >
                <h4>{PATH_LABELS[p]}</h4>
              </button>
            ))}
          </div>

          {PATH_ALLOWED_KEY_STATS[path].length > 1 && (
            <div className="field">
              <label>Ключевая характеристика</label>
              <select value={keyStat} onChange={(e) => setKeyStat(e.target.value as KeyStat)}>
                {PATH_ALLOWED_KEY_STATS[path].map((k) => (
                  <option key={k} value={k}>
                    {STAT_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="wizard-actions">
            <button className="btn btn-ghost" onClick={onCancel}>
              Отмена
            </button>
            <button className="btn btn-primary" onClick={startBuild}>
              Далее
            </button>
          </div>
        </div>
      )}

      {step >= 1 && character && (
        <>
          {step === 1 && (
            <div className="card">
              <h3 className="card-title">Имена и характеристики</h3>
              <div className="row">
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
                  <input
                    value={character.species}
                    onChange={(e) => patch((c) => ({ ...c, species: e.target.value }))}
                  />
                </div>
              </div>
              <StatBudgetBar character={character} />
              <StatsEditor character={character} onChangeStat={changeStat} />
            </div>
          )}

          {step === 2 && (
            <div className="card">
              <h3 className="card-title">Показатели (авторасчёт)</h3>
              <DerivedStatsPanel character={character} />
            </div>
          )}

          {step === 3 && (
            <div className="card">
              <h3 className="card-title">Навыки</h3>
              <SkillsEditor character={character} onChangeSkill={changeSkill} />
            </div>
          )}

          <div className="wizard-actions">
            <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(1, s - 1))}>
              Назад
            </button>
            {step < 3 ? (
              <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
                Далее
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => onFinish(character.id)}>
                Готово
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
