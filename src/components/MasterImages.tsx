import { useRef, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { useUndo } from '../state/useUndo';
import { saveImageFiles } from '../storage/saveFile';
import { fileToImageDataUrl } from '../utils/file';
import type { LootImage } from '../types';

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bytes = atob(body);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type });
}

const formatDate = (ms: number) => new Date(ms).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Картинки карточек в луте мастера: хранятся как есть и отправляются игрокам пачкой — игроки сами распознают их у себя. */
export function MasterImages() {
  const { masterImages, updateMasterImages } = useAppData();
  const { showUndo } = useUndo();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<LootImage | null>(null);

  const selectedImages = masterImages.filter((i) => selected.has(i.id));

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const added: LootImage[] = [];
      const now = Date.now();
      for (const file of Array.from(files)) {
        added.push({ id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ''), image: await fileToImageDataUrl(file), addedAt: now });
      }
      updateMasterImages([...added, ...masterImages]);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function sendSelected() {
    const files = selectedImages.map((img, index) => ({
      fileName: `${String(index + 1).padStart(2, '0')}-${(img.name || 'card').replace(/[\\/:*?"<>|]+/g, '_')}.png`,
      blob: dataUrlToBlob(img.image),
    }));
    await saveImageFiles(files);
  }

  function removeSelected() {
    if (!confirm(`Удалить выбранные картинки: ${selectedImages.length}?`)) return;
    const before = masterImages;
    updateMasterImages(masterImages.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
    showUndo(`Удалено картинок: ${selectedImages.length}`, () => updateMasterImages(before));
  }

  return (
    <div className="card">
      <h3 className="card-title">Картинки карточек</h3>
      <p className="muted">
        Фото карточек, которые вы раздаёте. Они хранятся здесь как есть, без распознавания: отправьте выбранные игрокам
        пачкой — каждый сам решает, кому что достаётся, и загружает их у себя на вкладке «Снаряжение» или умений, где они
        распознаются.
      </p>
      <div className="top-actions">
        <button className="btn btn-primary" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? 'Загружаем…' : '+ Загрузить картинки'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => void handleFiles(e.target.files)}
        />
        {masterImages.length > 1 && (
          <button className="btn btn-ghost" onClick={() => setSelected(new Set(masterImages.map((i) => i.id)))}>
            Выбрать все
          </button>
        )}
      </div>

      {selectedImages.length > 0 && (
        <div className="card batch-actions">
          <b>Выбрано: {selectedImages.length}</b>
          <div className="row">
            <button className="btn btn-sm btn-primary" onClick={() => void sendSelected()}>
              Отправить картинками
            </button>
            <button className="btn btn-sm btn-ghost" onClick={removeSelected}>
              Удалить
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>
              Снять выбор
            </button>
          </div>
        </div>
      )}

      {masterImages.length === 0 && <p className="muted">Картинок пока нет.</p>}
      <div className="image-grid">
        {masterImages.map((img) => (
          <div className={`image-tile ${selected.has(img.id) ? 'selected' : ''}`} key={img.id}>
            <label className="image-check">
              <input
                type="checkbox"
                checked={selected.has(img.id)}
                onChange={(e) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(img.id);
                    else next.delete(img.id);
                    return next;
                  })
                }
              />
            </label>
            <img src={img.image} alt={img.name} onClick={() => setPreview(img)} />
            <div className="muted image-caption" title={img.name}>
              {img.name || 'Без названия'} · {formatDate(img.addedAt)}
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <img src={preview.image} alt={preview.name} />
          <button type="button" className="btn lightbox-close" aria-label="Закрыть">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
