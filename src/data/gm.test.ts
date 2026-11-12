import { describe, expect, it } from 'vitest';
import {
  addParticipant,
  buildGroupBackup,
  copyEnemiesToGroup,
  copySubgroupToGroup,
  createEnemyGroup,
  remapGroupBackup,
  cloneEnemy,
  createBlankEnemy,
  createBlankMember,
  createEncounter,
  createGroup,
  effectiveGroupId,
  nextCopyName,
  nextTurn,
  orderOf,
  removeParticipant,
  startEncounter,
} from './gm';
import type { Encounter } from '../types';

const encounterWith = (initiatives: [string, number][]): Encounter => {
  let e = createEncounter('g');
  for (const [refId, initiative] of initiatives) e = addParticipant(e, { kind: 'enemy', refId, initiative });
  return e;
};
const names = (e: Encounter) => orderOf(e).map((p) => p.refId);
const current = (e: Encounter) => e.participants.find((p) => p.id === e.currentId)?.refId;

describe('группы', () => {
  it('записи без группы и из удалённой группы относятся к первой', () => {
    const a = createGroup('Первая');
    const b = createGroup('Вторая');
    expect(effectiveGroupId(undefined, [a, b])).toBe(a.id);
    expect(effectiveGroupId('нет такой', [a, b])).toBe(a.id);
    expect(effectiveGroupId(b.id, [a, b])).toBe(b.id);
    expect(createGroup('  ').name).toBe('Основная группа');
  });
});

describe('противники', () => {
  it('копии получают номера и полное здоровье', () => {
    const zombie = { ...createBlankEnemy('g'), name: 'Зомби', hpMax: 20, hp: 5 };
    const copies = cloneEnemy(zombie, 3, [zombie]);
    expect(copies.map((c) => c.name)).toEqual(['Зомби 2', 'Зомби 3', 'Зомби 4']);
    expect(copies.every((c) => c.hp === 20 && c.id !== zombie.id)).toBe(true);
    expect(nextCopyName('Зомби 3', ['Зомби', 'Зомби 2', 'Зомби 3'])).toBe('Зомби 4');
  });
});

describe('бой', () => {
  it('порядок по инициативе; при равенстве — как добавлены', () => {
    expect(names(encounterWith([['a', 5], ['b', 12], ['c', 5]]))).toEqual(['b', 'a', 'c']);
  });

  it('ход идёт по кругу, после последнего — новый раунд', () => {
    let e = startEncounter(encounterWith([['a', 12], ['b', 8], ['c', 3]]));
    expect([current(e), e.round]).toEqual(['a', 1]);
    e = nextTurn(e);
    e = nextTurn(e);
    expect([current(e), e.round]).toEqual(['c', 1]);
    e = nextTurn(e);
    expect([current(e), e.round]).toEqual(['a', 2]);
  });

  it('выбывших пропускает, а если в строю никого нет — бой не меняется', () => {
    const out = new Set(['b']);
    const isOut = (p: { refId: string }) => out.has(p.refId);
    let e = startEncounter(encounterWith([['a', 12], ['b', 8], ['c', 3]]), isOut);
    e = nextTurn(e, isOut);
    expect(current(e)).toBe('c');
    const dead = encounterWith([['a', 1]]);
    const started = startEncounter(dead);
    expect(nextTurn(started, () => true)).toBe(started);
  });

  it('состояния с раундами уменьшаются в конце раунда и исчезают', () => {
    let e = startEncounter(encounterWith([['a', 12], ['b', 8]]));
    const a = e.participants[0].id;
    e = {
      ...e,
      participants: e.participants.map((p) =>
        p.id === a
          ? { ...p, conditions: [{ id: '1', name: 'Горит', rounds: 2 }, { id: '2', name: 'Оглушён' }] }
          : p,
      ),
    };
    e = nextTurn(nextTurn(e)); // новый раунд
    expect(e.round).toBe(2);
    expect(e.participants[0].conditions).toEqual([{ id: '1', name: 'Горит', rounds: 1 }, { id: '2', name: 'Оглушён' }]);
    e = nextTurn(nextTurn(e));
    expect(e.participants[0].conditions).toEqual([{ id: '2', name: 'Оглушён' }]);
  });

  it('удаление участника, у которого сейчас ход, передаёт ход следующему', () => {
    let e = startEncounter(encounterWith([['a', 12], ['b', 8], ['c', 3]]));
    const a = e.participants.find((p) => p.refId === 'a')!;
    e = removeParticipant(e, a.id);
    expect(current(e)).toBe('b');
    expect(e.participants).toHaveLength(2);
    const one = startEncounter(encounterWith([['x', 1]]));
    expect(removeParticipant(one, one.participants[0].id).participants).toEqual([]);
  });

  it('один и тот же участник не добавляется дважды', () => {
    const e = encounterWith([['a', 1]]);
    expect(addParticipant(e, { kind: 'enemy', refId: 'a', initiative: 5 })).toBe(e);
  });
});

describe('копия группы', () => {
  const group = createGroup('Пятница');
  const other = createGroup('Среда');
  const member = { ...createBlankMember(group.id), name: 'Анна' };
  const enemy = { ...createBlankEnemy(group.id), name: 'Зомби' };
  const foreign = { ...createBlankEnemy(other.id), name: 'Чужой' };
  const encounter = startEncounter(addParticipant(addParticipant(createEncounter(group.id), { kind: 'player', refId: member.id, initiative: 3 }), { kind: 'enemy', refId: enemy.id, initiative: 1 }));

  it('в копию попадает только то, что относится к группе', () => {
    const file = buildGroupBackup(group, [group, other], {
      members: [member],
      enemies: [enemy, foreign],
      enemyGroups: [],
      encounters: [encounter, createEncounter(other.id)],
      loot: [{ id: 'l1', kind: 'item', name: 'Амулет', equipped: false, statBonuses: {}, groupId: group.id }, { id: 'l2', kind: 'item', name: 'Чужой', equipped: false, statBonuses: {}, groupId: other.id }],
      characters: [],
      log: [],
    });
    expect(file.fileType).toBe('trpg-sheet-group');
    expect(file.enemies.map((e) => e.name)).toEqual(['Зомби']);
    expect(file.loot.map((i) => i.name)).toEqual(['Амулет']);
    expect(file.encounter?.groupId).toBe(group.id);
  });

  it('импорт «как новой группы» даёт новые id и сохраняет связи боя', () => {
    const file = buildGroupBackup(group, [group], { members: [member], enemies: [enemy], enemyGroups: [], encounters: [encounter], loot: [], characters: [], log: [] });
    const copy = remapGroupBackup(file, ['Пятница']);
    expect(copy.group.id).not.toBe(group.id);
    expect(copy.group.name).toBe('Пятница (импорт)');
    expect(copy.members[0].id).not.toBe(member.id);
    expect(copy.members[0].groupId).toBe(copy.group.id);
    const refs = copy.encounter!.participants.map((p) => p.refId);
    expect(refs).toEqual([copy.members[0].id, copy.enemies[0].id].sort((a) => (a === copy.members[0].id ? -1 : 1)));
    expect(copy.encounter!.groupId).toBe(copy.group.id);
    expect(copy.encounter!.currentId).toBe(copy.encounter!.participants.find((p) => p.refId === copy.members[0].id)!.id);
    expect(remapGroupBackup(file, []).group.name).toBe('Пятница');
  });
});

describe('копирование между группами', () => {
  const a = createGroup('Первая');
  const b = createGroup('Вторая');
  const sub = createEnemyGroup(a.id, 'Орда');
  const zombie = { ...createBlankEnemy(a.id), name: 'Зомби', hp: 3, hpMax: 12, enemyGroupId: sub.id };

  it('противники копируются с новыми id, полным здоровьем и без подгруппы', () => {
    const [copy] = copyEnemiesToGroup([zombie], b.id);
    expect(copy.id).not.toBe(zombie.id);
    expect([copy.groupId, copy.hp, copy.enemyGroupId, copy.name]).toEqual([b.id, 12, undefined, 'Зомби']);
    expect(zombie.hp).toBe(3);
  });

  it('подгруппа копируется целиком, противники привязаны к новой подгруппе; одинаковое имя помечается', () => {
    const { group, enemies } = copySubgroupToGroup(sub, [zombie, { ...zombie, id: 'z2', name: 'Бегун' }], b.id, ['Орда']);
    expect(group.id).not.toBe(sub.id);
    expect([group.groupId, group.name]).toEqual([b.id, 'Орда (копия)']);
    expect(enemies.map((e) => e.name)).toEqual(['Зомби', 'Бегун']);
    expect(enemies.every((e) => e.enemyGroupId === group.id && e.groupId === b.id)).toBe(true);
    expect(copySubgroupToGroup(sub, [zombie], b.id, []).group.name).toBe('Орда');
  });

  it('копия группы включает лут мастера и картинки только этой группы', () => {
    const item = (id: string, groupId: string) => ({ id, kind: 'item' as const, name: id, equipped: false, statBonuses: {}, groupId });
    const file = buildGroupBackup(a, [a, b], {
      members: [], enemies: [], enemyGroups: [], encounters: [], loot: [], characters: [], log: [],
      masterLoot: [item('m1', a.id), item('m2', b.id)],
      masterImages: [{ id: 'i1', groupId: a.id, name: 'x', image: 'data:', addedAt: 1 }, { id: 'i2', groupId: b.id, name: 'y', image: 'data:', addedAt: 1 }],
    });
    expect(file.masterLoot?.map((i) => i.id)).toEqual(['m1']);
    expect(file.masterImages?.map((i) => i.id)).toEqual(['i1']);
    const copy = remapGroupBackup(file);
    expect(copy.masterLoot![0].id).not.toBe('m1');
    expect(copy.masterLoot![0].groupId).toBe(copy.group.id);
  });
});
