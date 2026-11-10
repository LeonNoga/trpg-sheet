import { CLASS_RARITY_LABELS, PATH_RESOURCE_LABEL, PATH_TRAIT_LABELS, STAT_LABELS, STAT_ORDER } from './statsConfig';
import { maxBaseStat } from './progression';
import type { ChangeEntry, Character, EquipItem, SkillLevel, StatKey } from '../types';

/** Запись до присвоения id, времени и уровня. */
export type ChangeDraft = Omit<ChangeEntry, 'id' | 'at' | 'lv'>;

const MAX_ENTRIES = 300;
/** Правки одного и того же значения в течение этого времени сливаются в одну запись (иначе каждая цифра — отдельная строка). */
const MERGE_WINDOW_MS = 90_000;

const MERGEABLE = new Set<ChangeEntry['kind']>([
  'experience',
  'levelPoints',
  'bonusStatPoints',
  'stat',
  'skill',
  'classRarity',
  'classLevel',
  'developmentPoints',
  'points',
  'pearl',
  'dust',
  'slot',
  'equipped',
]);

const mergeKey = (e: Pick<ChangeEntry, 'kind' | 'key'>) => `${e.kind}:${e.key ?? ''}`;

const nameOf = (item: { name: string }) => item.name.trim() || 'без названия';

/** Что изменилось между двумя состояниями карточки. Здоровье, выносливость и ресурс (расход в игре) не учитываются. */
export function diffCharacter(prev: Character, next: Character): ChangeDraft[] {
  const out: ChangeDraft[] = [];
  const num = (kind: ChangeEntry['kind'], from: number, to: number, extra: Partial<ChangeDraft> = {}) => {
    if (from !== to) out.push({ kind, from, to, ...extra });
  };

  num('level', prev.level, next.level);
  if (prev.level === next.level) num('experience', prev.experience, next.experience);
  num('levelPoints', prev.levelPoints, next.levelPoints);
  num('bonusStatPoints', prev.bonusStatPoints, next.bonusStatPoints);

  for (const key of STAT_ORDER) {
    const label = key === 'resource' ? PATH_RESOURCE_LABEL[next.path] : STAT_LABELS[key];
    num('stat', prev.baseStats[key], next.baseStats[key], { key, label });
  }

  for (const skill of new Set([...Object.keys(prev.skills), ...Object.keys(next.skills)])) {
    num('skill', prev.skills[skill] ?? 0, next.skills[skill] ?? 0, { key: skill, label: skill });
  }

  if (prev.classRarity !== next.classRarity) {
    out.push({
      kind: 'classRarity',
      from: prev.classRarity ? CLASS_RARITY_LABELS[prev.classRarity] : '—',
      to: next.classRarity ? CLASS_RARITY_LABELS[next.classRarity] : '—',
    });
  }
  if ((prev.classLevel ?? 0) !== (next.classLevel ?? 0)) num('classLevel', prev.classLevel ?? 0, next.classLevel ?? 0);

  diffLists(out, prev.items, next.items, 'item', true);
  diffLists(out, prev.abilities, next.abilities, 'ability', false);

  const titles = PATH_TRAIT_LABELS[next.path];
  const listTitles = [titles.dnaA, titles.dnaB, titles.artifact];
  for (let i = 0; i < Math.max(prev.dnaLists.length, next.dnaLists.length); i++) {
    const before = prev.dnaLists[i]?.slots ?? [];
    const after = next.dnaLists[i]?.slots ?? [];
    for (let j = 0; j < Math.max(before.length, after.length); j++) {
      const from = (before[j] ?? '').trim();
      const to = (after[j] ?? '').trim();
      if (from !== to) out.push({ kind: 'slot', key: `${i}:${j}`, label: listTitles[i] ?? 'Список', from, to });
    }
  }

  num('developmentPoints', prev.developmentPoints, next.developmentPoints);
  num('points', prev.points, next.points);

  const prevPearls = new Map((prev.pearls ?? []).map((p) => [p.id, p]));
  const nextPearls = new Map((next.pearls ?? []).map((p) => [p.id, p]));
  for (const [id, p] of nextPearls) {
    const before = prevPearls.get(id);
    if (!before) out.push({ kind: 'pearlAdded', to: p.points });
    else num('pearl', before.points, p.points, { key: id });
  }
  for (const [id, p] of prevPearls) if (!nextPearls.has(id)) out.push({ kind: 'pearlRemoved', from: p.points });

  const prevDust = new Map((prev.dust ?? []).map((d) => [d.id, d]));
  const nextDust = new Map((next.dust ?? []).map((d) => [d.id, d]));
  for (const [id, d] of nextDust) {
    const before = prevDust.get(id);
    if (!before) out.push({ kind: 'dustAdded', to: d.volume });
    else num('dust', before.volume, d.volume, { key: id });
  }
  for (const [id, d] of prevDust) if (!nextDust.has(id)) out.push({ kind: 'dustRemoved', from: d.volume });

  return mergePearlTransfer(out);
}

function diffLists(out: ChangeDraft[], before: EquipItem[], after: EquipItem[], kind: 'item' | 'ability', withEquip: boolean) {
  const prevById = new Map(before.map((i) => [i.id, i]));
  const nextById = new Map(after.map((i) => [i.id, i]));
  for (const item of after) {
    const old = prevById.get(item.id);
    if (!old) out.push({ kind: kind === 'item' ? 'itemAdded' : 'abilityAdded', label: nameOf(item) });
    else if (withEquip && old.equipped !== item.equipped) {
      out.push({ kind: 'equipped', key: item.id, label: nameOf(item), from: old.equipped, to: item.equipped });
    }
  }
  for (const item of before) {
    if (!nextById.has(item.id)) out.push({ kind: kind === 'item' ? 'itemRemoved' : 'abilityRemoved', label: nameOf(item) });
  }
}

/** Пара «в жемчужине −N» и «очки развития +N» — это «всосать» (и наоборот «вложить»): одна запись вместо двух. */
function mergePearlTransfer(drafts: ChangeDraft[]): ChangeDraft[] {
  const dev = drafts.find((d) => d.kind === 'developmentPoints');
  const pearls = drafts.filter((d) => d.kind === 'pearl');
  if (!dev || pearls.length !== 1) return drafts;
  const devDelta = Number(dev.to) - Number(dev.from);
  const pearlDelta = Number(pearls[0].to) - Number(pearls[0].from);
  if (devDelta === 0 || devDelta !== -pearlDelta) return drafts;
  const merged: ChangeDraft = { kind: devDelta > 0 ? 'pearlAbsorb' : 'pearlFill', to: Math.abs(devDelta) };
  return [...drafts.filter((d) => d !== dev && d !== pearls[0]), merged];
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const num2 = (x: unknown) => Number(x);

/** Текст строки журнала. Хранится только структура, текст собирается при показе — поэтому объединённые правки читаются верно. */
export function describeEntry(e: ChangeEntry): string {
  const delta = () => signed(Math.round((num2(e.to) - num2(e.from)) * 100) / 100);
  switch (e.kind) {
    case 'level':
      return `Уровень ${e.from} → ${e.to}`;
    case 'experience':
      return `Опыт ${e.from} → ${e.to} (${delta()})`;
    case 'levelPoints':
      return `Очки характеристик за уровни: ${e.from} → ${e.to} (${delta()})`;
    case 'bonusStatPoints':
      return `Награда мастера (доп. очки): ${e.from} → ${e.to} (${delta()})`;
    case 'stat':
      return `${e.label}: ${e.from} → ${e.to} (${delta()})`;
    case 'skill':
      return `Навык «${e.label}»: +${e.from} → +${e.to}`;
    case 'classRarity':
      return `Редкость класса: ${e.from} → ${e.to}`;
    case 'classLevel':
      return `Класс получен на уровне: ${e.from || '—'} → ${e.to || '—'}`;
    case 'itemAdded':
      return `Добавлено снаряжение «${e.label}»`;
    case 'itemRemoved':
      return `Удалено снаряжение «${e.label}»`;
    case 'abilityAdded':
      return `Добавлено умение «${e.label}»`;
    case 'abilityRemoved':
      return `Удалено умение «${e.label}»`;
    case 'equipped':
      return `${e.to ? 'Надето' : 'Снято'}: «${e.label}»`;
    case 'slot': {
      const from = String(e.from ?? '');
      const to = String(e.to ?? '');
      if (!from) return `Впитано «${to}» — ${e.label}`;
      if (!to) return `Освобождён слот «${from}» — ${e.label}`;
      return `${e.label}: «${from}» → «${to}»`;
    }
    case 'developmentPoints':
      return `Очки развития: ${e.from} → ${e.to} (${delta()})`;
    case 'points':
      return `Очки умений: ${e.from} → ${e.to} (${delta()})`;
    case 'pearl':
      return `Жемчужина развития: ${e.from} → ${e.to} (${delta()})`;
    case 'pearlAdded':
      return `Добавлена жемчужина развития (${e.to})`;
    case 'pearlRemoved':
      return 'Удалена жемчужина развития';
    case 'pearlAbsorb':
      return `Всосано ${e.to} очк. развития из жемчужины`;
    case 'pearlFill':
      return `Вложено ${e.to} очк. развития в жемчужину`;
    case 'dust':
      return `Пыль развития: ${e.from} → ${e.to}`;
    case 'dustAdded':
      return 'Добавлена пыль развития';
    case 'dustRemoved':
      return 'Удалена пыль развития';
    case 'note':
      return e.label ?? '';
    default:
      return '';
  }
}

/** Добавляет записи в конец журнала: правки одного значения подряд сливаются, журнал ограничен по длине. */
export function appendLog(
  log: ChangeEntry[] | undefined,
  drafts: ChangeDraft[],
  level: number,
  now: number = Date.now(),
  makeId: () => string = () => crypto.randomUUID(),
): ChangeEntry[] | undefined {
  if (drafts.length === 0) return log;
  const result = [...(log ?? [])];
  for (const draft of drafts) {
    if (MERGEABLE.has(draft.kind)) {
      const key = mergeKey(draft);
      let index = -1;
      for (let i = result.length - 1; i >= 0 && i >= result.length - 25; i--) {
        if (mergeKey(result[i]) === key && result[i].kind === draft.kind) {
          index = i;
          break;
        }
      }
      if (index >= 0 && now - result[index].at <= MERGE_WINDOW_MS) {
        const merged = { ...result[index], to: draft.to, at: now, lv: level };
        if (merged.from === merged.to) result.splice(index, 1);
        else result[index] = merged;
        continue;
      }
    }
    result.push({ ...draft, id: makeId(), at: now, lv: level });
  }
  return result.slice(-MAX_ENTRIES);
}

/** Запись-примечание (импорт, возврат к версии и т. п.). */
export function appendNote(log: ChangeEntry[] | undefined, text: string, level: number, now: number = Date.now()): ChangeEntry[] {
  return appendLog(log, [{ kind: 'note', label: text }], level, now) ?? [];
}

/** Можно ли отменить запись: только простые числовые правки, и только пока значение не менялось после неё. */
export function canRevert(character: Character, e: ChangeEntry): boolean {
  switch (e.kind) {
    case 'stat':
      return character.baseStats[e.key as StatKey] === e.to;
    case 'skill':
      return (character.skills[e.key ?? ''] ?? 0) === e.to;
    case 'bonusStatPoints':
    case 'developmentPoints':
    case 'points':
      return character[e.kind] === e.to;
    default:
      return false;
  }
}

/** Возвращает значение «до» для записи; null — если отменить нельзя. Повышение характеристики не выходит за текущий лимит очков. */
export function revertEntry(character: Character, e: ChangeEntry): Character | null {
  if (!canRevert(character, e)) return null;
  switch (e.kind) {
    case 'stat': {
      const key = e.key as StatKey;
      const wanted = Number(e.from);
      const value = Math.min(wanted, Math.max(character.baseStats[key], maxBaseStat(character, key)));
      return { ...character, baseStats: { ...character.baseStats, [key]: value } };
    }
    case 'skill':
      return { ...character, skills: { ...character.skills, [e.key ?? '']: Number(e.from) as SkillLevel } };
    case 'bonusStatPoints':
    case 'developmentPoints':
    case 'points':
      return { ...character, [e.kind]: Number(e.from) };
    default:
      return null;
  }
}
