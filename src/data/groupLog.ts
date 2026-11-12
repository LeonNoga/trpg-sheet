import { effectiveGroupId } from './gm';
import type { Encounter, EncounterParticipant, Enemy, EnemyGroup, EquipItem, Group, GroupLogEntry, PartyMember } from '../types';

/** Запись журнала с указанием группы, в чей журнал она попадает. */
export interface LogDraft {
  groupId: string;
  entry: Omit<GroupLogEntry, 'id' | 'at'>;
}

const MAX_ENTRIES = 500;
const MERGE_WINDOW_MS = 90_000;

const note = (groupId: string, text: string): LogDraft => ({ groupId, entry: { kind: 'note', text } });

const MEMBER_FIELDS: [keyof PartyMember, string][] = [
  ['name', 'Имя'],
  ['playerName', 'Игрок'],
  ['type', 'Тип'],
  ['level', 'Уровень'],
  ['hpMax', 'Макс. здоровье'],
  ['defense', 'ПЗ'],
  ['speed', 'Скорость'],
  ['passivePerception', 'ПВ'],
  ['initiative', 'Инициатива'],
  ['resistance', 'СС'],
];

const ENEMY_FIELDS: [keyof Enemy, string][] = [
  ['name', 'Название'],
  ['kind', 'Тип'],
  ['level', 'Уровень'],
  ['hpMax', 'Макс. здоровье'],
  ['defense', 'ПЗ'],
  ['speed', 'Скорость'],
  ['passivePerception', 'ПВ'],
  ['initiative', 'Инициатива'],
  ['resistance', 'СС'],
];

function diffRecords<T extends { id: string; groupId?: string; hp?: number }>(
  prev: T[],
  next: T[],
  groups: Group[],
  fields: [keyof T, string][],
  nameOf: (item: T) => string,
  words: { added: string; removed: string },
): LogDraft[] {
  const out: LogDraft[] = [];
  const before = new Map(prev.map((p) => [p.id, p]));
  const after = new Map(next.map((n) => [n.id, n]));
  const groupOf = (item: T) => effectiveGroupId(item.groupId, groups);
  for (const item of next) {
    const old = before.get(item.id);
    const groupId = groupOf(item);
    if (!old) {
      out.push(note(groupId, `${words.added}: «${nameOf(item) || 'без названия'}»`));
      continue;
    }
    const label = nameOf(item) || 'без названия';
    if (groupOf(old) !== groupId) out.push(note(groupId, `Перенесён(а) в эту группу: «${label}»`), note(groupOf(old), `Перенесён(а) в другую группу: «${label}»`));
    if (old.hp !== item.hp && old.hp !== undefined && item.hp !== undefined) {
      out.push({ groupId, entry: { kind: 'hp', label, from: old.hp, to: item.hp, key: `${item.id}:hp` } });
    }
    for (const [field, title] of fields) {
      const from = old[field] as unknown as number | string | undefined;
      const to = item[field] as unknown as number | string | undefined;
      if (from !== to) out.push({ groupId, entry: { kind: 'value', label, field: title, from: from ?? '—', to: to ?? '—', key: `${item.id}:${String(field)}` } });
    }
  }
  for (const item of prev) if (!after.has(item.id)) out.push(note(groupOf(item), `${words.removed}: «${nameOf(item) || 'без названия'}»`));
  return out;
}

export const diffMembers = (prev: PartyMember[], next: PartyMember[], groups: Group[]): LogDraft[] =>
  diffRecords(prev, next, groups, MEMBER_FIELDS, (m) => m.name, { added: 'Добавлен игрок', removed: 'Удалён игрок' });

export const diffEnemies = (prev: Enemy[], next: Enemy[], groups: Group[]): LogDraft[] =>
  diffRecords(prev, next, groups, ENEMY_FIELDS, (e) => e.name, { added: 'Добавлен противник', removed: 'Удалён противник' });

export function diffEnemyGroups(prev: EnemyGroup[], next: EnemyGroup[], groups: Group[]): LogDraft[] {
  const out: LogDraft[] = [];
  const before = new Map(prev.map((p) => [p.id, p]));
  const after = new Set(next.map((n) => n.id));
  for (const g of next) {
    const old = before.get(g.id);
    const groupId = effectiveGroupId(g.groupId, groups);
    if (!old) out.push(note(groupId, `Создана подгруппа противников «${g.name}»`));
    else if (old.name !== g.name) out.push(note(groupId, `Подгруппа противников «${old.name}» → «${g.name}»`));
  }
  for (const g of prev) if (!after.has(g.id)) out.push(note(effectiveGroupId(g.groupId, groups), `Удалена подгруппа противников «${g.name}»`));
  return out;
}

export function diffEncounters(prev: Encounter[], next: Encounter[], nameOf: (p: EncounterParticipant) => string): LogDraft[] {
  const out: LogDraft[] = [];
  const before = new Map(prev.map((p) => [p.groupId, p]));
  for (const enc of next) {
    const old = before.get(enc.groupId);
    const g = enc.groupId;
    if (!old || old.active !== enc.active) {
      if (enc.active) out.push(note(g, 'Бой начался'));
      else if (old?.active) out.push(note(g, `Бой завершён (раунд ${old.round})`));
    }
    if (old && old.active && enc.active && old.round !== enc.round) {
      out.push({ groupId: g, entry: { kind: 'value', label: 'Бой', field: 'Раунд', from: old.round, to: enc.round, key: `${enc.id}:round` } });
    }
    const oldParts = new Map((old?.participants ?? []).map((p) => [p.id, p]));
    const newParts = new Map(enc.participants.map((p) => [p.id, p]));
    for (const p of enc.participants) {
      const was = oldParts.get(p.id);
      if (!was) {
        out.push(note(g, `В бой добавлен(а): «${nameOf(p)}»`));
        continue;
      }
      if (was.initiative !== p.initiative) {
        out.push({ groupId: g, entry: { kind: 'value', label: nameOf(p), field: 'Инициатива', from: was.initiative, to: p.initiative, key: `${p.id}:init` } });
      }
      const wasIds = new Set(was.conditions.map((c) => c.id));
      const nowIds = new Set(p.conditions.map((c) => c.id));
      for (const c of p.conditions) {
        if (!wasIds.has(c.id)) out.push(note(g, `Состояние «${c.name}»${c.rounds !== undefined ? ` (${c.rounds} р.)` : ''}: ${nameOf(p)}`));
      }
      for (const c of was.conditions) {
        if (!nowIds.has(c.id) && !(c.rounds !== undefined && c.rounds <= 1)) out.push(note(g, `Снято состояние «${c.name}»: ${nameOf(p)}`));
      }
    }
    for (const p of old?.participants ?? []) if (!newParts.has(p.id)) out.push(note(g, `Убран из боя: «${nameOf(p)}»`));
  }
  return out;
}

export function diffLoot(prev: EquipItem[], next: EquipItem[], groups: Group[]): LogDraft[] {
  const out: LogDraft[] = [];
  const before = new Map(prev.map((p) => [p.id, p]));
  const after = new Map(next.map((n) => [n.id, n]));
  const addedByGroup = new Map<string, number>();
  for (const item of next) {
    const old = before.get(item.id);
    const g = effectiveGroupId(item.groupId, groups);
    const label = item.name.trim() || 'без названия';
    if (!old) {
      addedByGroup.set(g, (addedByGroup.get(g) ?? 0) + 1);
      continue;
    }
    const oldGroup = effectiveGroupId(old.groupId, groups);
    if (oldGroup !== g) out.push(note(g, `В лут перенесено: «${label}»`), note(oldGroup, `Из лута перенесено в другую группу: «${label}»`));
    if (old.givenTo !== item.givenTo) {
      out.push(note(g, item.givenTo ? `Выдано игроку «${item.givenTo}»: «${label}»` : `Отметка о выдаче снята: «${label}»`));
    }
  }
  for (const [g, count] of addedByGroup) {
    const names = next.filter((i) => !before.has(i.id) && effectiveGroupId(i.groupId, groups) === g).map((i) => i.name.trim() || 'без названия');
    out.push(note(g, count <= 3 ? `В лут добавлено: ${names.map((n) => `«${n}»`).join(', ')}` : `В лут добавлено: ${count} шт.`));
  }
  for (const item of prev) {
    if (!after.has(item.id)) out.push(note(effectiveGroupId(item.groupId, groups), `Удалено из лута: «${item.name.trim() || 'без названия'}»`));
  }
  return out;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function describeGroupEntry(e: GroupLogEntry): string {
  switch (e.kind) {
    case 'hp': {
      const delta = Number(e.to) - Number(e.from);
      return `${e.label}: здоровье ${e.from} → ${e.to} (${signed(delta)})`;
    }
    case 'value':
      return `${e.label}: ${e.field} ${e.from} → ${e.to}`;
    default:
      return e.text ?? '';
  }
}

/** Добавляет записи в журнал одной группы: правки одного значения подряд сливаются, журнал ограничен по длине. */
export function appendGroupLog(
  log: GroupLogEntry[] | undefined,
  entries: LogDraft['entry'][],
  now: number = Date.now(),
  makeId: () => string = () => crypto.randomUUID(),
): GroupLogEntry[] | undefined {
  if (entries.length === 0) return log;
  const result = [...(log ?? [])];
  for (const entry of entries) {
    if (entry.key) {
      let index = -1;
      for (let i = result.length - 1; i >= 0 && i >= result.length - 25; i--) {
        if (result[i].key === entry.key && result[i].kind === entry.kind) {
          index = i;
          break;
        }
      }
      if (index >= 0 && now - result[index].at <= MERGE_WINDOW_MS) {
        const merged = { ...result[index], to: entry.to, at: now };
        if (merged.from === merged.to) result.splice(index, 1);
        else result[index] = merged;
        continue;
      }
    }
    result.push({ ...entry, id: makeId(), at: now });
  }
  return result.slice(-MAX_ENTRIES);
}

/** Раскладывает записи по журналам групп. */
export function applyDrafts(logs: Record<string, GroupLogEntry[]>, drafts: LogDraft[], now: number = Date.now()): Record<string, GroupLogEntry[]> {
  if (drafts.length === 0) return logs;
  const next = { ...logs };
  const byGroup = new Map<string, LogDraft['entry'][]>();
  for (const d of drafts) byGroup.set(d.groupId, [...(byGroup.get(d.groupId) ?? []), d.entry]);
  for (const [groupId, entries] of byGroup) next[groupId] = appendGroupLog(next[groupId], entries, now) ?? [];
  return next;
}
