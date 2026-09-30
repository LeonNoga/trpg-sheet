import { SKILLS, SKILL_LEVELS, SKILL_TRAINING_TIERS } from '../data/statsConfig';
import type { Character, SkillLevel } from '../types';

interface Props {
  character: Character;
  onChangeDays: (skill: string, days: number) => void;
  onLevelUp: (skill: string, newLevel: SkillLevel) => void;
}

function levelLabel(level: SkillLevel): string {
  return SKILL_LEVELS.find((l) => l.level === level)?.label ?? '';
}

export function SkillTrainingScreen({ character, onChangeDays, onLevelUp }: Props) {
  return (
    <div>
      <p className="muted">
        Отмечайте дни, проведённые в тренировке навыка. Когда отмечено достаточно успешных дней — степень
        владения можно повысить. Пороги дней и TN — на вкладке «Памятки» → «Прогрессия навыков».
      </p>

      {SKILLS.map((skill) => {
        const level = (character.skills[skill] ?? 0) as SkillLevel;
        const tier = SKILL_TRAINING_TIERS.find((t) => t.from === level);
        const days = character.skillTrainingDays[skill] ?? 0;

        return (
          <div className="card" key={skill}>
            <div className="row" style={{ alignItems: 'center' }}>
              <h4 style={{ margin: 0, flex: 1 }}>{skill}</h4>
              <span className="pill-badge">{level > 0 ? `${levelLabel(level)} (+${level})` : 'Не владеет'}</span>
            </div>

            {tier ? (
              <>
                <div className="training-grid">
                  {Array.from({ length: tier.days }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`training-box ${i < days ? 'filled' : ''}`}
                      onClick={() => onChangeDays(skill, days === i + 1 ? i : i + 1)}
                      title={`День ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
                  <span className="muted">
                    {days} / {tier.days} (TN {tier.tn})
                  </span>
                  <button
                    className="btn btn-sm"
                    disabled={days < tier.days}
                    onClick={() => onLevelUp(skill, tier.to as SkillLevel)}
                  >
                    Повысить до +{tier.to}
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Максимальная степень владения достигнута.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
