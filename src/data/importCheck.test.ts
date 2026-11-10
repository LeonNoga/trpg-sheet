import { describe, expect, it } from 'vitest';
import { readCharacterFile } from '../storage/exportImport';
import { compareCharacters, migrationNotes } from './importCheck';
import { createBlankCharacter, normalizeCharacter } from './defaults';
import { CURRENT_SCHEMA_VERSION } from './migrations';

const asFile = (data: unknown) => new File([JSON.stringify(data)], 'c.json', { type: 'application/json' });

describe('проверка файла при импорте', () => {
  it('актуальный файл — без замечаний о миграции', async () => {
    const c = { ...createBlankCharacter('magic'), schemaVersion: CURRENT_SCHEMA_VERSION };
    const preview = await readCharacterFile(asFile({ fileType: 'trpg-sheet-character', version: 1, character: c }));
    expect(preview.notes).toEqual([]);
    expect(preview.fileVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('старый файл: объясняется, что пересчитается (очки за уровни по формуле)', async () => {
    const old = { ...createBlankCharacter('genetic'), level: 12, levelPoints: 5 } as Record<string, unknown>;
    delete old.schemaVersion;
    const preview = await readCharacterFile(asFile(old));
    expect(preview.fileVersion).toBe(0);
    expect(preview.notes[0]).toContain('схема 0');
    const text = preview.notes.join('\n');
    expect(text).toContain('Очки характеристик за уровни');
    expect(text).toContain('5 → 22'); // 2 за каждый из 11 уровней
  });

  it('файл от более новой версии отклоняется с номерами версий', async () => {
    const c = { ...createBlankCharacter('tech'), schemaVersion: CURRENT_SCHEMA_VERSION + 3 };
    await expect(readCharacterFile(asFile({ character: c }))).rejects.toThrow(`схема ${CURRENT_SCHEMA_VERSION + 3}`);
  });

  it('не-карточка и битый JSON дают понятные ошибки', async () => {
    await expect(readCharacterFile(asFile({ hello: 1 }))).rejects.toThrow('не похоже на файл карточки');
    await expect(readCharacterFile(new File(['{oops'], 'x.json'))).rejects.toThrow('повреждён');
  });

  it('класс без указанного уровня получения — отдельное замечание', () => {
    const raw = { ...createBlankCharacter('magic'), classRarity: 'rare', level: 15, levelPoints: 28 } as Record<string, unknown>;
    delete raw.schemaVersion;
    const notes = migrationNotes(raw, normalizeCharacter(raw as never));
    expect(notes.join('\n')).toContain('Уровень получения класса не указан');
  });
});

describe('сверка с тем, что уже есть', () => {
  it('отмечает различающиеся строки и файл старше текущей версии', () => {
    const current = { ...createBlankCharacter('tech'), characterName: 'Анна', level: 12, updatedAt: 2000 };
    const incoming = { ...current, level: 10, updatedAt: 1000 };
    const { rows, incomingOlder } = compareCharacters(current, incoming);
    expect(incomingOlder).toBe(true);
    expect(rows.find((r) => r.label === 'Уровень')).toMatchObject({ current: '12', incoming: '10', differs: true });
    expect(rows.find((r) => r.label === 'Имя персонажа')!.differs).toBe(false);
  });

  it('файл новее — предупреждения нет', () => {
    const current = { ...createBlankCharacter('tech'), updatedAt: 1000 };
    expect(compareCharacters(current, { ...current, updatedAt: 3000 }).incomingOlder).toBe(false);
  });
});
