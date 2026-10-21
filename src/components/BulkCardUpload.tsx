import { useRef, useState } from 'react';
import { fileToImageDataUrl } from '../utils/file';
import { createOcrSession, itemsFromCard } from '../utils/ocrCards';
import type { OcrSession } from '../utils/ocrCards';
import type { EquipItem } from '../types';

interface Props {
  /** Вызывается для каждой распознанной карточки сразу после обработки (прогресс не теряется при остановке). */
  onCard: (item: EquipItem) => void;
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
}

/** Пакетная загрузка фото карточек: OCR, определение предмет/умение и автозаполнение полей. */
export function BulkCardUpload({ onCard, label = 'Загрузить карточки (OCR)' }: Props) {
  const [bulk, setBulk] = useState<BulkState | null>(null);
  const cancelRef = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'));
    if (input.current) input.current.value = '';
    if (camera.current) camera.current.value = '';
    if (files.length === 0) return;

    cancelRef.current = false;
    setBulk({ running: true, done: 0, total: files.length, current: '', items: 0, abilities: 0, problems: [] });

    let session: OcrSession | null = null;
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
          cards.forEach((card) => onCard(card));
          setBulk(
            (b) =>
              b && {
                ...b,
                items: b.items + cards.filter((c) => c.kind === 'item').length,
                abilities: b.abilities + cards.filter((c) => c.kind === 'ability').length,
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
            problems: [...b.problems, 'Не удалось запустить распознавание (при первом запуске нужен интернет для загрузки языка).'],
          },
      );
    } finally {
      await session?.terminate();
      setBulk((b) => b && { ...b, running: false });
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="top-actions" style={{ marginBottom: 0 }}>
        <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={bulk?.running}>
          {label}
        </button>
        <button className="btn" onClick={() => camera.current?.click()} disabled={bulk?.running}>
          Сфотографировать
        </button>
      </div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
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
