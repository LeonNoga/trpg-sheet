import { ITEM_PATH_LABELS } from '../data/statsConfig';
import type { ItemPath } from '../types';

/**
 * Значок пути предмета/умения вместо слов: генетический — зелёный шприц, магический — синяя книжка,
 * технологический — белый шарик. Для общих предметов («без пути») значка нет.
 */
export function PathIcon({ path }: { path?: ItemPath }) {
  if (!path || path === 'none') return null;
  const label = `${ITEM_PATH_LABELS[path]} путь`;

  return (
    <svg className="path-icon" viewBox="0 0 20 20" width="18" height="18" role="img" aria-label={label}>
      <title>{label}</title>
      {path === 'genetic' && (
        <g transform="rotate(45 10 10)" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="4" width="6" height="10" rx="1.2" fill="#d6f2de" stroke="#2f9e57" strokeWidth="1.4" />
          <line x1="10" y1="14" x2="10" y2="18.5" stroke="#2f9e57" strokeWidth="1.4" />
          <line x1="5.5" y1="4" x2="14.5" y2="4" stroke="#2f9e57" strokeWidth="1.6" />
          <line x1="10" y1="4" x2="10" y2="1" stroke="#2f9e57" strokeWidth="1.6" />
          <line x1="8.4" y1="8" x2="11.6" y2="8" stroke="#2f9e57" strokeWidth="1" />
          <line x1="8.4" y1="10.5" x2="11.6" y2="10.5" stroke="#2f9e57" strokeWidth="1" />
        </g>
      )}
      {path === 'magic' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M4 3.5h9.5a1.5 1.5 0 0 1 1.5 1.5v11H5.5A1.5 1.5 0 0 1 4 14.5z" fill="#cfe0ff" stroke="#2f6fd0" strokeWidth="1.4" />
          <path d="M4 14.5A1.5 1.5 0 0 1 5.5 13H15" fill="none" stroke="#2f6fd0" strokeWidth="1.4" />
          <line x1="7" y1="6.5" x2="12" y2="6.5" stroke="#2f6fd0" strokeWidth="1.2" />
        </g>
      )}
      {path === 'tech' && (
        <g>
          <circle cx="10" cy="10" r="6.5" fill="#ffffff" stroke="#8d96a3" strokeWidth="1.4" />
          <circle cx="7.8" cy="7.8" r="1.8" fill="#e9edf2" />
        </g>
      )}
    </svg>
  );
}
