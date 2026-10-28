import { useEffect, useRef, useState } from 'react';
import { fileToImageDataUrl } from '../utils/file';
import { createOcrSession, itemsFromCard } from '../utils/ocrCards';
import type { OcrSession } from '../utils/ocrCards';
import type { EquipItem } from '../types';

interface Props {
  /** Вызывается для каждой распознанной карточки сразу после обработки (прогресс не теряется при остановке). */
  onCard: (item: EquipItem) => void;
  /** Уже имеющиеся записи — для поиска возможных дубликатов (то же название и тип). */
  getExisting?: () => EquipItem[];
  label?: string;
}

interface BulkState {
  running: boolean;
  done: number;
  total: number;
  current: string;
  items: number;
  abilities: number;
  problems: string[];
  review: number;
  duplicates: string[];
}

/** Пакетная загрузка фото карточек: OCR, определение предмет/умение и автозаполнение полей. */
export function BulkCardUpload({ onCard, getExisting, label = 'Загрузить карточки (OCR)' }: Props) {
  const [bulk, setBulk] = useState<BulkState | null>(null);
  const cancelRef = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const processRef = useRef<(files: File[]) => Promise<void>>(async () => {});
  const canReadClipboard =
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.read === 'function' &&
    !window.matchMedia('(pointer: coarse)').matches;

  /** Кнопка «Вставить из буфера» — для браузеров, где Ctrl+V не подходит (нужно разрешение на чтение буфера). */
  async function pasteFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) files.push(new File([await item.getType(type)], `буфер-${files.length + 1}.png`, { type }));
      }
      if (files.length === 0) alert('В буфере обмена нет картинки. Скопируйте скриншот карточки и повторите.');
      else await processFiles(files);
    } catch {
      alert('Не удалось прочитать буфер обмена. Нажмите Ctrl+V на этой странице — скриншот вставится так.');
    }
  }

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'));
    if (input.current) input.current.value = '';
    await processFiles(files);
  }

  async function processFiles(files: File[]) {
    if (files.length === 0 || bulk?.running) return;

    cancelRef.current = false;
    setBulk({ running: true, done: 0, total: files.length, current: '', items: 0, abilities: 0, problems: [], review: 0, duplicates: [] });

    let session: OcrSession | null = null;
    const added: EquipItem[] = [];
    try {
      session = await createOcrSession();
      for (const file of files) {
        if (cancelRef.current) break;
        setBulk((b) => b && { ...b, current: file.name });
        try {
          const image = await fileToImageDataUrl(file, 2400);
          const result = await session.recognize(image);
          // Обычно одна запись на карточку; артефакт даёт умение и (если есть свойства) ещё предмет.
          const cards = itemsFromCard(result, result.image ?? image, file.name.replace(/\.[^.]+$/, ''));
          // Возможные дубликаты: то же название и тип среди уже имеющихся и добавленных в этой пачке. Не пропускаем — только помечаем.
          const normalize = (name: string) => name.trim().toLowerCase();
          const known = [...(getExisting?.() ?? []), ...added];
          const dupNames: string[] = [];
          const marked = cards.map((card) => {
            const dup = known.some((k) => k.kind === card.kind && normalize(k.name) === normalize(card.name));
            if (!dup) return card;
            dupNames.push(card.name);
            return { ...card, review: [...(card.review ?? []), 'возможный дубликат'] };
          });
          marked.forEach((card) => {
            added.push(card);
            onCard(card);
          });
          setBulk(
            (b) =>
              b && {
                ...b,
                items: b.items + cards.filter((c) => c.kind === 'item').length,
                abilities: b.abilities + cards.filter((c) => c.kind === 'ability').length,
                review: b.review + marked.filter((c) => c.review && c.review.length > 0).length,
                duplicates: [...b.duplicates, ...dupNames],
                problems: result.text ? b.problems : [...b.problems, `${file.name}: текст не распознан, добавлено без данных`],
              },
          );
        } catch (err) {
          console.error(err);
          setBulk((b) => b && { ...b, problems: [...b.problems, `${file.name}: не удалось обработать файл`] });
        }
        setBulk((b) => b && { ...b, done: b.done + 1 });
      }
    } catch (err) {
      console.error(err);
      setBulk(
        (b) =>
          b && {
            ...b,
            problems: [...b.problems, 'Не удалось запустить распознавание (не удалось загрузить данные распознавания; при первом запуске нужен интернет).'],
          },
      );
    } finally {
      await session?.terminate();
      setBulk((b) => b && { ...b, running: false });
    }
  }

  // Ctrl+V со скриншотом: картинка из буфера обмена обрабатывается как загруженная карточка.
  useEffect(() => {
    processRef.current = processFiles;
  });
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;
      e.preventDefault();
      void processRef.current(images);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="top-actions" style={{ marginBottom: 0 }}>
        <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={bulk?.running}>
          {label}
        </button>
        {canReadClipboard && (
          <button className="btn" onClick={() => void pasteFromClipboard()} disabled={bulk?.running} title="Или просто нажмите Ctrl+V со скриншотом в буфере">
            Вставить из буфера
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {bulk && (
        <div className="budget-bar" style={{ flexDirection: 'column', alignItems: 'stretch', marginTop: 10 }}>
          {bulk.running ? (
            <>
              <strong>
                Распознаём карточки: {bulk.done} из {bulk.total}
              </strong>
              <span className="muted">{bulk.current}</span>
              <div>
                <button className="btn btn-sm" onClick={() => (cancelRef.current = true)}>
                  Остановить
                </button>
              </div>
            </>
          ) : (
            <>
              <strong>
                Готово: добавлено предметов — {bulk.items}, умений — {bulk.abilities}
                {bulk.done < bulk.total ? ` (остановлено на ${bulk.done} из ${bulk.total})` : ''}
              </strong>
              {bulk.review > 0 && (
                <span className="muted">
                  Помечено значком «⚠ Проверьте»: {bulk.review} — откройте их и убедитесь, что данные распознаны верно.
                </span>
              )}
              {bulk.duplicates.length > 0 && (
                <span className="error-text">Возможные дубликаты (добавлены с пометкой): {bulk.duplicates.join(', ')}</span>
              )}
              {bulk.problems.map((p) => (
                <span className="error-text" key={p}>
                  {p}
                </span>
              ))}
              <div>
                <button className="btn btn-sm btn-ghost" onClick={() => setBulk(null)}>
                  Скрыть
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
