// Сохранение/отправка JSON-файла. На телефонах «скачивание» через <a download> не работает во встроенных
// браузерах (Telegram, Instagram…): они просто открывают blob:-адрес как страницу с текстом, а отправка такой
// ссылки в чат или почту не имеет смысла. Поэтому на телефоне отдаём настоящий файл через системное меню
// «Поделиться» (там же «Сохранить в Файлы», Telegram, Почта…), а если оно недоступно — показываем текст для копирования.

export const EXPORT_FALLBACK_EVENT = 'trpg-export-fallback';

export interface ExportFallbackDetail {
  fileName: string;
  text: string;
}

function isTouchFirstDevice(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

function showFallback(fileName: string, text: string): void {
  window.dispatchEvent(new CustomEvent<ExportFallbackDetail>(EXPORT_FALLBACK_EVENT, { detail: { fileName, text } }));
}

function classicDownload(fileName: string, text: string): void {
  // charset обязателен: без него браузер может показать кириллицу кракозябрами.
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Возвращает false, если пользователь закрыл меню «Поделиться» (файл не сохранён). */
export async function saveJsonFile(fileName: string, payload: unknown): Promise<boolean> {
  const text = JSON.stringify(payload, null, 2);

  if (!isTouchFirstDevice()) {
    classicDownload(fileName, text);
    return true;
  }

  if (typeof navigator.share === 'function') {
    // Некоторые системы не принимают application/json в меню «Поделиться» — пробуем ещё как text/plain.
    for (const type of ['application/json', 'text/plain']) {
      const data: ShareData = { files: [new File([text], fileName, { type })], title: fileName };
      if (navigator.canShare && !navigator.canShare(data)) continue;
      try {
        await navigator.share(data);
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return false; // пользователь закрыл меню
      }
    }
  }

  showFallback(fileName, text);
  return true;
}
