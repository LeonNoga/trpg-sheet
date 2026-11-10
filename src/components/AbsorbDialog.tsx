import { freeSlotIndex } from '../data/absorb';
import type { Character, EquipItem } from '../types';

interface Props {
  character: Character;
  item: EquipItem;
  /** Названия первых двух списков: видовые/классовые/модели и обычные. */
  titles: [string, string];
  onChoose: (target: 0 | 1) => void;
  onCancel: () => void;
}

/** Обычное умение при впитывании: в какой список его вписать (артефактные идут в свой список без вопроса). */
export function AbsorbDialog({ character, item, titles, onChoose, onCancel }: Props) {
  const options: { target: 0 | 1; title: string; note: string }[] = [
    { target: 0, title: titles[0], note: 'Умения этого списка стоят на 50% дешевле.' },
    { target: 1, title: titles[1], note: 'Число слотов зависит от уровня.' },
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">Впитать «{item.name || 'без названия'}»</h3>
        <p className="muted">Куда вписать умение?</p>
        <div className="absorb-options">
          {options.map(({ target, title, note }) => {
            const full = freeSlotIndex(character, target) < 0;
            return (
              <button key={target} type="button" className="btn absorb-option" disabled={full} onClick={() => onChoose(target)}>
                <b>{title}</b>
                <span className="muted">{full ? 'Свободных слотов нет' : note}</span>
              </button>
            );
          })}
        </div>
        <div className="item-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
