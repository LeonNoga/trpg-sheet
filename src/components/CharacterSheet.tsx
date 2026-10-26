import { useEffect, useRef, useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { StatBudgetBar } from './StatsEditor';
import { CharacteristicsPanel } from './CharacteristicsPanel';
import { SkillsEditor } from './SkillsEditor';
import { ItemsBlock } from './ItemsBlock';
import { BulkCardUpload } from './BulkCardUpload';
import { NumberField } from './NumberField';
import { SpeciesBonusesCard, DnaListsCard } from './TraitBlocks';
import { PortraitCard } from './PortraitCard';
import { EquipmentSilhouette } from './EquipmentSilhouette';
import { SkillTrainingScreen } from './SkillTrainingScreen';
import { AdditionalInfoTab } from './AdditionalInfoTab';
import { PrintableSheet, printCharacterSheet } from './PrintableSheet';
import {
  CLASS_RARITY_LABELS,
  classBonusLines as getClassBonusLines,
  PATH_ABILITY_LABELS,
  PATH_LABELS,
  PATH_RESOURCE_LABEL,
  PATH_SPECIES_FIELD_LABEL,
  PATH_TRAIT_LABELS,
  RARITY_ORDER,
  levelPointsRate,
} from '../data/statsConfig';
import { MAX_LEVEL, levelPointsAfterManualLevel } from '../data/progression';
import { exportCharacter } from '../storage/exportImport';
import { HistoryDialog } from './HistoryDialog';
import { AbilityUseBar } from './AbilityUseBar';
import {
  applyUse,
  checkShortage,
  clearUsage,
  hasCooldown,
  isDailyLimited,
  longRest,
  milestoneUsageKey,
  parseActivationCost,
  reduceResourceCost,
  startNewDay,
} from '../data/abilityUse';
import type { MilestoneEffect } from '../data/statsConfig';
import { useUndo } from '../state/UndoContext';
import type {
  Character,
  EquipItem,
  InitiativeSource,
  Path,
  PoolKey,
  Rarity,
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

function tabsFor(path: Path): { key: Tab; label: string }[] {
  return [
    { key: 'character', label: 'Персонаж' },
    { key: 'equipment', label: 'Снаряжение' },
    { key: 'abilities', label: PATH_ABILITY_LABELS[path].tab },
    { key: 'training', label: 'Прокачка навыков' },
    { key: 'info', label: 'Доп. информация' },
  ];
}

export function CharacterSheet({ characterId, onBack }: Props) {
  const { characters, updateCharacter, removeCharacter, restoreFromTrash, cloneCharacter, updateMeta } = useAppData();
  const { showUndo } = useUndo();
  const [historyOpen, setHistoryOpen] = useState(false);
  const character = characters.find((c) => c.id === characterId);
  const [tab, setTab] = useState<Tab>('character');
  const [xpToAdd, setXpToAdd] = useState('');
  const [levelDraft, setLevelDraft] = useState(character?.level ?? 1);
  // Актуальная карточка вне рендера: пакетная загрузка добавляет карточки по одной из async-цикла.
  const characterRef = useRef(character);

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

  characterRef.current = character;

  function addCardToCharacter(item: EquipItem) {
    const current = characterRef.current!;
    const next: Character =
      item.kind === 'ability'
        ? { ...current, abilities: [...current.abilities, item] }
        : { ...current, items: [...current.items, item] };
    characterRef.current = next;
    updateCharacter(next);
  }

  function patch(updater: (c: Character) => Character) {
    // Через ref, чтобы подряд идущие изменения (сохранить предмет и добавить к нему умение артефакта) не затирали друг друга.
    const next = updater(characterRef.current ?? character!);
    characterRef.current = next;
    updateCharacter(next);
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

  /** Применение способности: списывает стоимость из пулов (с учётом скидки Интеллекта) и отмечает откат / дневной лимит. */
  function applyAbility(item: EquipItem) {
    const c = characterRef.current!;
    const base = parseActivationCost(item.activation);
    const cost = { ...base, resource: reduceResourceCost(c, base.resource).value };
    const lacks = checkShortage(c, cost);
    if (lacks.length > 0 && !confirm(`Не хватает: ${lacks.join('; ')}. Применить всё равно?`)) return;
    patch((cc) => applyUse(cc, item.id, cost, { cooldown: hasCooldown(item), daily: isDailyLimited(item) }));
  }

  function applyMilestone(stat: StatKey, effect: MilestoneEffect) {
    const c = characterRef.current!;
    const cost = { resource: 0, stamina: effect.stamina ?? 0 };
    const lacks = checkShortage(c, cost);
    if (lacks.length > 0 && !confirm(`Не хватает: ${lacks.join('; ')}. Применить всё равно?`)) return;
    patch((cc) => applyUse(cc, milestoneUsageKey(stat, effect.threshold), cost, { daily: effect.daily }));
  }

  function clearUsageFlag(key: string, which: 'cooldown' | 'daily') {
    patch((c) => clearUsage(c, key, which));
  }

  function handleNewDay() {
    if (confirm('Новый день: снять все откаты и дневные ограничения способностей. Здоровье, выносливость и ресурс не меняются.')) {
      patch(startNewDay);
    }
  }

  function handleLongRest() {
    if (
      confirm(
        'Длительный отдых: здоровье, выносливость и ресурс восстановятся до максимума, откаты и дневные ограничения снимутся.',
      )
    ) {
      patch(longRest);
    }
  }

  /** Строка «Применить» под способностью — только если у неё есть стоимость, откат или дневной лимит. */
  function abilityUseBar(item: EquipItem) {
    const c = character!;
    const base = parseActivationCost(item.activation);
    const reduced = reduceResourceCost(c, base.resource);
    const daily = isDailyLimited(item);
    const cooldown = hasCooldown(item);
    if (base.resource === 0 && base.stamina === 0 && !daily && !cooldown) return null;
    return (
      <AbilityUseBar
        cost={{ resource: reduced.value, stamina: base.stamina }}
        resourceLabel={PATH_RESOURCE_LABEL[c.path]}
        note={reduced.note && reduced.value !== base.resource ? `${reduced.note} (было ${base.resource})` : undefined}
        usage={c.usage?.[item.id]}
        onUse={() => applyAbility(item)}
        onClear={(which) => clearUsageFlag(item.id, which)}
      />
    );
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
    const newLevelPoints = levelPointsAfterManualLevel(character!, clamped);
    const diff = newLevelPoints - character!.levelPoints;
    const confirmed = confirm(
      `Установить уровень ${clamped} вручную?

Опыт будет сброшен в 0. Очки характеристик за уровни ` +
        `изменятся на ${diff >= 0 ? '+' : ''}${diff} (по +${levelPointsRate(character!.classRarity, character!.uniqueLevelPoints)} за уровень для текущей ` +
        `редкости класса). Награда мастера сохранится.`,
    );
    if (!confirmed) {
      setLevelDraft(character!.level);
      return;
    }
    patch((c) => ({ ...c, level: clamped, experience: 0, levelPoints: newLevelPoints }));
  }

  function handleDelete() {
    const target = character!;
    if (confirm(`Удалить персонажа «${target.characterName || 'без имени'}»?`)) {
      removeCharacter(target.id);
      // Удалённый персонаж 30 дней лежит в корзине (внизу списка персонажей) — здесь его можно вернуть сразу.
      showUndo(`Персонаж «${target.characterName || 'без имени'}» удалён`, () => restoreFromTrash(target.id));
      onBack();
    }
  }

  function handleClone() {
    const copy = cloneCharacter(character!.id);
    if (copy) {
      showUndo('Копия создана — она в списке персонажей', () => removeCharacter(copy.id));
      onBack();
    }
  }

  const traitLabels = PATH_TRAIT_LABELS[character.path];
  const classBonusLines = getClassBonusLines(character.classRarity, character.uniqueLevelPoints);

  return (
    <div className={`theme-${character.path}`}>
      <PrintableSheet character={character} />
      <div className="top-actions">
        <button className="btn" onClick={onBack}>
          ← К списку
        </button>
        <button
          className="btn"
          onClick={async () => {
            if (await exportCharacter(character)) updateMeta({ lastBackupAt: Date.now() });
          }}
        >
          Экспорт в JSON
        </button>
        <button className="btn" onClick={() => printCharacterSheet(character)}>
          Сохранить в PDF
        </button>
        <details className="more-menu">
          <summary className="btn">Ещё ▾</summary>
          <div className="more-menu-list">
            <button className="btn btn-ghost" onClick={() => setHistoryOpen(true)}>
              История версий
            </button>
            <button className="btn btn-ghost" onClick={handleClone}>
              Клонировать
            </button>
            <button className="btn btn-ghost btn-danger" onClick={handleDelete}>
              Удалить персонажа
            </button>
          </div>
        </details>
      </div>
      {historyOpen && <HistoryDialog character={character} onClose={() => setHistoryOpen(false)} />}

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
              title="Изменить вручную: опыт обнулится, очки за уровни пересчитаются"
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
        </div>
      </div>

      <div className="sheet-tabs">
        {tabsFor(character.path).map((t) => (
          <button key={t.key} className={`nav-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'character' && (
        <>
          <div className="row">
            <div style={{ flex: 1, minWidth: 260 }}>
              <PortraitCard portrait={character.portrait} onChange={(portrait) => patch((c) => ({ ...c, portrait }))} />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <SpeciesBonusesCard
                title={traitLabels.bonuses}
                extra={
                  <div className="class-rarity-row">
                    <div className="field">
                      <label>Редкость класса</label>
                      <select
                        value={character.classRarity ?? ''}
                        onChange={(e) =>
                          patch((c) => {
                            const classRarity = (e.target.value || undefined) as Rarity | undefined;
                            // Для уникального класса ставка задаётся вручную; стартуем с 15, дальше Мастер называет своё число.
                            return {
                              ...c,
                              classRarity,
                              uniqueLevelPoints: classRarity === 'unique' ? (c.uniqueLevelPoints ?? 15) : c.uniqueLevelPoints,
                            };
                          })
                        }
                        title="Определяет, сколько очков характеристик даёт каждый новый уровень"
                      >
                        <option value="">Класс не выбран</option>
                        {RARITY_ORDER.map((r) => (
                          <option key={r} value={r}>
                            {CLASS_RARITY_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {character.classRarity === 'unique' && (
                      <div className="field" style={{ maxWidth: 140 }}>
                        <label>Очков за уровень</label>
                        <NumberField
                          min={0}
                          value={character.uniqueLevelPoints ?? 15}
                          onChange={(v) => patch((c) => ({ ...c, uniqueLevelPoints: Math.max(0, v) }))}
                          title="Сколько очков даёт каждый новый уровень уникального класса — это число называет Мастер. Меняет только будущие уровни."
                        />
                      </div>
                    )}
                  </div>
                }
                fixedLines={classBonusLines}
                list={character.speciesBonuses}
                onChange={(speciesBonuses) => patch((c) => ({ ...c, speciesBonuses }))}
              />
            </div>
          </div>

          <DnaListsCard
            titles={[traitLabels.dnaA, traitLabels.dnaB, traitLabels.artifact]}
            lists={character.dnaLists}
            level={character.level}
            abilityNames={character.abilities.map((a) => a.name).filter(Boolean)}
            artifactAbilityNames={character.abilities.filter((a) => a.artifact).map((a) => a.name).filter(Boolean)}
            onChange={(dnaLists: TraitList[]) => patch((c) => ({ ...c, dnaLists }))}
          />

          <div className="card">
            <div className="card-title-row">
              <h3 className="card-title">Характеристики и показатели</h3>
              <div className="rest-buttons">
                <button className="btn btn-sm" onClick={handleNewDay} title="Сутки прошли: снять откаты и дневные ограничения">
                  ☀ Новый день
                </button>
                <button className="btn btn-sm" onClick={handleLongRest} title="Долгий сон: восстановить пулы и снять откаты">
                  🌙 Длительный отдых
                </button>
              </div>
            </div>
            <StatBudgetBar character={character} />
            <div className="field" style={{ maxWidth: 260 }}>
              <label>Награда мастера (доп. очки)</label>
              <NumberField
                value={character.bonusStatPoints}
                onChange={(v) => patch((c) => ({ ...c, bonusStatPoints: v }))}
                title="Очки сверх положенных за уровни; может быть отрицательным"
              />
            </div>
            <CharacteristicsPanel
              character={character}
              onChangeStat={changeStat}
              onChangePool={changePool}
              onChangeInitiativeSource={changeInitiativeSource}
              onChangeResistanceSource={changeResistanceSource}
              onUseMilestone={applyMilestone}
              onClearUsage={clearUsageFlag}
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
            addLabel="+ Добавить предмет"
            emptyText="Предметов пока нет."
            toolbar={<BulkCardUpload onCard={addCardToCharacter} getExisting={() => [...(characterRef.current?.items ?? []), ...(characterRef.current?.abilities ?? [])]} />}
            onCompanion={addCardToCharacter}
          />
        </>
      )}

      {tab === 'abilities' && (
        <ItemsBlock
          title={PATH_ABILITY_LABELS[character.path].tab}
          kind="ability"
          items={character.abilities}
          path={character.path}
          onChange={(abilities: EquipItem[]) => patch((c) => ({ ...c, abilities }))}
          addLabel={PATH_ABILITY_LABELS[character.path].add}
          emptyText={PATH_ABILITY_LABELS[character.path].empty}
          cardExtra={abilityUseBar}
          toolbar={<BulkCardUpload onCard={addCardToCharacter} getExisting={() => [...(characterRef.current?.items ?? []), ...(characterRef.current?.abilities ?? [])]} />}
          onCompanion={addCardToCharacter}
        />
      )}

      {tab === 'training' && (
        <SkillTrainingScreen character={character} onChangeDays={changeTrainingDays} onLevelUp={levelUpSkill} />
      )}

      {tab === 'info' && <AdditionalInfoTab character={character} onPatch={patch} />}
    </div>
  );
}
