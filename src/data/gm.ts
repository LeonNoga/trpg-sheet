import { computeDerivedStats } from './formulas';
import type { Character, Encounter, EncounterParticipant, Enemy, EnemyGroup, EquipItem, Group, GroupSnapshot, PartyMember } from '../types';

// ---------- группы ----------

export const DEFAULT_GROUP_NAME = 'Основная группа';

export function createGroup(name: string, now: number = Date.now()): Group {
  return { id: crypto.randomUUID(), name: name.trim() || DEFAULT_GROUP_NAME, createdAt: now };
}

/** Записи без группы (созданные до появления групп) относятся к первой группе; удалённая группа — тоже к первой. */
export function effectiveGroupId(groupId: string | undefined, groups: Group[]): string {
  if (groupId && groups.some((g) => g.id === groupId)) return groupId;
  return groups[0]?.id ?? '';
}

export function inGroup(entity: { groupId?: string }, groupId: string, groups: Group[]): boolean {
  return effectiveGroupId(entity.groupId, groups) === groupId;
}

// ---------- мини-карточки игроков ----------

export function createBlankMember(groupId: string | undefined, now: number = Date.now()): PartyMember {
  return {
    id: crypto.randomUUID(),
    groupId,
    name: '',
    playerName: '',
    type: '',
    level: 1,
    hp: 10,
    hpMax: 10,
    defense: 10,
    speed: 0,
    passivePerception: 10,
    initiative: 0,
    resistance: 10,
    note: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Мини-карточка по полной карточке персонажа (из файла игрока): основные числа берутся из расчёта. */
export function memberFromCharacter(character: Character, groupId: string | undefined, now: number = Date.now()): PartyMember {
  const d = computeDerivedStats(character);
  return {
    id: crypto.randomUUID(),
    groupId,
    name: character.characterName,
    playerName: character.playerName,
    type: character.species,
    level: character.level,
    hp: Math.min(character.pools.hp, d.hp),
    hpMax: d.hp,
    defense: d.defense,
    speed: d.speed,
    passivePerception: d.passivePerception,
    initiative: d.initiative,
    resistance: d.resistance,
    note: '',
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- противники ----------

/** Типы противников для выбора в карточке. */
export const ENEMY_KINDS = ['Зомби', 'Монстр', 'NPC'];

export function createEnemyGroup(groupId: string | undefined, name: string, description = '', now: number = Date.now()): EnemyGroup {
  return { id: crypto.randomUUID(), groupId, name: name.trim() || 'Подгруппа', description, createdAt: now };
}


export function createBlankEnemy(groupId: string | undefined, now: number = Date.now()): Enemy {
  return {
    id: crypto.randomUUID(),
    groupId,
    name: '',
    kind: '',
    hp: 10,
    hpMax: 10,
    defense: 10,
    speed: 0,
    passivePerception: 10,
    initiative: 0,
    resistance: 10,
    stats: {},
    attacks: '',
    description: '',
    fields: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Имя для копии: «Зомби» → «Зомби 2», следующая — «Зомби 3» (по уже существующим в группе). */
export function nextCopyName(name: string, existingNames: string[]): string {
  const base = name.trim().replace(/\s+\d+$/, '') || 'Противник';
  const taken = new Set(existingNames.map((n) => n.trim()));
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Копии противника с новыми id, полным здоровьем и нумерацией имён. */
export function cloneEnemy(source: Enemy, count: number, existing: Enemy[], now: number = Date.now()): Enemy[] {
  const names = existing.map((e) => e.name);
  const copies: Enemy[] = [];
  for (let i = 0; i < count; i++) {
    const name = nextCopyName(source.name, [...names, ...copies.map((c) => c.name)]);
    // Если исходный без номера, он тоже остаётся «Зомби», копии — «Зомби 2…».
    copies.push({
      ...source,
      id: crypto.randomUUID(),
      name,
      hp: source.hpMax,
      fields: source.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
      createdAt: now,
      updatedAt: now,
    });
  }
  return copies;
}

// ---------- бой ----------

export function createEncounter(groupId: string): Encounter {
  return { id: crypto.randomUUID(), groupId, active: false, round: 0, participants: [] };
}

/** Участники по убыванию инициативы; при равенстве — в порядке добавления. */
export function orderOf(encounter: Encounter): EncounterParticipant[] {
  return encounter.participants
    .map((p, index) => ({ p, index }))
    .sort((a, b) => b.p.initiative - a.p.initiative || a.index - b.index)
    .map(({ p }) => p);
}

/** Начинает бой: первый раунд, ходит первый по инициативе (из тех, кто в строю). */
export function startEncounter(encounter: Encounter, isOut: (p: EncounterParticipant) => boolean = () => false): Encounter {
  const first = orderOf(encounter).find((p) => !isOut(p));
  return { ...encounter, active: true, round: 1, currentId: first?.id };
}

export function endEncounter(encounter: Encounter): Encounter {
  return { ...encounter, active: false, round: 0, currentId: undefined };
}

/** Состояния с числом раундов уменьшаются на единицу в конце раунда; истёкшие исчезают. */
function tickConditions(participants: EncounterParticipant[]): EncounterParticipant[] {
  return participants.map((p) => ({
    ...p,
    conditions: p.conditions
      .map((c) => (c.rounds === undefined ? c : { ...c, rounds: c.rounds - 1 }))
      .filter((c) => c.rounds === undefined || c.rounds > 0),
  }));
}

/**
 * Следующий ход: переходит к следующему по порядку, пропуская выбывших (isOut). После последнего начинается
 * новый раунд — состояния с раундами уменьшаются. Если в строю никого нет, бой не меняется.
 */
export function nextTurn(encounter: Encounter, isOut: (p: EncounterParticipant) => boolean = () => false): Encounter {
  const order = orderOf(encounter);
  if (!encounter.active || order.every(isOut)) return encounter;
  const at = order.findIndex((p) => p.id === encounter.currentId);
  for (let step = 1; step <= order.length; step++) {
    const index = at + step;
    const candidate = order[index % order.length];
    if (isOut(candidate)) continue;
    const wrapped = Math.floor(index / order.length);
    return {
      ...encounter,
      currentId: candidate.id,
      round: encounter.round + wrapped,
      participants: wrapped > 0 ? tickConditions(encounter.participants) : encounter.participants,
    };
  }
  return encounter;
}

export function addParticipant(encounter: Encounter, participant: Omit<EncounterParticipant, 'id' | 'conditions'>): Encounter {
  if (encounter.participants.some((p) => p.kind === participant.kind && p.refId === participant.refId)) return encounter;
  const added: EncounterParticipant = { ...participant, id: crypto.randomUUID(), conditions: [] };
  const next = { ...encounter, participants: [...encounter.participants, added] };
  return encounter.active && !encounter.currentId ? { ...next, currentId: added.id } : next;
}

/** Убирает участника; если сейчас был его ход — ход переходит к следующему в строю. */
export function removeParticipant(encounter: Encounter, id: string, isOut: (p: EncounterParticipant) => boolean = () => false): Encounter {
  const base = encounter.currentId === id ? nextTurn(encounter, (p) => p.id === id || isOut(p)) : encounter;
  return {
    ...base,
    participants: base.participants.filter((p) => p.id !== id),
    currentId: base.currentId === id ? undefined : base.currentId,
  };
}

export function updateParticipant(encounter: Encounter, id: string, patch: Partial<EncounterParticipant>): Encounter {
  return { ...encounter, participants: encounter.participants.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

// ---------- история группы ----------

const withoutImage = <T extends { image?: string }>(item: T): T => {
  const { image: _image, ...rest } = item;
  return rest as T;
};

/** Снимок данных группы (без картинок — они тяжёлые; при возврате их вернут записи, оставшиеся по id). */
export function buildGroupSnapshot(
  groupId: string,
  data: { members: PartyMember[]; enemies: Enemy[]; enemyGroups: EnemyGroup[]; encounter?: Encounter; loot: EquipItem[] },
  now: number = Date.now(),
): GroupSnapshot {
  return {
    at: now,
    groupId,
    members: data.members,
    enemies: data.enemies.map(withoutImage),
    enemyGroups: data.enemyGroups,
    encounter: data.encounter,
    loot: data.loot.map(withoutImage),
  };
}

/** Картинки текущих записей возвращаются тем записям снимка, у которых тот же id. */
export function reattachImages<T extends { id: string; image?: string }>(restored: T[], current: T[]): T[] {
  const images = new Map(current.map((c) => [c.id, c.image]));
  return restored.map((r) => (images.get(r.id) ? { ...r, image: images.get(r.id) } : r));
}
