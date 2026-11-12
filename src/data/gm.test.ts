import { describe, expect, it } from 'vitest';
import {
  addParticipant,
  cloneEnemy,
  createBlankEnemy,
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
