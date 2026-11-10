import { describe, expect, it } from 'vitest';
import { appendLog, appendNote, canRevert, describeEntry, diffCharacter, revertEntry } from './changeLog';
import { absorbFromPearl } from './development';
import { createBlankCharacter } from './defaults';
import type { ChangeEntry, Character } from '../types';

const make = (patch: Partial<Character> = {}): Character => ({ ...createBlankCharacter('genetic'), ...patch });
let n = 0;
const id = () => `id${n++}`;
const log = (drafts: ReturnType<typeof diffCharacter>, level = 12, at = 1000, prev?: ChangeEntry[]) =>
  appendLog(prev, drafts, level, at, id) ?? [];

describe('сравнение состояний карточки', () => {
  it('характеристика: запись с названием, значениями и разницей', () => {
    const a = make();
    const b = { ...a, baseStats: { ...a.baseStats, strength: a.baseStats.strength + 3 } };
    const entries = log(diffCharacter(a, b), 12);
    expect(entries).toHaveLength(1);
    expect(describeEntry(entries[0])).toBe(`Сила: ${a.baseStats.strength} → ${a.baseStats.strength + 3} (+3)`);
    expect(entries[0].lv).toBe(12);
  });

  it('здоровье, выносливость и ресурс в журнал не попадают', () => {
    const a = make();
    expect(diffCharacter(a, { ...a, pools: { hp: 1, staminaPoints: 1, resourcePoints: 1 } })).toEqual([]);
  });

  it('добавление, удаление и надевание предметов и умений', () => {
    const a = make();
    const item = { id: 'i', kind: 'item' as const, name: 'Амулет', equipped: false, statBonuses: {} };
    const ability = { id: 'a', kind: 'ability' as const, name: 'Рывок', equipped: true, statBonuses: {} };
    const added = { ...a, items: [item], abilities: [ability] };
    expect(diffCharacter(a, added).map(describeEntryDraft)).toEqual(['Добавлено снаряжение «Амулет»', 'Добавлено умение «Рывок»']);
    const worn = { ...added, items: [{ ...item, equipped: true }] };
    expect(diffCharacter(added, worn).map(describeEntryDraft)).toEqual(['Надето: «Амулет»']);
    expect(diffCharacter(worn, a).map(describeEntryDraft)).toEqual(['Удалено снаряжение «Амулет»', 'Удалено умение «Рывок»']);
  });

  it('впитывание и освобождение слота', () => {
    const a = make();
    const b = { ...a, dnaLists: a.dnaLists.map((l, i) => (i === 1 ? { ...l, slots: ['Рывок', ...l.slots.slice(1)] } : l)) };
    expect(diffCharacter(a, b).map(describeEntryDraft)).toEqual(['Впитано «Рывок» — ДНК']);
    expect(diffCharacter(b, a).map(describeEntryDraft)).toEqual(['Освобождён слот «Рывок» — ДНК']);
  });

  it('«всосать» из жемчужины — одна запись, а не две', () => {
    const a = make({ developmentPoints: 4, pearls: [{ id: 'p', points: 7 }] });
    const b = absorbFromPearl(a, 'p', 3);
    expect(diffCharacter(a, b).map(describeEntryDraft)).toEqual(['Всосано 3 очк. развития из жемчужины']);
  });

  it('уровень и очки за уровни фиксируются; опыт при повышении уровня отдельно не пишется', () => {
    const a = make({ level: 11, experience: 50, levelPoints: 20 });
    const b = { ...a, level: 12, experience: 10, levelPoints: 22 };
    const kinds = diffCharacter(a, b).map((d) => d.kind);
    expect(kinds).toEqual(['level', 'levelPoints']);
  });
});

function describeEntryDraft(d: ReturnType<typeof diffCharacter>[number]) {
  return describeEntry({ id: 'x', at: 0, lv: 1, ...d });
}

describe('журнал: объединение и ограничения', () => {
  it('набор числа по цифрам даёт одну запись с первым «было» и последним «стало»', () => {
    const a = make();
    const from = a.baseStats.strength;
    let entries: ChangeEntry[] = [];
    let prev = a;
    [3, 30, 33].forEach((value, i) => {
      const next = { ...prev, baseStats: { ...prev.baseStats, strength: value } };
      entries = log(diffCharacter(prev, next), 12, 1000 + i * 1000, entries);
      prev = next;
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].from).toBe(from);
    expect(entries[0].to).toBe(33);
  });

  it('если значение вернулось к исходному, запись исчезает', () => {
    const a = make();
    const b = { ...a, bonusStatPoints: 10 };
    let entries = log(diffCharacter(a, b), 1, 1000);
    entries = log(diffCharacter(b, a), 1, 2000, entries);
    expect(entries).toEqual([]);
  });

  it('позже окна объединения — новая запись', () => {
    const a = make();
    const b = { ...a, bonusStatPoints: 10 };
    const c = { ...a, bonusStatPoints: 20 };
    let entries = log(diffCharacter(a, b), 1, 1000);
    entries = log(diffCharacter(b, c), 1, 1000 + 5 * 60_000, entries);
    expect(entries).toHaveLength(2);
  });

  it('хранится не больше 300 записей — старые отбрасываются', () => {
    let entries: ChangeEntry[] = [];
    for (let i = 0; i < 320; i++) entries = appendNote(entries, `n${i}`, 1, i);
    expect(entries).toHaveLength(300);
    expect(entries[0].label).toBe('n20');
  });
});

describe('отмена записи', () => {
  it('характеристику можно вернуть, пока она не менялась после записи', () => {
    const a = make();
    const b = { ...a, baseStats: { ...a.baseStats, strength: 40 } };
    const [entry] = log(diffCharacter(a, b));
    expect(canRevert(b, entry)).toBe(true);
    expect(revertEntry(b, entry)!.baseStats.strength).toBe(a.baseStats.strength);
    const later = { ...b, baseStats: { ...b.baseStats, strength: 41 } };
    expect(canRevert(later, entry)).toBe(false);
    expect(revertEntry(later, entry)).toBeNull();
  });

  it('очки развития и навык; запись «добавлено» отменить нельзя', () => {
    const a = make({ developmentPoints: 2 });
    const b = { ...a, developmentPoints: 9, skills: { Атлетика: 10 as const } };
    const entries = log(diffCharacter(a, b));
    const dev = entries.find((e) => e.kind === 'developmentPoints')!;
    const skill = entries.find((e) => e.kind === 'skill')!;
    expect(revertEntry(b, dev)!.developmentPoints).toBe(2);
    expect(revertEntry(b, skill)!.skills.Атлетика).toBe(0);
    const added = log(diffCharacter(a, { ...a, items: [{ id: 'i', kind: 'item', name: 'X', equipped: true, statBonuses: {} }] }));
    expect(canRevert(a, added[0])).toBe(false);
  });
});
