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

function CalculationMemoScreen() {
  const base = `${import.meta.env.BASE_URL}reference/`;
  return (
    <div>
      <div className="card">
        <h3 className="card-title">Подсчёт параметров: шаги 1–2</h3>
        <p className="muted">Распределение 100 очков по характеристикам, модификатор и расчёт остальных показателей.</p>
        <img src={`${base}calc-1.webp`} alt="Шаги 1 и 2: характеристики и показатели" className="item-image" />
      </div>
      <div className="card">
        <h3 className="card-title">Подсчёт параметров: шаг 3</h3>
        <p className="muted">Распределение 15 очков навыков: +5 стоит 1, +10 стоит 3, +15 стоит 5.</p>
        <img
          src={`${base}calc-2.webp`}
          alt="Шаг 3: распределение навыков"
          className="item-image"
          style={{ maxWidth: 380 }}
        />
      </div>
    </div>
  );
}

export function ReferenceSheetScreen() {
  const [tab, setTab] = useState<'combat' | 'skillProgression' | 'calculation'>('combat');

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
        <button className={`nav-tab ${tab === 'calculation' ? 'active' : ''}`} onClick={() => setTab('calculation')}>
          Подсчёт параметров
        </button>
      </div>

      {tab === 'combat' && <CombatMemoScreen />}
      {tab === 'skillProgression' && <SkillTrainingRulesScreen />}
      {tab === 'calculation' && <CalculationMemoScreen />}
    </div>
  );
}
