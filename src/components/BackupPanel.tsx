import { useRef, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { PasteImportButton } from './FileDialogs';
import { exportBackup, importBackupFromFile } from '../storage/exportImport';
import type { BackupPreview } from '../storage/exportImport';
import { ImportDialog } from './ImportDialog';
import type { ImportItem } from './ImportDialog';

export function BackupPanel() {
  const { characters, lootTray, groups, enemies, encounters, restoreBackup, updateMeta, meta, trash, restoreFromTrash } = useAppData();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupPreview | null>(null);

  async function handleRestore(file: File | undefined) {
    if (!file) return;
    try {
      setPending(await importBackupFromFile(file));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось прочитать файл резервной копии.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function confirmRestore() {
    if (!pending) return;
    restoreBackup(pending.characters, pending.lootTray, { groups: pending.groups, enemies: pending.enemies, encounters: pending.encounters });
    alert(`Восстановлено персонажей: ${pending.characters.length}.`);
    setPending(null);
  }

  // Показываем те записи, где что-то перезаписывается или переносится со старой схемы; остальные — одной строкой.
  const pendingItems: ImportItem[] = pending
    ? pending.characters
        .map((incoming) => ({
          incoming,
          existing: characters.find((c) => c.id === incoming.id),
          notes: pending.notes.get(incoming.id) ?? [],
        }))
        .filter((item) => item.existing || item.notes.length > 0)
    : [];

  return (
    <div className="card" style={{ marginTop: 24 }}>
      {pending && (
        <ImportDialog
          title="Восстановление из копии"
          summary={`В копии: персонажей — ${pending.characters.length}, предметов в трее лута — ${pending.lootTray.length}, противников — ${pending.enemies?.length ?? 0}, групп — ${pending.groups?.length ?? 0}. Персонажи и предметы с теми же id перезаписываются данными из копии, остальные остаются как есть.${
            pending.characters.length > pendingItems.length ? ` Новых персонажей без особенностей: ${pending.characters.length - pendingItems.length}.` : ''
          }`}
          items={pendingItems}
          onConfirm={confirmRestore}
          onCancel={() => setPending(null)}
        />
      )}
      <h3 className="card-title">Резервная копия</h3>
      <p className="muted">
        Данные хранятся только в браузере этого устройства: очистка данных сайта или смена телефона их удалит.
        Сохраните копию всех персонажей (включая мастер-вид и трей лута) одним файлом и держите её в надёжном месте.
      </p>
      <div className="top-actions" style={{ marginBottom: 0 }}>
        <button
          className="btn btn-primary"
          onClick={async () => {
            if (await exportBackup(characters, lootTray, { groups, enemies, encounters })) updateMeta({ lastBackupAt: Date.now() });
          }}
          disabled={characters.length === 0 && lootTray.length === 0 && enemies.length === 0}
        >
          Сохранить резервную копию ({characters.length})
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Восстановить из копии
        </button>
        <PasteImportButton onFile={handleRestore} label="Восстановить текстом" />
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => handleRestore(e.target.files?.[0])}
        />
      </div>
      {meta.lastBackupAt && (
        <p className="muted" style={{ marginBottom: 0 }}>
          Последняя копия: {new Date(meta.lastBackupAt).toLocaleString('ru-RU')}
        </p>
      )}

      {trash.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary>Недавно удалённые персонажи ({trash.length})</summary>
          <p className="muted">Хранятся 30 дней (не больше 5).</p>
          {trash.map((entry) => (
            <div className="history-row" key={entry.character.id}>
              <div>
                <b>{entry.character.characterName || 'Без имени'}</b>
                <div className="muted">
                  Ур. {entry.character.level} · удалён {new Date(entry.deletedAt).toLocaleDateString('ru-RU')}
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => restoreFromTrash(entry.character.id)}>
                Вернуть
              </button>
            </div>
          ))}
        </details>
      )}

      <p className="muted" style={{ marginBottom: 0, marginTop: 12, fontSize: 11 }}>
        Версия {__APP_VERSION__} · сборка {new Date(__BUILD_DATE__).toLocaleString('ru-RU')} · {__GIT_HASH__}
      </p>
    </div>
  );
}
