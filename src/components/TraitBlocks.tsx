import { useState } from 'react';
import type { TraitList } from '../types';

interface BonusesProps {
  title: string;
  list: TraitList;
  onChange: (list: TraitList) => void;
  /** Если задано — показывает выпадающий список для быстрого добавления строки по имени существующего предмета. */
  pickFromNames?: string[];
}

export function SpeciesBonusesCard({ title, list, onChange, pickFromNames }: BonusesProps) {
  const [pick, setPick] = useState('');

  function setLine(index: number, value: string) {
    const slots = [...list.slots];
    slots[index] = value;
    onChange({ ...list, slots });
  }

  function addLine(value = '') {
    onChange({ ...list, slots: [...list.slots, value] });
  }

  function removeLine(index: number) {
    onChange({ ...list, slots: list.slots.filter((_, i) => i !== index) });
  }

  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      {list.slots.map((line, i) => (
        <div className="row" key={i} style={{ marginBottom: 4 }}>
          <input value={line} onChange={(e) => setLine(i, e.target.value)} placeholder="Строка" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLine(i)}>
            ✕
          </button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={() => addLine()}>
          + строка
        </button>
        {pickFromNames && pickFromNames.length > 0 && (
          <>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Добавить из предметов...</option>
              {pickFromNames.map((name, i) => (
                <option key={i} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!pick}
              onClick={() => {
                addLine(pick);
                setPick('');
              }}
            >
              Добавить
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface DnaListsProps {
  titles: [string, string];
  lists: TraitList[];
  onChange: (lists: TraitList[]) => void;
}

export function DnaListsCard({ titles, lists, onChange }: DnaListsProps) {
  function updateList(id: string, updater: (l: TraitList) => TraitList) {
    onChange(lists.map((l) => (l.id === id ? updater(l) : l)));
  }

  return (
    <div className="card">
      <div className="row">
        {lists.map((list, idx) => (
          <div key={list.id} style={{ flex: 1, minWidth: 200 }}>
            <h4>{titles[idx]}</h4>
            {list.slots.map((slot, i) => (
              <div className="field" key={i} style={{ marginBottom: 4 }}>
                <input
                  value={slot}
                  onChange={(e) =>
                    updateList(list.id, (l) => {
                      const slots = [...l.slots];
                      slots[i] = e.target.value;
                      return { ...l, slots };
                    })
                  }
                  placeholder={`${i + 1})`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotesCard({ notes, onChange }: { notes: string; onChange: (notes: string) => void }) {
  return (
    <div className="card">
      <h3 className="card-title">Заметки</h3>
      <textarea
        className="notes-textarea"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Свободные заметки о персонаже..."
      />
    </div>
  );
}
