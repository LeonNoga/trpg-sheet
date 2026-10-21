import { useRef } from 'react';
import { fileToImageDataUrl } from '../utils/file';

interface Props {
  portrait?: string;
  onChange: (portrait: string | undefined) => void;
}

/** Портрет персонажа: загрузка или снимок с камеры, уменьшается до 512 px, чтобы не раздувать сохранение и экспорт. */
export function PortraitCard({ portrait, onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  async function handle(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = '';
    if (cameraInput.current) cameraInput.current.value = '';
    if (!file) return;
    try {
      onChange(await fileToImageDataUrl(file, 512));
    } catch {
      alert('Не удалось прочитать изображение.');
    }
  }

  return (
    <div className="card portrait-card">
      {portrait ? (
        <img className="portrait-img" src={portrait} alt="Портрет персонажа" />
      ) : (
        <div className="portrait-img portrait-empty">Портрета пока нет</div>
      )}
      <div>
        <h3 className="card-title">Портрет</h3>
        <div className="top-actions" style={{ marginBottom: 0 }}>
          <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
            {portrait ? 'Заменить' : 'Загрузить'}
          </button>
          <button className="btn btn-sm" onClick={() => cameraInput.current?.click()}>
            Сфотографировать
          </button>
          {portrait && (
            <button className="btn btn-sm btn-ghost" onClick={() => onChange(undefined)}>
              Убрать
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
