import { useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { MAX_LEVEL } from '../data/progression';
import { SKILL_TRAINING_TIERS } from '../data/statsConfig';
import { NumberField } from './NumberField';
import { CombatMemoScreen } from './CombatMemoScreen';

function SkillTrainingRulesScreen() {
  return (
    <div>
      <div className="card">
        <h3 className="card-title">Прогрессия навыков (правила)</h3>
        <p className="muted">
          Игрок проводит день в тренировках, отмечая его в счётчике навыка (вкладка «Прокачка навыков»).
          Когда накоплено нужное число успешных дней — степень владения навыком растёт.
        </p>
        <table className="ref-table">
          <thead>
            <tr>
              <th>Переход</th>
              <th>TN</th>
              <th>Нужно успешных дней</th>
            </tr>
          </thead>
          <tbody>
            {SKILL_TRAINING_TIERS.map((tier) => (
              <tr key={tier.from}>
                <td>
                  С {tier.from} до +{tier.to}
                </td>
                <td>{tier.tn}</td>
                <td>{tier.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <img
          src={`${import.meta.env.BASE_URL}reference/skill-training.webp`}
          alt="Прогрессия навыков"
          className="item-image"
          style={{ marginTop: 12 }}
        />
      </div>
    </div>
  );
}

function LevelProgressionScreen() {
  const { progressionConfig, updateProgressionConfig } = useAppData();
  const [bulkValue, setBulkValue] = useState(100);

  function setXp(levelIndex: number, value: number) {
    const next = [...progressionConfig.xpToNextLevel];
    next[levelIndex] = value;
    updateProgressionConfig({ ...progressionConfig, xpToNextLevel: next });
  }

  function fillRemainingWith(value: number) {
    updateProgressionConfig({
      ...progressionConfig,
      xpToNextLevel: progressionConfig.xpToNextLevel.map(() => value),
    });
  }

  return (
    <div className="card">
      <p className="muted">
        Точная формула прогрессии ещё не готова — заполните таблицу своими значениями, её можно менять в
        любой момент для баланса.
      </p>
      <div className="row">
        <div className="field" style={{ maxWidth: 200 }}>
          <label>Очков характеристик за уровень</label>
          <NumberField
            value={progressionConfig.pointsPerLevel}
            onChange={(v) => updateProgressionConfig({ ...progressionConfig, pointsPerLevel: v })}
          />
        </div>
        <div className="field" style={{ maxWidth: 200 }}>
          <label>Быстро заполнить все уровни</label>
          <NumberField value={bulkValue} onChange={setBulkValue} />
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={() => fillRemainingWith(bulkValue)}>
            Применить ко всем
          </button>
        </div>
      </div>

      <div className="progression-table">
        <table className="ref-table">
          <thead>
            <tr>
              <th>Уровень</th>
              <th>Опыта до следующего</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i).map((i) => (
              <tr key={i}>
                <td>
                  {i + 1} → {i + 2}
                </td>
                <td>
                  <NumberField value={progressionConfig.xpToNextLevel[i] ?? 0} onChange={(v) => setXp(i, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReferenceSheetScreen() {
  const [tab, setTab] = useState<'combat' | 'skillProgression' | 'levelProgression'>('combat');

  return (
    <div>
      <div className="section-tabs">
        <button className={`nav-tab ${tab === 'combat' ? 'active' : ''}`} onClick={() => setTab('combat')}>
          Боевая памятка
        </button>
        <button
          className={`nav-tab ${tab === 'skillProgression' ? 'active' : ''}`}
          onClick={() => setTab('skillProgression')}
        >
          Прогрессия навыков
        </button>
        <button
          className={`nav-tab ${tab === 'levelProgression' ? 'active' : ''}`}
          onClick={() => setTab('levelProgression')}
        >
          Прогрессия уровней
        </button>
      </div>

      {tab === 'combat' && <CombatMemoScreen />}
      {tab === 'skillProgression' && <SkillTrainingRulesScreen />}
      {tab === 'levelProgression' && <LevelProgressionScreen />}
    </div>
  );
}
