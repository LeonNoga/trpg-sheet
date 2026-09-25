import type { TraitList } from '../types';

interface BonusesProps {
  list: TraitList;
  onChange: (list: TraitList) => void;
}

export function SpeciesBonusesCard({ list, onChange }: BonusesProps) {
  function setTitle(title: string) {
    onChange({ ...list, title });
  }

  function setLine(index: number, value: string) {
    const slots = [...list.slots];
    slots[index] = value;
    onChange({ ...list, slots });
  }

  function addLine() {
    onChange({ ...list, slots: [...list.slots, ''] });
  }

  function removeLine(index: number) {
    onChange({ ...list, slots: list.slots.filter((_, i) => i !== index) });
  }

  return (
    <div className="card">
      <input
        className="card-title-input"
        value={list.title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название блока"
      />
      {list.slots.map((line, i) => (
        <div className="row" key={i} style={{ marginBottom: 4 }}>
          <input value={line} onChange={(e) => setLine(i, e.target.value)} placeholder={`Бонус ${i + 1}`} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLine(i)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={addLine}>
        + строка
      </button>
    </div>
  );
}

interface DnaListsProps {
  lists: TraitList[];
  onChange: (lists: TraitList[]) => void;
}

export function DnaListsCard({ lists, onChange }: DnaListsProps) {
  function updateList(id: string, updater: (l: TraitList) => TraitList) {
    onChange(lists.map((l) => (l.id === id ? updater(l) : l)));
  }

  return (
    <div className="card">
      <div className="row">
        {lists.map((list) => (
          <div key={list.id} style={{ flex: 1, minWidth: 200 }}>
            <input
              className="card-title-input"
              value={list.title}
              onChange={(e) => updateList(list.id, (l) => ({ ...l, title: e.target.value }))}
              placeholder="Название списка"
            />
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
