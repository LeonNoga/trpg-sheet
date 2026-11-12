import { describe, expect, it } from 'vitest';
import { appendGroupLog, applyDrafts, describeGroupEntry, diffEncounters, diffEnemies, diffLoot, diffMembers } from './groupLog';
import { addParticipant, createBlankEnemy, createBlankMember, createEncounter, createGroup, nextTurn, startEncounter } from './gm';
import type { EquipItem, GroupLogEntry } from '../types';

const g1 = createGroup('Первая');
const g2 = createGroup('Вторая');
const groups = [g1, g2];
const texts = (log: GroupLogEntry[] | undefined) => (log ?? []).map(describeGroupEntry);
let n = 0;
const id = () => `i${n++}`;

describe('журнал группы', () => {
  it('игроки: добавление, правка значения, удаление', () => {
    const m = { ...createBlankMember(g1.id), name: 'Анна' };
    const added = diffMembers([], [m], groups);
    expect(added.map((d) => d.entry.text)).toEqual(['Добавлен игрок: «Анна»']);
    const changed = diffMembers([m], [{ ...m, level: 5, hp: 4 }], groups);
    const logs = applyDrafts({}, changed, 1000);
    expect(texts(logs[g1.id])).toEqual(['Анна: здоровье 10 → 4 (-6)', 'Анна: Уровень 1 → 5']);
    expect(diffMembers([m], [], groups)[0].entry.text).toBe('Удалён игрок: «Анна»');
  });

  it('урон по цифрам и серия ударов подряд сливаются в одну запись; возврат значения стирает её', () => {
    const e = { ...createBlankEnemy(g1.id), name: 'Зомби', hp: 20, hpMax: 20 };
    let log: GroupLogEntry[] | undefined;
    let prev = e;
    [15, 10].forEach((hp, i) => {
      const next = { ...prev, hp };
      const drafts = diffEnemies([prev], [next], groups).map((d) => d.entry);
      log = appendGroupLog(log, drafts, 1000 + i * 1000, id);
      prev = next;
    });
    expect(texts(log)).toEqual(['Зомби: здоровье 20 → 10 (-10)']);
    const healed = diffEnemies([prev], [{ ...prev, hp: 20 }], groups).map((d) => d.entry);
    expect(appendGroupLog(log, healed, 5000, id)).toEqual([]);
  });

  it('бой: начало, раунд, участники, состояния, конец', () => {
    const enemy = { ...createBlankEnemy(g1.id), name: 'Зомби' };
    const nameOf = () => 'Зомби';
    let enc = addParticipant(createEncounter(g1.id), { kind: 'enemy', refId: enemy.id, initiative: 3 });
    const drafts1 = diffEncounters([], [enc], nameOf);
    expect(drafts1.map((d) => d.entry.text)).toEqual(['В бой добавлен(а): «Зомби»']);
    const started = startEncounter(enc);
    expect(diffEncounters([enc], [started], nameOf).map((d) => d.entry.text)).toEqual(['Бой начался']);
    enc = started;
    const withCondition = { ...enc, participants: enc.participants.map((p) => ({ ...p, conditions: [{ id: 'c', name: 'Горит', rounds: 2 }] })) };
    expect(diffEncounters([enc], [withCondition], nameOf).map((d) => d.entry.text)).toEqual(['Состояние «Горит» (2 р.): Зомби']);
    const nextRound = nextTurn(withCondition);
    const roundEntry = diffEncounters([withCondition], [nextRound], nameOf)[0].entry;
    expect([roundEntry.field, roundEntry.from, roundEntry.to]).toEqual(['Раунд', 1, 2]);
    expect(diffEncounters([nextRound], [{ ...nextRound, active: false }], nameOf)[0].entry.text).toBe('Бой завершён (раунд 2)');
  });

  it('лут: добавление, выдача, перенос между группами', () => {
    const item: EquipItem = { id: 'a', kind: 'item', name: 'Амулет', equipped: false, statBonuses: {}, groupId: g1.id };
    expect(diffLoot([], [item], groups)[0].entry.text).toBe('В лут добавлено: «Амулет»');
    const given = diffLoot([item], [{ ...item, givenTo: 'Анна' }], groups);
    expect(given[0].entry.text).toBe('Выдано игроку «Анна»: «Амулет»');
    const moved = diffLoot([item], [{ ...item, groupId: g2.id }], groups);
    expect(moved.map((d) => d.groupId)).toEqual([g2.id, g1.id]);
    const bulk = Array.from({ length: 5 }, (_, i) => ({ ...item, id: `b${i}` }));
    expect(diffLoot([], bulk, groups)[0].entry.text).toBe('В лут добавлено: 5 шт.');
  });

  it('журнал ограничен 500 записями', () => {
    let log: GroupLogEntry[] | undefined;
    for (let i = 0; i < 520; i++) log = appendGroupLog(log, [{ kind: 'note', text: `n${i}` }], i, id);
    expect(log).toHaveLength(500);
    expect(log![0].text).toBe('n20');
  });
});
