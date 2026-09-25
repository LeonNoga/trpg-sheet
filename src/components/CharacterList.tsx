import { useRef } from 'react';
import { useAppData } from '../state/AppDataContext';
import { PATH_LABELS } from '../data/statsConfig';
import { importCharacterFromFile } from '../storage/exportImport';
import type { Character, Roster } from '../types';

interface Props {
  roster: Roster;
  onOpen: (id: string) => void;
  onCreate: () => void;
  emptyHint?: string;
  hideCreate?: boolean;
  importLabel?: string;
}

export function CharacterList({ roster, onOpen, onCreate, emptyHint, hideCreate, importLabel }: Props) {
  const { characters, importCharacter } = useAppData();
  const fileInput = useRef<HTMLInputElement>(null);
  const list = characters.filter((c) => c.roster === roster);

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      const character: Character = await importCharacterFromFile(file);
      importCharacter(character, roster);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось импортировать файл.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div>
      <div className="top-actions">
        {!hideCreate && (
          <button className="btn btn-primary" onClick={onCreate}>
            + Новый персонаж
          </button>
        )}
        <button className="btn" onClick={() => fileInput.current?.click()}>
          {importLabel ?? 'Импортировать JSON'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => handleImport(e.target.files?.[0])}
        />
      </div>

      {list.length === 0 ? (
        <div className="empty-state">{emptyHint ?? 'Пока нет ни одного персонажа.'}</div>
      ) : (
        <div className="char-list-grid">
          {list.map((c) => (
            <button className="char-list-card" key={c.id} onClick={() => onOpen(c.id)}>
              <span className="pill-badge">{PATH_LABELS[c.path]}</span>
              <h3>{c.characterName || 'Без имени'}</h3>
              <span className="meta">
                {c.playerName || 'Игрок не указан'} · Ур. {c.level}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
