import { CharacterInfo } from './CharacterInfo';
import { useContext, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CurrentResources } from './CurrentResources';
import { StaticStats } from './StaticStats';
import { EffectsBar } from './EffectsBar';
import { useAppData } from '../state/useAppData';
import { StatBudgetBar } from './StatsEditor';
import { CharacteristicsPanel } from './CharacteristicsPanel';
import { SkillsEditor } from './SkillsEditor';
import { ItemsBlock } from './ItemsBlock';
import { BulkCardUpload } from './BulkCardUpload';
import { NumberField } from './NumberField';
import { DnaListsCard } from './TraitBlocks';
import { ClassHint } from './ClassHint';
import { EquipmentSilhouette } from './EquipmentSilhouette';
import { SkillTrainingScreen } from './SkillTrainingScreen';
import { AdditionalInfoTab } from './AdditionalInfoTab';
import { LootTab } from './LootTab';
import { AbsorbDialog } from './AbsorbDialog';
import { absorbAbility, isAbsorbed, releaseAbility } from '../data/absorb';
import { HeaderSlotContext } from '../state/HeaderSlot';
import { renderSheetPages } from '../utils/sheetImage';
import { saveImageFiles } from '../storage/saveFile';
import {
  CLASS_RARITY_LABELS,
  classBonusLines as getClassBonusLines,
  PATH_ABILITY_LABELS,
  PATH_LABELS,
  PATH_RESOURCE_LABEL,
  PATH_SPECIES_FIELD_LABEL,
  bonusLabel,
  PATH_TRAIT_LABELS,
  RARITY_ORDER,
} from '../data/statsConfig';
import { CLASS_MIN_LEVEL, MAX_LEVEL, calcLevelPoints, maxBaseStat, nextLevelPoints } from '../data/progression';
import { exportCharacter } from '../storage/exportImport';
import { HistoryDialog } from './HistoryDialog';
import { ChangeLogDialog } from './ChangeLogDialog';
import { revertEntry } from '../data/changeLog';
import { ShortRestDialog } from './ShortRestDialog';
import type { SlotUseInfo } from './SlotUseButton';
import {
  applyAbilityUse,
  applyMilestoneRestore,
  applyUse,
  computeAbilityCost,
  checkShortage,
  clearUsage,
  cooldownReason,
  hasCooldown,
  isCooling,
  isDailyLimited,
  longRest,
  longRestHealing,
  shortRest,
  milestoneUsageKey,
  startNewDay,
  spendCombatStamina,
} from '../data/abilityUse';
import type { MilestoneEffect } from '../data/statsConfig';
import { advanceClock, addEffect, endCombat, removeEffect, resetTimer } from '../data/gameClock';
import { activeEffects, bonusSummary, buildEffect, formatClock, formatRemaining, gameClock } from '../data/effects';
import { useUndo } from '../state/useUndo';
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

type Tab = 'character' | 'equipment' | 'abilities' | 'loot' | 'info' | 'training';

function tabsFor(path: Path): { key: Tab; label: string }[] {
  return [
    { key: 'character', label: 'Персонаж' },
    { key: 'equipment', label: 'Снаряжение' },
    { key: 'abilities', label: PATH_ABILITY_LABELS[path].tab },
    { key: 'loot', label: 'Лут' },
    { key: 'info', label: 'Доп. информация' },
    // Редкая вкладка — в самом конце.
    { key: 'training', label: 'Прокачка навыков' },
  ];
}

const FULL_STATS_KEY = 'trpg-full-stats';

const PHONE_QUERY = '(max-width: 600px)';

/** Телефон ли это (узкий экран): компактный вид характеристик и чекбокс «Полный вид» существуют только там. */
function useIsPhone(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener('change', notify);
      // Запасной сигнал: поворот экрана или смена размера окна без события у медиазапроса.
      window.addEventListener('resize', notify);
      return () => {
        query.removeEventListener('change', notify);
        window.removeEventListener('resize', notify);
      };
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/** «Полный вид» на телефоне: по умолчанию выключен — компактный список; выбор запоминается на устройстве. */
function loadFullStats(): boolean {
  try {
    return localStorage.getItem(FULL_STATS_KEY) === '1';
  } catch {
    return false;
  }
}

export function CharacterSheet({ characterId, onBack }: Props) {
  const { characters, updateCharacter, removeCharacter, restoreFromTrash, cloneCharacter, updateMeta } = useAppData();
  const { showUndo } = useUndo();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [shortRestOpen, setShortRestOpen] = useState(false);
  const [absorbing, setAbsorbing] = useState<EquipItem | null>(null);
  const [fullStats, setFullStats] = useState(loadFullStats);
  const isPhone = useIsPhone();
  const headerSlot = useContext(HeaderSlotContext);
  const character = characters.find((c) => c.id === characterId);
  const [tab, setTab] = useState<Tab>('character');
  const [xpToAdd, setXpToAdd] = useState('');
  const [levelDraft, setLevelDraft] = useState(character?.level ?? 1);
  // Актуальная карточка вне рендера: пакетная загрузка добавляет карточки по одной из async-цикла.
  const characterRef = useRef(character);
  useLayoutEffect(() => {
    characterRef.current = character;
  });
  // Уровень изменился (опыт, ручная смена) — поле «Уровень» показывает новое значение.
  const [seenLevel, setSeenLevel] = useState(character?.level);
  if (character && character.level !== seenLevel) {
    setSeenLevel(character.level);
    setLevelDraft(character.level);
  }

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
    // Жёсткий лимит: повысить можно только на остаток очков (по формулам уровней + награда мастера); понижать — всегда.
    patch((c) => ({ ...c, baseStats: { ...c.baseStats, [key]: Math.min(value, Math.max(c.baseStats[key], maxBaseStat(c, key))) } }));
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
    const { cost } = computeAbilityCost(c, item);
    const lacks = checkShortage(c, cost);
    if (lacks.length > 0 && !confirm(`Не хватает: ${lacks.join('; ')}. Применить всё равно?`)) return;
    patch((cc) => applyAbilityUse(cc, item, cost));
  }

  function applyMilestone(stat: StatKey, effect: MilestoneEffect) {
    const c = characterRef.current!;
    const cost = { resource: 0, stamina: effect.stamina ?? 0 };
    const lacks = checkShortage(c, cost);
    if (lacks.length > 0 && !confirm(`Не хватает: ${lacks.join('; ')}. Применить всё равно?`)) return;
    patch((cc) => applyMilestoneRestore(applyUse(cc, milestoneUsageKey(stat, effect.threshold), cost, { daily: effect.daily }), effect.restore));
  }

  function clearUsageFlag(key: string, which: 'cooldown' | 'daily') {
    patch((c) => clearUsage(c, key, which));
  }

  /** «Конец боя»: заканчивает эффекты «до конца боя» и откаты «раз в бой»; таймер не трогает. Результат — сообщением с отменой. */
  function handleEndCombat() {
    const before = characterRef.current!;
    const after = endCombat(before);
    const effects = activeEffects(before).length - activeEffects(after).length;
    const cooldowns = Object.values(before.usage ?? {}).filter((u) => u.combat).length;
    const parts = [effects > 0 ? `закончились эффекты: ${effects}` : '', cooldowns > 0 ? `сняты откаты: ${cooldowns}` : ''].filter(Boolean);
    patch(() => after);
    showUndo(parts.length > 0 ? `Бой окончен: ${parts.join(', ')}` : 'Бой окончен: эффектов и откатов «до конца боя» не было', () => patch(() => before));
  }

  /** «Сбросить таймер»: новый цикл отсчёта — таймер в 0:00, все эффекты сняты, откаты идут дальше. */
  function handleResetTimer() {
    const before = characterRef.current!;
    const removed = activeEffects(before).length;
    patch(resetTimer);
    showUndo(
      `Таймер сброшен: ${formatClock(gameClock(before))} → 0:00${removed > 0 ? `, снято эффектов: ${removed}` : ''}`,
      () => patch(() => before),
    );
  }

  function handleNewDay() {
    if (confirm('Новый день: проходят сутки (24 часа). Все эффекты заканчиваются, откаты и дневные ограничения снимаются. Здоровье, выносливость и ресурс не меняются.')) {
      patch(startNewDay);
    }
  }

  function handleLongRest() {
    if (
      confirm(
        `Длительный отдых (24 часа): выносливость и ресурс восстановятся до максимума, здоровье — на ${longRestHealing(character!)} (модификатор Живучести), эффекты закончатся, откаты и дневные ограничения снимутся.`,
      )
    ) {
      patch(longRest);
    }
  }

  /** Кнопка применения рядом со слотом способности: только если у способности есть стоимость, откат или дневной лимит. */
  function slotUse(name: string): SlotUseInfo | null {
    const c = character!;
    const key = name.trim().toLowerCase();
    const item = key ? c.abilities.find((a) => a.name.trim().toLowerCase() === key) : undefined;
    if (!item) return null;
    const { cost, base, notes } = computeAbilityCost(c, item);
    const daily = isDailyLimited(item);
    const cooldown = hasCooldown(item);
    const clock = gameClock(c);
    const effect = buildEffect(item, clock, 'preview');
    if (base.resource === 0 && base.stamina === 0 && !daily && !cooldown && !effect) return null;

    const costParts = [
      cost.resource ? `−${cost.resource} ${PATH_RESOURCE_LABEL[c.path]}` : '',
      cost.stamina ? `−${cost.stamina} Вын.` : '',
    ].filter(Boolean);
    const usage = c.usage?.[item.id];
    const reasons: string[] = [];
    const cooling = cooldownReason(usage, clock, item.cooldown);
    if (cooling) reasons.push(cooling);
    if (usage?.daily) reasons.push('Уже использовано сегодня (раз в день)');
    const wasParts = [base.resource ? `${base.resource}` : '', base.stamina ? `${base.stamina} Вын.` : ''].filter(Boolean);
    const note = notes.length > 0 ? ` (${notes.join(', ')}; по карточке было ${wasParts.join(' + ')})` : '';
    const effectNote = effect
      ? `. Эффект: ${bonusSummary(effect.bonuses, (k) => bonusLabel(k, c.path)) || 'без бонусов'}, ${
          effect.until === 'time' ? `на ${formatRemaining((effect.endsAt ?? 0) - clock)}` : effect.until === 'combat' ? 'до конца боя' : 'до снятия'
        }`
      : '';
    return {
      id: item.id,
      costText: costParts.join(', '),
      tooltip: `Применить «${item.name}»${costParts.length ? `: ${costParts.join(', ')}` : ''}${note}${effectNote}`,
      cooling: reasons.length > 0 && (isCooling(usage, clock) || !!usage?.daily),
      reasons,
    };
  }

  function resetCooldown(id: string) {
    patch((c) => clearUsage(clearUsage(c, id, 'cooldown'), id, 'daily'));
  }

  /** «Впитать»: артефактное умение сразу идёт в список артефактных, обычное — после вопроса, в какой список. Снятие освобождает слоты. */
  function toggleAbsorb(item: EquipItem) {
    const c = characterRef.current!;
    if (isAbsorbed(c, item)) {
      patch((cc) => releaseAbility(cc, item));
      return;
    }
    if (!item.name.trim()) return;
    if (item.artifact) {
      const next = absorbAbility(c, item, 2);
      if (next) patch(() => next);
      return;
    }
    setAbsorbing(item);
  }

  function absorbInto(item: EquipItem, target: 0 | 1) {
    const next = absorbAbility(characterRef.current!, item, target);
    if (next) patch(() => next);
    else alert('В этом списке нет свободных слотов.');
    setAbsorbing(null);
  }

  function changeFullStats(on: boolean) {
    setFullStats(on);
    try {
      localStorage.setItem(FULL_STATS_KEY, on ? '1' : '0');
    } catch {
      /* не страшно: вид просто не запомнится */
    }
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
    const newLevelPoints = calcLevelPoints({ ...character!, level: clamped });
    const diff = newLevelPoints - character!.levelPoints;
    const confirmed = confirm(
      `Установить уровень ${clamped} вручную?

Опыт будет сброшен в 0. Очки характеристик за уровни ` +
        `изменятся на ${diff >= 0 ? '+' : ''}${diff} (+2 за каждый уровень до получения класса, бонус редкости — только за уровни выше него). ` +
        `Награда мастера сохранится.`,
    );
    if (!confirmed) {
      setLevelDraft(character!.level);
      return;
    }
    patch((c) => ({ ...c, level: clamped, experience: 0 }));
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

  /** Карточка «как на бумаге»: значения поверх шаблона листа выбранного пути, PNG — в «Поделиться» или на скачивание. */
  async function handleSaveImage() {
    setImageBusy(true);
    try {
      // Бумажный лист — обычные значения: временные эффекты (баффы и штрафы на время) в картинку не попадают.
      const blobs = await renderSheetPages({ ...character!, effects: [] });
      const name = (character!.characterName.trim() || 'character').replace(/[\\/:*?"<>|]+/g, '_');
      await saveImageFiles(blobs.map((blob, i) => ({ fileName: `${name}-лист${i + 1}.png`, blob })));
    } catch (err) {
      console.error(err);
      alert('Не удалось нарисовать картинку.');
    } finally {
      setImageBusy(false);
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
  const classBonusLines = getClassBonusLines(character.classRarity, character.uniqueLevelPoints, character.classLevel);
  const classAvailable = character.level >= CLASS_MIN_LEVEL;

  return (
    <div className={`theme-${character.path}`}>
      <div className="top-actions sheet-actions">
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
        <button className="btn" onClick={() => void handleSaveImage()} disabled={imageBusy}>
          {imageBusy ? 'Рисуем…' : 'Сохранить картинкой'}
        </button>
        <details className="more-menu">
          <summary className="btn">Ещё ▾</summary>
          <div className="more-menu-list">
            <button className="btn btn-ghost" onClick={() => setLogOpen(true)}>
              Журнал изменений
            </button>
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
      {headerSlot &&
        createPortal(
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                if (await exportCharacter(character)) updateMeta({ lastBackupAt: Date.now() });
              }}
            >
              Экспорт в JSON
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void handleSaveImage()} disabled={imageBusy}>
              {imageBusy ? 'Рисуем…' : 'Сохранить картинкой'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setLogOpen(true)}>
              Журнал изменений
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setHistoryOpen(true)}>
              История версий
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleClone}>
              Клонировать
            </button>
            <button type="button" className="btn btn-ghost btn-danger" onClick={handleDelete}>
              Удалить персонажа
            </button>
          </>,
          headerSlot,
        )}
      {shortRestOpen && (
        <ShortRestDialog
          character={character}
          onCancel={() => setShortRestOpen(false)}
          onConfirm={(minutes) => {
            patch((c) => shortRest(c, minutes));
            setShortRestOpen(false);
          }}
        />
      )}
      {historyOpen && <HistoryDialog character={character} onClose={() => setHistoryOpen(false)} />}
      {logOpen && (
        <ChangeLogDialog
          character={character}
          onRevert={(entry) => patch((c) => revertEntry(c, entry) ?? c)}
          onClose={() => setLogOpen(false)}
        />
      )}

      <CharacterInfo key={character.id} character={character}>
        <span className="pill-badge">{PATH_LABELS[character.path]}</span>
        <div className="header-fields-grid" style={{ marginTop: 10 }}>
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
          <div className="field">
            <label>Редкость класса</label>
            <select
              value={character.classRarity ?? ''}
              disabled={!classAvailable && !character.classRarity}
              onChange={(e) =>
                patch((c) => {
                  const classRarity = (e.target.value || undefined) as Rarity | undefined;
                  return {
                    ...c,
                    classRarity,
                    // Класс получен на текущем уровне (не раньше 10-го): бонус редкости пойдёт только за уровни выше него.
                    classLevel: classRarity ? (c.classRarity ? c.classLevel : Math.max(CLASS_MIN_LEVEL, c.level)) : undefined,
                    // Для уникального класса ставка задаётся вручную; стартуем с 15, дальше Мастер называет своё число.
                    uniqueLevelPoints: classRarity === 'unique' ? (c.uniqueLevelPoints ?? 15) : c.uniqueLevelPoints,
                  };
                })
              }
              title={classAvailable ? 'Определяет, сколько очков характеристик даёт каждый уровень выше получения класса' : 'Класс выбирается на 10 уровне'}
            >
              <option value="">Класс не выбран</option>
              {RARITY_ORDER.map((r) => (
                <option key={r} value={r}>
                  {CLASS_RARITY_LABELS[r]}
                </option>
              ))}
            </select>
            {!classAvailable && !character.classRarity ? (
              <div className="muted class-locked-note">Класс выбирается на 10 уровне — достигните его, чтобы выбрать редкость.</div>
            ) : (
              <ClassHint
                lines={
                  character.classRarity
                    ? [...classBonusLines, 'Уровень получения класса можно поправить на вкладке «Доп. информация».']
                    : classBonusLines
                }
                attention={!!character.classRarity && character.classLevel === undefined}
              />
            )}
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
          <div className="field">
            <label>Очков за уровень</label>
            {character.classRarity === 'unique' && classAvailable ? (
              <NumberField
                min={0}
                value={character.uniqueLevelPoints ?? 15}
                onChange={(v) => patch((c) => ({ ...c, uniqueLevelPoints: Math.max(0, v) }))}
                title="Сколько очков даёт каждый уровень уникального класса выше получения класса — это число называет Мастер."
              />
            ) : (
              <input
                readOnly
                value={`+${nextLevelPoints(character)} за уровень`}
                title="До 10 уровня всегда +2; бонус редкости класса действует только на уровни выше уровня получения класса"
              />
            )}
          </div>
        </div>
      </CharacterInfo>

      <CurrentResources character={character} />
      <StaticStats character={character} />
      <EffectsBar
        character={character}
        onAdvance={(seconds) => patch((c) => advanceClock(c, seconds))}
        onEndCombat={handleEndCombat}
        onResetTimer={handleResetTimer}
        onAddEffect={(effect) => patch((c) => addEffect(c, effect))}
        onRemoveEffect={(id) => patch((c) => removeEffect(c, id))}
      />

      <div className="sheet-tabs">
        {tabsFor(character.path).map((t) => (
          <button key={t.key} className={`nav-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'character' && (
        <>
          <div className="card">
            <div className="card-title-row">
              <h3 className="card-title">Характеристики и показатели</h3>
              <div className="rest-buttons">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => patch(spendCombatStamina)}
                  title="Тик боя (15 секунд): −2 выносливости, время идёт — эффекты и откаты истекают"
                >
                  ⚔ Тик боя
                </button>
                <button className="btn btn-sm" onClick={() => setShortRestOpen(true)} title="За каждые 10 минут — модификатор Выносливости и ресурса">
                  ⏱ Короткий отдых
                </button>
                <button className="btn btn-sm" onClick={handleNewDay} title="Сутки прошли: эффекты заканчиваются, откаты и дневные ограничения снимаются">
                  ☀ Новый день
                </button>
                {isPhone && (
                  <label className="toggle full-stats-toggle" title="Показать характеристики вместе с показателями, как на бумажной карточке">
                    <input type="checkbox" checked={fullStats} onChange={(e) => changeFullStats(e.target.checked)} />
                    Полный вид
                  </label>
                )}
                <button className="btn btn-sm" onClick={handleLongRest} title="Долгий сон (24 часа): здоровье +мод. Живучести, выносливость и ресурс до максимума, эффекты и откаты кончаются">
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
              full={!isPhone || fullStats}
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
        <>
          <DnaListsCard
            titles={[traitLabels.dnaA, traitLabels.dnaB, traitLabels.artifact]}
            lists={character.dnaLists}
            level={character.level}
            abilityNames={character.abilities.map((a) => a.name).filter(Boolean)}
            artifactAbilityNames={character.abilities.filter((a) => a.artifact).map((a) => a.name).filter(Boolean)}
            slotUse={slotUse}
            points={character.points}
            onChangePoints={(points) => patch((c) => ({ ...c, points }))}
            onUseAbility={(id) => {
              const item = character.abilities.find((a) => a.id === id);
              if (item) applyAbility(item);
            }}
            onResetCooldown={resetCooldown}
            onChange={(dnaLists: TraitList[]) => patch((c) => ({ ...c, dnaLists }))}
          />

        <ItemsBlock
          title={PATH_ABILITY_LABELS[character.path].tab}
          kind="ability"
          items={character.abilities}
          path={character.path}
          onChange={(abilities: EquipItem[]) => patch((c) => ({ ...c, abilities }))}
          addLabel={PATH_ABILITY_LABELS[character.path].add}
          emptyText={PATH_ABILITY_LABELS[character.path].empty}
          toolbar={<BulkCardUpload onCard={addCardToCharacter} getExisting={() => [...(characterRef.current?.items ?? []), ...(characterRef.current?.abilities ?? [])]} />}
          onCompanion={addCardToCharacter}
          absorb={{ isAbsorbed: (item) => isAbsorbed(character, item), onToggle: toggleAbsorb }}
        />
        {absorbing && (
          <AbsorbDialog
            character={character}
            item={absorbing}
            titles={[traitLabels.dnaA, traitLabels.dnaB]}
            onChoose={(target) => absorbInto(absorbing, target)}
            onCancel={() => setAbsorbing(null)}
          />
        )}
        </>
      )}

      {tab === 'loot' && <LootTab character={character} onPatch={patch} />}

      {tab === 'training' && (
        <SkillTrainingScreen character={character} onChangeDays={changeTrainingDays} onLevelUp={levelUpSkill} />
      )}

      {tab === 'info' && <AdditionalInfoTab character={character} onPatch={patch} />}
    </div>
  );
}
