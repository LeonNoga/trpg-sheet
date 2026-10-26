import { useEffect, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { exportBackup } from '../storage/exportImport';

const DAY_MS = 24 * 3600 * 1000;
const REMIND_AFTER_DAYS = 14;
const SNOOZE_DAYS = 3;

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Полоса подсказок над содержимым: «добавьте на экран Домой» (на iPhone без этого Safari может стереть данные
 * сайта, которым давно не пользовались) и напоминание о резервной копии. Заодно просит у браузера постоянное хранилище.
 */
export function NoticeBar() {
  const { characters, lootTray, meta, updateMeta } = useAppData();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const storage = navigator.storage;
    if (!storage?.persist) return;
    (async () => {
      const already = await storage.persisted?.();
      setPersisted(already || (await storage.persist()));
    })().catch(() => setPersisted(false));
  }, []);

  if (characters.length === 0 && lootTray.length === 0) return null;

  const lastBackup = meta.lastBackupAt;
  const oldest = Math.min(...characters.map((c) => c.createdAt || now), now);
  const backupStale = lastBackup ? now - lastBackup > REMIND_AFTER_DAYS * DAY_MS : now - oldest > 3 * DAY_MS;
  const snoozed = (meta.backupSnoozeUntil ?? 0) > now;
  const showBackup = backupStale && !snoozed;
  const showInstall = isIos() && !isStandalone() && !meta.installHintDismissed;
  // На Android/ПК показываем предупреждение, только если браузер отказал в постоянном хранилище.
  const showUnpersisted = persisted === false && !isIos() && !meta.installHintDismissed;

  if (!showBackup && !showInstall && !showUnpersisted) return null;

  return (
    <div className="notice-bar">
      {showInstall && (
        <div className="notice">
          <span>
            Добавьте приложение на экран «Домой» (кнопка «Поделиться» → «На экран “Домой”»). В обычной вкладке Safari
            стирает данные сайтов, которыми не пользовались около недели, а установленное приложение — нет.
          </span>
          <button className="btn btn-sm" onClick={() => updateMeta({ installHintDismissed: true })}>
            Понятно
          </button>
        </div>
      )}
      {showUnpersisted && (
        <div className="notice">
          <span>
            Браузер не гарантирует сохранность данных: делайте резервные копии. Установка приложения (меню браузера →
            «Установить») обычно это исправляет.
          </span>
          <button className="btn btn-sm" onClick={() => updateMeta({ installHintDismissed: true })}>
            Понятно
          </button>
        </div>
      )}
      {showBackup && (
        <div className="notice">
          <span>
            {lastBackup
              ? `Резервной копии не было больше ${REMIND_AFTER_DAYS} дней.`
              : 'Вы ещё не делали резервную копию — данные хранятся только на этом устройстве.'}
          </span>
          <button
            className="btn btn-sm btn-primary"
            onClick={async () => {
              if (await exportBackup(characters, lootTray)) updateMeta({ lastBackupAt: Date.now() });
            }}
          >
            Сохранить копию
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => updateMeta({ backupSnoozeUntil: Date.now() + SNOOZE_DAYS * DAY_MS })}
          >
            Позже
          </button>
        </div>
      )}
    </div>
  );
}
