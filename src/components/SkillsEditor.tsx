import { SKILLS, SKILL_LEVELS, SKILL_POINTS_BUDGET } from '../data/statsConfig';
import type { Character, SkillLevel } from '../types';

interface Props {
  character: Character;
  onChangeSkill: (skill: string, level: SkillLevel) => void;
}

function costOf(level: SkillLevel): number {
  return SKILL_LEVELS.find((l) => l.level === level)?.cost ?? 0;
}

export function SkillsEditor({ character, onChangeSkill }: Props) {
  const spent = SKILLS.reduce((sum, s) => sum + costOf(character.skills[s] ?? 0), 0);
  const diff = SKILL_POINTS_BUDGET - spent;

  return (
    <div>
      <div className={`budget-bar ${diff < 0 ? 'over' : diff > 0 ? 'under' : ''}`}>
        <strong>Очки навыков: {spent} / {SKILL_POINTS_BUDGET}</strong>
        {diff !== 0 && <span>{diff > 0 ? `осталось ${diff}` : `перебор на ${Math.abs(diff)}`}</span>}
      </div>
      <div className="skills-grid">
        {SKILLS.map((skill) => {
          const current = character.skills[skill] ?? 0;
          return (
            <div className="skill-row" key={skill}>
              <span className="skill-name">{skill}</span>
              <div className="skill-levels">
                {SKILL_LEVELS.filter((l) => l.level !== 0).map((l) => (
                  <button
                    key={l.level}
                    type="button"
                    className={`skill-dot ${current === l.level ? 'active' : ''}`}
                    title={`${l.label} (+${l.level}), стоимость ${l.cost}`}
                    onClick={() => onChangeSkill(skill, current === l.level ? 0 : (l.level as SkillLevel))}
                  >
                    {l.level}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
