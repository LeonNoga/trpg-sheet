import { createBlankCharacter, normalizeCharacter } from './defaults';
import { expect, it } from 'vitest';
import { groupRows, updateGroupRow } from './groupRows';

it('показывает пять пустых строк для новой группы', () => {
  expect(groupRows('')).toEqual(['', '', '', '', '']);
});
it('сохраняет порядок и пустые промежуточные строки старых данных', () => {
  expect(groupRows('Анна\r\n\r\nБорис')).toEqual(['Анна', '', 'Борис', '', '']);
});
it('сохраняет весь текст старой группы длиннее пяти строк', () => {
  const old = 'А\nБ\nВ\nГ\nД\nЕ\nЖ';
  expect(groupRows(old)).toEqual(['А', 'Б', 'В', 'Г', 'Д\nЕ\nЖ']);
  expect(updateGroupRow(old, 1, 'Новое имя')).toBe('А\nНовое имя\nВ\nГ\nД\nЕ\nЖ');
});
it('удаление участника не сдвигает остальные строки', () => {
  expect(groupRows(updateGroupRow('А\nБ\nВ', 1, ''))).toEqual(['А', '', 'В', '', '']);
});
it('последовательные изменения сохраняют обе записи в прежнем строковом формате', () => {
  const updated = updateGroupRow(updateGroupRow('', 0, 'Анна'), 4, 'Борис');
  expect(updated).toBe('Анна\n\n\n\nБорис');
});

it('название группы сохраняется при нормализации и JSON-переносе независимо от участников', () => {
  const character = createBlankCharacter('tech');
  character.groupName = 'Северный отряд';
  character.group = 'Анна\nБорис';
  const restored = normalizeCharacter(JSON.parse(JSON.stringify(character)));
  expect(restored.groupName).toBe('Северный отряд');
  expect(restored.group).toBe('Анна\nБорис');
  delete character.groupName;
  expect(normalizeCharacter(character).groupName).toBe('');
});
