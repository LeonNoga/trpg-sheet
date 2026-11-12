import { useRef, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { PATH_LABELS } from '../data/statsConfig';
import { readCharacterFile } from '../storage/exportImport';
import { ImportDialog } from './ImportDialog';
import type { ImportItem } from './ImportDialog';
import { PasteImportButton } from './FileDialogs';
import { inGroup } from '../data/gm';
import type { Roster } from '../types';

interface Props {
  roster: Roster;
  onOpen: (id: string) => void;
  onCreate: () => void;
  emptyHint?: string;
  hideCreate?: boolean;
  importLabel?: string;
  /** Мастер-вид: показывать только персонажей этой группы, импортировать в неё и разрешить переносить между группами. */
  groupId?: string;
}

export function CharacterList({ roster, onOpen, onCreate, emptyHint, hideCreate, importLabel, groupId }: Props) {
  const { characters, importCharacter, groups, updateCharacter } = useAppData();
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<ImportItem | null>(null);
  const all = characters.filter((c) => c.roster === roster && (!groupId || inGroup(c, groupId, groups)));
  const q = query.trim().toLowerCase();
  const list = q
    ? all.filter((c) => `${c.characterName} ${c.playerName} ${c.species}`.toLowerCase().includes(q))
    : all;

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      const preview = await readCharacterFile(file);
      const existing = characters.find((c) => c.id === preview.character.id);
      // Без перезаписи и без миграции — сразу в список; иначе сначала показываем, что изменится.
      if (!existing && preview.notes.length === 0) importCharacter(preview.character, roster, groupId);
      else setPending({ incoming: preview.character, existing, notes: preview.notes });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось импортировать файл.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function confirmImport(choice: 'replace' | 'copy') {
    if (!pending) return;
    const { incoming } = pending;
    if (choice === 'copy') {
      const name = incoming.characterName ? `${incoming.characterName} (импорт)` : '';
      importCharacter({ ...incoming, id: crypto.randomUUID(), characterName: name }, roster, groupId);
    } else {
      importCharacter(incoming, roster, groupId);
    }
    setPending(null);
  }

  return (
    <div>
      {pending && (
        <ImportDialog
          title="Импорт персонажа"
          items={[pending]}
          allowCopy={!!pending.existing}
          onConfirm={confirmImport}
          onCancel={() => setPending(null)}
        />
      )}
      <div className="top-actions">
        {!hideCreate && (
          <button className="btn btn-primary" onClick={onCreate}>
            + Новый персонаж
          </button>
        )}
        <button className="btn" onClick={() => fileInput.current?.click()}>
          {importLabel ?? 'Импортировать JSON'}
        </button>
        <PasteImportButton onFile={handleImport} />
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => handleImport(e.target.files?.[0])}
        />
      </div>

      {all.length > 4 && (
        <input
          className="tray-search"
          style={{ marginBottom: 12 }}
          placeholder="Поиск по имени, игроку, классу"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {list.length === 0 ? (
        <div className="empty-state">
          {all.length > 0 ? 'Никого не найдено.' : (emptyHint ?? 'Пока нет ни одного персонажа.')}
        </div>
      ) : (
        <div className="char-list-grid">
          {list.map((c) => (
            <div className="char-list-item" key={c.id}>
              <button className={`char-list-card theme-${c.path}`} onClick={() => onOpen(c.id)}>
                {c.portrait && <img className="list-portrait" src={c.portrait} alt="" />}
                <span className="pill-badge">{PATH_LABELS[c.path]}</span>
                <h3>{c.characterName || 'Без имени'}</h3>
                <span className="meta">
                  {c.playerName || 'Игрок не указан'} · Ур. {c.level}
                </span>
              </button>
              {groupId && groups.length > 1 && (
                <select
                  className="group-move"
                  value={groupId}
                  title="Перенести в другую группу"
                  onChange={(e) => updateCharacter({ ...c, groupId: e.target.value })}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      📁 {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
