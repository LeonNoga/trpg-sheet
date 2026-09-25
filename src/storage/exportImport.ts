import { normalizeCharacter } from '../data/defaults';
import type { Character, CharacterExportFile } from '../types';

export function exportCharacter(character: Character): void {
  const payload: CharacterExportFile = {
    fileType: 'trpg-sheet-character',
    version: 1,
    character,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = character.characterName.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'character';
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importCharacterFromFile(file: File): Promise<Character> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Файл повреждён или не является корректным JSON.');
  }

  const data = parsed as Partial<CharacterExportFile> & { character?: Character };
  const character = data.character ?? (parsed as Character);

  if (!character || typeof character !== 'object' || !character.id || !character.baseStats) {
    throw new Error('Это не похоже на файл карточки персонажа.');
  }

  return normalizeCharacter(character);
}
