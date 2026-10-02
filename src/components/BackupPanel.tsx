import { useRef } from 'react';
import { useAppData } from '../state/AppDataContext';
import { exportBackup, importBackupFromFile } from '../storage/exportImport';

export function BackupPanel() {
  const { characters, lootTray, restoreBackup } = useAppData();
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
        <button className="btn btn-primary" onClick={() => exportBackup(characters, lootTray)} disabled={characters.length === 0 && lootTray.length === 0}>
          Сохранить резервную копию ({characters.length})
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Восстановить из копии
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => handleRestore(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
