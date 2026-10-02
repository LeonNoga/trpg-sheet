import { useState } from 'react';
import { SKILL_TRAINING_TIERS } from '../data/statsConfig';
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

export function ReferenceSheetScreen() {
  const [tab, setTab] = useState<'combat' | 'skillProgression'>('combat');

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
      </div>

      {tab === 'combat' && <CombatMemoScreen />}
      {tab === 'skillProgression' && <SkillTrainingRulesScreen />}
    </div>
  );
}
