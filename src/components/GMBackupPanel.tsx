import { useRef, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { PasteImportButton } from './FileDialogs';
import { buildGroupBackup } from '../data/gm';
import { exportBackup, exportGroupBackup, importBackupFromFile, readGroupBackup } from '../storage/exportImport';
import type { BackupPreview } from '../storage/exportImport';
import type { GroupBackupFile } from '../types';

const formatStamp = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function GroupImportDialog({
  file,
  exists,
  onConfirm,
  onCancel,
}: {
  file: GroupBackupFile;
  exists: boolean;
  onConfirm: (mode: 'replace' | 'copy') => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">Импорт группы «{file.group.name}»</h3>
        <p className="muted">Копия от {formatStamp(file.exportedAt)}.</p>
        <p>
          В файле: игроков — <b>{file.members.length}</b>, противников — <b>{file.enemies.length}</b>, подгрупп противников —{' '}
          <b>{file.enemyGroups.length}</b>, лута — <b>{file.loot.length}</b>, персонажей мастера — <b>{file.characters.length}</b>, записей
          журнала — <b>{file.log.length}</b>
          {file.encounter?.active ? ', бой идёт' : ''}.
        </p>
        {exists ? (
          <p className="error-text">
            Группа с таким id уже есть в приложении. «Заменить» перезапишет её данные из файла (текущее состояние сохранится в
            «Истории группы»); «Добавить как новую» создаст отдельную группу и ничего не тронет.
          </p>
        ) : (
          <p className="muted">Такой группы в приложении ещё нет — она будет добавлена целиком.</p>
        )}
        <div className="item-actions">
          <button className="btn btn-primary" autoFocus onClick={() => onConfirm('replace')}>
            {exists ? 'Заменить данные группы' : 'Добавить группу'}
          </button>
          {exists && (
            <button className="btn" onClick={() => onConfirm('copy')}>
              Добавить как новую
            </button>
          )}
          <button className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

/** Резервные копии мастер-вида: одной группы (для переноса группы на другое устройство) и общая — всё, что есть у мастера. */
export function GMBackupPanel() {
  const {
    groups,
    activeGroupId,
    characters,
    lootTray,
    enemies,
    encounters,
    members,
    enemyGroups,
    masterLoot,
    masterImages,
    groupLogs,
    meta,
    updateMeta,
    restoreBackup,
    importGroupBackup,
  } = useAppData();
  const group = groups.find((g) => g.id === activeGroupId);
  const groupInput = useRef<HTMLInputElement>(null);
  const masterInput = useRef<HTMLInputElement>(null);
  const [pendingGroup, setPendingGroup] = useState<GroupBackupFile | null>(null);
  const [pendingMaster, setPendingMaster] = useState<BackupPreview | null>(null);

  const masterCharacters = characters.filter((c) => c.roster === 'gm-master');

  async function saveGroup() {
    if (!group) return;
    await exportGroupBackup(
      buildGroupBackup(group, groups, { members, enemies, enemyGroups, encounters, loot: lootTray, characters, log: groupLogs[group.id] ?? [] }),
    );
  }

  async function saveMaster() {
    const ok = await exportBackup(
      masterCharacters,
      lootTray,
      { groups, enemies, encounters, members, enemyGroups, masterLoot, masterImages, groupLogs },
      'master-backup',
    );
    if (ok) updateMeta({ lastMasterBackupAt: Date.now() });
  }

  async function readGroup(file: File | undefined) {
    if (groupInput.current) groupInput.current.value = '';
    if (!file) return;
    try {
      setPendingGroup(await readGroupBackup(file));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось прочитать файл.');
    }
  }

  async function readMaster(file: File | undefined) {
    if (masterInput.current) masterInput.current.value = '';
    if (!file) return;
    try {
      setPendingMaster(await importBackupFromFile(file));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось прочитать файл.');
    }
  }

  function confirmMaster() {
    if (!pendingMaster) return;
    // Из общей копии берём только то, что относится к мастер-виду: личные карточки игрока не трогаем.
    const gmCharacters = pendingMaster.characters.filter((c) => c.roster === 'gm-master');
    restoreBackup(gmCharacters, pendingMaster.lootTray, {
      groups: pendingMaster.groups,
      enemies: pendingMaster.enemies,
      encounters: pendingMaster.encounters,
      members: pendingMaster.members,
      enemyGroups: pendingMaster.enemyGroups,
      masterLoot: pendingMaster.masterLoot,
      masterImages: pendingMaster.masterImages,
      groupLogs: pendingMaster.groupLogs,
    });
    alert('Мастер-вид восстановлен.');
    setPendingMaster(null);
  }

  return (
    <details className="card gm-backup">
      <summary>
        💾 Резервные копии мастер-вида
        {meta.lastMasterBackupAt && <span className="muted"> · последняя общая: {new Date(meta.lastMasterBackupAt).toLocaleString('ru-RU')}</span>}
      </summary>
      <p className="muted">
        Данные хранятся только в браузере этого устройства. <b>Копия группы</b> — всё, что относится к выбранной группе (игроки,
        противники, бой, лут, журнал), её удобно переносить на другое устройство или делиться ею. <b>Общая копия</b> — весь мастер-вид:
        все группы, лут мастера и картинки.
      </p>
      <div className="top-actions">
        <button className="btn btn-primary" disabled={!group} onClick={() => void saveGroup()}>
          Копия группы «{group?.name ?? ''}»
        </button>
        <button className="btn" onClick={() => groupInput.current?.click()}>
          Импорт группы
        </button>
        <PasteImportButton onFile={readGroup} label="Импорт группы текстом" />
        <input ref={groupInput} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => readGroup(e.target.files?.[0])} />
      </div>
      <div className="top-actions" style={{ marginBottom: 0 }}>
        <button className="btn btn-primary" onClick={() => void saveMaster()}>
          Общая копия мастер-вида
        </button>
        <button className="btn" onClick={() => masterInput.current?.click()}>
          Восстановить мастер-вид
        </button>
        <PasteImportButton onFile={readMaster} label="Восстановить текстом" />
        <input ref={masterInput} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => readMaster(e.target.files?.[0])} />
      </div>

      {pendingGroup && (
        <GroupImportDialog
          file={pendingGroup}
          exists={groups.some((g) => g.id === pendingGroup.group.id)}
          onConfirm={(mode) => {
            importGroupBackup(pendingGroup, mode);
            setPendingGroup(null);
          }}
          onCancel={() => setPendingGroup(null)}
        />
      )}

      {pendingMaster && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-box">
            <h3 className="card-title">Восстановление мастер-вида</h3>
            <p>
              В копии: групп — <b>{pendingMaster.groups?.length ?? 0}</b>, игроков — <b>{pendingMaster.members?.length ?? 0}</b>, противников —{' '}
              <b>{pendingMaster.enemies?.length ?? 0}</b>, лута групп — <b>{pendingMaster.lootTray.length}</b>, лута мастера —{' '}
              <b>{pendingMaster.masterLoot?.length ?? 0}</b>, картинок — <b>{pendingMaster.masterImages?.length ?? 0}</b>, персонажей мастера —{' '}
              <b>{pendingMaster.characters.filter((c) => c.roster === 'gm-master').length}</b>.
            </p>
            <p className="muted">
              Записи с теми же id перезаписываются данными из копии, остальные остаются как есть. Ваши личные карточки персонажей
              не затрагиваются.
            </p>
            <div className="item-actions">
              <button className="btn btn-primary" autoFocus onClick={confirmMaster}>
                Восстановить
              </button>
              <button className="btn btn-ghost" onClick={() => setPendingMaster(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </details>
  );
}
