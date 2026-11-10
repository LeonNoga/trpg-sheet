import { compareCharacters } from '../data/importCheck';
import type { Character } from '../types';

export interface ImportItem {
  incoming: Character;
  /** Персонаж с тем же id, который уже есть в приложении (будет заменён). */
  existing?: Character;
  /** Что изменится при переносе файла со старой схемы (первая строка — заголовок). */
  notes: string[];
}

interface Props {
  title: string;
  /** Короткое пояснение под заголовком (например, сколько всего персонажей в копии). */
  summary?: string;
  items: ImportItem[];
  /** «Сохранить как копию» — только для импорта одного персонажа, который уже есть в приложении. */
  allowCopy?: boolean;
  onConfirm: (choice: 'replace' | 'copy') => void;
  onCancel: () => void;
}

function ItemBlock({ item }: { item: ImportItem }) {
  const { incoming, existing, notes } = item;
  const comparison = existing ? compareCharacters(existing, incoming) : null;
  const [head, ...rest] = notes;

  return (
    <div style={{ marginBottom: 14 }}>
      <h4 style={{ margin: '4px 0' }}>
        {incoming.characterName || 'Без имени'}
        {existing ? ' — заменит существующего' : ' — новый персонаж'}
      </h4>
      {comparison && (
        <>
          {comparison.incomingOlder && (
            <p className="error-text">
              ⚠ Версия в файле старше той, что уже есть в приложении: замена вернёт карточку к более раннему состоянию.
              Текущая версия сохранится в «Истории версий».
            </p>
          )}
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                <th>Сейчас в приложении</th>
                <th>В файле</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.label} className={row.differs ? 'differs' : ''}>
                  <td>{row.label}</td>
                  <td>{row.current}</td>
                  <td>{row.incoming}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {head && (
        <>
          <p style={{ marginBottom: 2 }}>{head}</p>
          <ul className="import-notes">
            {rest.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Показывается перед импортом: что уже есть, что в файле, что изменится при переносе со старой версии. */
export function ImportDialog({ title, summary, items, allowCopy, onConfirm, onCancel }: Props) {
  const overwriting = items.some((i) => i.existing);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box changelog-box">
        <h3 className="card-title">{title}</h3>
        {summary && <p className="muted">{summary}</p>}
        {items.map((item) => (
          <ItemBlock key={item.incoming.id} item={item} />
        ))}
        <div className="item-actions">
          <button className="btn btn-primary" autoFocus onClick={() => onConfirm('replace')}>
            {overwriting ? 'Заменить' : 'Добавить'}
          </button>
          {allowCopy && (
            <button className="btn" onClick={() => onConfirm('copy')} title="Файл добавится отдельным персонажем, существующий останется как есть">
              Сохранить как копию
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
