import { useEffect, useRef, useState } from 'react';
import { EXPORT_FALLBACK_EVENT, IMAGE_FALLBACK_EVENT } from '../storage/saveFile';
import type { ExportFallbackDetail, ImageFallbackDetail } from '../storage/saveFile';

async function copyText(text: string, area: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Запасной путь для встроенных браузеров без доступа к буферу.
    if (!area) return false;
    area.focus();
    area.select();
    return document.execCommand('copy');
  }
}

/** Показывается, когда системное меню «Поделиться» недоступно: даёт скопировать содержимое файла текстом. */
export function ExportFallbackDialog() {
  const [detail, setDetail] = useState<ExportFallbackDetail | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setCopied(null);
      setDetail((e as CustomEvent<ExportFallbackDetail>).detail);
    };
    window.addEventListener(EXPORT_FALLBACK_EVENT, handler);
    return () => window.removeEventListener(EXPORT_FALLBACK_EVENT, handler);
  }, []);

  if (!detail) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">Не получилось отправить файл</h3>
        <p className="muted">
          Этот браузер не умеет передавать файлы. Скопируйте текст и отправьте его себе (в «Избранное» Telegram, заметки,
          почту) — потом на нужном устройстве нажмите «Вставить текстом» рядом с кнопкой импорта. Либо откройте страницу
          в Safari/Chrome (меню «…» → «Открыть в Safari») и повторите — там файл отправляется напрямую.
        </p>
        <textarea ref={area} className="notes-textarea" readOnly value={detail.text} onFocus={(e) => e.target.select()} />
        <div className="item-actions">
          <button className="btn btn-primary" onClick={async () => setCopied(await copyText(detail.text, area.current))}>
            Скопировать всё
          </button>
          <button className="btn btn-ghost" onClick={() => setDetail(null)}>
            Закрыть
          </button>
        </div>
        {copied === true && <p className="muted">Скопировано — вставьте в сообщение или заметку.</p>}
        {copied === false && (
          <p className="error-text">Не удалось скопировать автоматически: выделите текст и скопируйте вручную.</p>
        )}
      </div>
    </div>
  );
}

/** Показывает готовую картинку, когда системное меню «Поделиться» недоступно: её можно сохранить долгим нажатием. */
export function ImageFallbackDialog() {
  const [detail, setDetail] = useState<ImageFallbackDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => setDetail((e as CustomEvent<ImageFallbackDetail>).detail);
    window.addEventListener(IMAGE_FALLBACK_EVENT, handler);
    return () => window.removeEventListener(IMAGE_FALLBACK_EVENT, handler);
  }, []);

  if (!detail) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">Карточка готова</h3>
        <p className="muted">
          Нажмите на картинку и удерживайте, затем выберите «Сохранить в Фото» (или «Скопировать»). Если меню нет — откройте
          приложение в Safari/Chrome.
        </p>
        <img src={detail.url} alt={detail.fileName} style={{ width: '100%', borderRadius: 8 }} />
        <div className="item-actions">
          <button
            className="btn btn-ghost"
            onClick={() => {
              URL.revokeObjectURL(detail.url);
              setDetail(null);
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

/** Импорт из вставленного текста — на случай, когда файл передан копированием (см. ExportFallbackDialog). */
export function PasteImportButton({ onFile, label = 'Вставить текстом' }: { onFile: (file: File) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  function close() {
    setOpen(false);
    setText('');
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-box">
            <h3 className="card-title">Импорт из текста</h3>
            <p className="muted">Вставьте сюда содержимое файла (JSON), которое вам прислали или вы скопировали.</p>
            <textarea
              className="notes-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="{ ... }"
              autoFocus
            />
            <div className="item-actions">
              <button
                className="btn btn-primary"
                disabled={!text.trim()}
                onClick={() => {
                  onFile(new File([text], 'pasted.json', { type: 'application/json' }));
                  close();
                }}
              >
                Импортировать
              </button>
              <button className="btn btn-ghost" onClick={close}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
