import { NumberField } from './NumberField';
import { PortraitCard } from './PortraitCard';
import { CLASS_MIN_LEVEL, effectiveClassLevel } from '../data/progression';
import { SpeciesBonusesCard, NotesCard } from './TraitBlocks';
import type { Character, InfectionStatus, TraitList } from '../types';

interface Props {
  character: Character;
  onPatch: (updater: (c: Character) => Character) => void;
}

export function AdditionalInfoTab({ character, onPatch }: Props) {
  const itemNames = character.items.map((i) => i.name).filter(Boolean);

  function toggleInspiration(index: number) {
    const next = [...character.inspirationPoints];
    next[index] = !next[index];
    onPatch((c) => ({ ...c, inspirationPoints: next }));
  }

  function addPip() {
    onPatch((c) => ({ ...c, inspirationPoints: [...c.inspirationPoints, false] }));
  }

  function removePip() {
    onPatch((c) => ({ ...c, inspirationPoints: c.inspirationPoints.slice(0, -1) }));
  }

  function toggleInfection(kind: keyof InfectionStatus, index: number) {
    onPatch((c) => {
      const next = [...c.infectionStatus[kind]] as InfectionStatus['success'];
      next[index] = !next[index];
      return { ...c, infectionStatus: { ...c.infectionStatus, [kind]: next } };
    });
  }

  function clearInfection() {
    onPatch((c) => ({ ...c, infectionStatus: { success: [false, false, false], fail: [false, false, false] } }));
  }

  return (
    <div>
      <PortraitCard portrait={character.portrait} onChange={(portrait) => onPatch((c) => ({ ...c, portrait }))} />

      <div className="card">
        <h3 className="card-title">Класс</h3>
        {character.classRarity ? (
          <div className="field" style={{ maxWidth: 320 }}>
            <label>Класс получен на уровне</label>
            <NumberField
              min={CLASS_MIN_LEVEL}
              max={Math.max(CLASS_MIN_LEVEL, character.level)}
              value={effectiveClassLevel(character) ?? CLASS_MIN_LEVEL}
              onChange={(v) => onPatch((c) => ({ ...c, classLevel: Math.max(CLASS_MIN_LEVEL, v) }))}
              title="Бонус редкости класса считается только за уровни выше этого"
            />
            <p className="muted" style={{ marginBottom: 0 }}>
              +2 очка за каждый уровень до получения класса, бонус редкости — только за уровни выше. Класс выбирается не
              раньше 10 уровня.
            </p>
            {character.classLevel === undefined && (
              <div className="class-level-warning">
                Не указан — пока считается с 10-го уровня.{' '}
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => onPatch((c) => ({ ...c, classLevel: CLASS_MIN_LEVEL }))}
                >
                  Верно, с 10-го
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Класс выбирается на 10 уровне (редкость класса — в шапке карточки). После выбора здесь можно будет указать, на
            каком уровне он получен.
          </p>
        )}
      </div>

      <div className="card">
        <div className="field">
          <label>Группа</label>
          <textarea
            value={character.group}
            onChange={(e) => onPatch((c) => ({ ...c, group: e.target.value }))}
            placeholder="Напарники по отряду..."
          />
        </div>
        <div className="row">
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Очки</label>
            <NumberField value={character.points} onChange={(v) => onPatch((c) => ({ ...c, points: v }))} />
          </div>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Очки развития</label>
            <NumberField
              value={character.developmentPoints}
              onChange={(v) => onPatch((c) => ({ ...c, developmentPoints: v }))}
            />
          </div>
        </div>
      </div>

      <SpeciesBonusesCard
        title="Системное оружие"
        list={character.systemWeapons}
        pickFromNames={itemNames}
        onChange={(systemWeapons: TraitList) => onPatch((c) => ({ ...c, systemWeapons }))}
      />

      <SpeciesBonusesCard
        title="Системное снаряжение"
        list={character.systemGear}
        pickFromNames={itemNames}
        onChange={(systemGear: TraitList) => onPatch((c) => ({ ...c, systemGear }))}
      />

      <div className="card">
        <h3 className="card-title">Очки Вдохновения</h3>
        <div className="pip-row">
          {character.inspirationPoints.map((filled, i) => (
            <button key={i} type="button" className={`pip ${filled ? 'filled' : ''}`} onClick={() => toggleInspiration(i)} />
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={removePip} disabled={character.inspirationPoints.length === 0}>
            − кружок
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addPip}>
            + кружок
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Статус заражения</h3>
        <div className="infection-grid">
          <span className="muted">Успех</span>
          {character.infectionStatus.success.map((on, i) => (
            <button
              key={i}
              type="button"
              className={`infection-mark success ${on ? 'on' : ''}`}
              onClick={() => toggleInfection('success', i)}
            >
              {on ? '✓' : ''}
            </button>
          ))}
          <span className="muted">Провал</span>
          {character.infectionStatus.fail.map((on, i) => (
            <button
              key={i}
              type="button"
              className={`infection-mark fail ${on ? 'on' : ''}`}
              onClick={() => toggleInfection('fail', i)}
            >
              {on ? '✕' : ''}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={clearInfection}>
          Очистить
        </button>
      </div>

      <NotesCard notes={character.notes} onChange={(notes) => onPatch((c) => ({ ...c, notes }))} />
    </div>
  );
}
