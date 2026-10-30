import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CharacterInfo } from './CharacterInfo';
import { createBlankCharacter } from '../data/defaults';
import type { Path } from '../types';

describe('сворачиваемая информация персонажа', () => {
  it('по умолчанию закрыта; summary содержит только имя, модель и уровень', () => {
    const c = createBlankCharacter('tech');
    c.characterName = 'Игбо'; c.species = 'Индуктор'; c.level = 15;
    const before = structuredClone(c);
    const html = renderToStaticMarkup(<CharacterInfo character={c}><input aria-label="Имя игрока" defaultValue="Игрок" /></CharacterInfo>);
    expect(html).toContain('<details class="card character-info">');
    expect(html).not.toMatch(/<details[^>]*\bopen/);
    const summary = html.split('</summary>')[0];
    for (const text of ['Игбо', 'Индуктор', '15']) expect(summary).toContain(text);
    expect(summary).not.toContain('<input');
    expect(summary).not.toContain('Имя игрока');
    expect(html.split('</summary>')[1]).toContain('aria-label="Имя игрока"');
    expect(c).toEqual(before);
  });
  it.each<[Path, string]>([['tech', 'Модель'], ['magic', 'Класс'], ['genetic', 'Вид']])('%s сохраняет название поля %s', (path, label) => {
    const html = renderToStaticMarkup(<CharacterInfo character={createBlankCharacter(path)}>Поля</CharacterInfo>);
    expect(html).toContain(`<small>${label}</small>`);
    expect(html).toContain('<strong>—</strong>');
  });
});
