import type { ReactNode } from 'react';
import { PATH_SPECIES_FIELD_LABEL } from '../data/statsConfig';
import type { Character } from '../types';

/** Native details preserves form state and supports pointer, touch and keyboard. */
export function CharacterInfo({ character, children }: { character: Character; children: ReactNode }) {
  return (
    <details
      className="card character-info"
      onClick={(event) => {
        const target = event.target as HTMLElement;
        // Summary toggles natively; editing controls and hint contents must not close the card.
        if (target.closest('summary, input, select, textarea, button, label, a, [role="button"], [contenteditable="true"], .class-hint, .hover-card')) return;
        if (window.getSelection()?.toString()) return;
        event.currentTarget.open = !event.currentTarget.open;
      }}
    >
      <summary className="character-info-toggle" aria-label="Раскрыть или свернуть информацию о персонаже">
        {character.portrait && (
          <img className="character-info-portrait" src={character.portrait} alt="Портрет персонажа" draggable={false} />
        )}
        <span className="character-info-summary">
          <span><small>Имя персонажа</small><strong>{character.characterName || '—'}</strong></span>
          <span><small>{PATH_SPECIES_FIELD_LABEL[character.path]}</small><strong>{character.species || '—'}</strong></span>
          <span><small>Уровень</small><strong>{character.level}</strong></span>
        </span>
        <span className="character-info-expanded-title">Информация о персонаже</span>
        <span className="character-info-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="character-info-content">{children}</div>
    </details>
  );
}
