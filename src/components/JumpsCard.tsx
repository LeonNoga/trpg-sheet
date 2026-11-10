import { useState } from 'react';
import { ATHLETICS, computeJumps, formatNumber } from '../data/jumps';
import type { Character } from '../types';

/** Дальность и высота прыжков в метрах; по нажатию на строку показывается формула и подстановка значений персонажа. */
export function JumpsCard({ character }: { character: Character }) {
  const [open, setOpen] = useState<string | null>(null);
  const jumps = computeJumps(character);

  return (
    <div className="card">
      <h3 className="card-title">Прыжки</h3>
      <div className="jump-list">
        {jumps.map((jump) => (
          <div className="jump-item" key={jump.key}>
            <button
              type="button"
              className={`jump-row ${open === jump.key ? 'open' : ''}`}
              aria-expanded={open === jump.key}
              onClick={() => setOpen(open === jump.key ? null : jump.key)}
            >
              <span className="jump-label">{jump.label}</span>
              <span className="jump-value">{formatNumber(jump.meters)} м</span>
            </button>
            {open === jump.key && (
              <div className="jump-working">
                <div>
                  Формула: <b>{jump.formula}</b>
                </div>
                <div>
                  Расчёт: {jump.working} → <b>{formatNumber(jump.meters)} м</b> (до сотых)
                </div>
                <div className="muted">
                  Мод. Силы — с учётом бонусов снаряжения; Бонус Атлетики — степень навыка «{ATHLETICS}»: {character.skills[ATHLETICS] ?? 0}.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
