import { useRef } from 'react';
import { useAppData } from '../state/AppDataContext';
import { PasteImportButton } from './FileDialogs';
import { exportBackup, importBackupFromFile } from '../storage/exportImport';

export function BackupPanel() {
  const { characters, lootTray, restoreBackup, updateMeta, meta, trash, restoreFromTrash } = useAppData();
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleRestore(file: File | undefined) {
    if (!file) return;
    try {
      const backup = await importBackupFromFile(file);
      const ok = confirm(
        `В копии: персонажей — ${backup.characters.length}, предметов в трее лута — ${backup.lootTray.length}.\n\n` +
          'Персонажи и предметы с теми же id будут перезаписаны данными из копии, остальные останутся как есть. Продолжить?',
      );
      if (!ok) return;
      restoreBackup(backup.characters, backup.lootTray);
      alert(`Восстановлено персонажей: ${backup.characters.length}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось прочитать файл резервной копии.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3 className="card-title">Резервная копия</h3>
      <p className="muted">
        Данные хранятся только в браузере этого устройства: очистка данных сайта или смена телефона их удалит.
        Сохраните копию всех персонажей (включая мастер-вид и трей лута) одним файлом и держите её в надёжном месте.
      </p>
      <div className="top-actions" style={{ marginBottom: 0 }}>
        <button
          className="btn btn-primary"
          onClick={async () => {
            if (await exportBackup(characters, lootTray)) updateMeta({ lastBackupAt: Date.now() });
          }}
          disabled={characters.length === 0 && lootTray.length === 0}
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
