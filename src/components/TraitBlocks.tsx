import { useState } from 'react';
import { abilitySlotLimit, nextAbilitySlotStep } from '../data/statsConfig';
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
  level: number;
  onChange: (lists: TraitList[]) => void;
}

/** Строк в первом списке (видовые ДНК и т.п.) по умолчанию столько; дальше добавляются плюсиком. */
const BASE_FREE_LINES = 5;

export function DnaListsCard({ titles, lists, level, onChange }: DnaListsProps) {
  const limit = abilitySlotLimit(level);
  const nextStep = nextAbilitySlotStep(level);

  function updateList(id: string, updater: (l: TraitList) => TraitList) {
    onChange(lists.map((l) => (l.id === id ? updater(l) : l)));
  }

  function setSlot(id: string, index: number, value: string) {
    updateList(id, (l) => {
      const slots = Array.from({ length: Math.max(l.slots.length, index + 1) }, (_, i) => l.slots[i] ?? '');
      slots[index] = value;
      return { ...l, slots };
    });
  }

  return (
    <div className="card">
      <div className="row">
        {lists.map((list, idx) => {
          const limited = idx === 1;
          const lastFilled = list.slots.reduce((acc, s, i) => (s.trim() ? i : acc), -1);
          // Лимит: показываем ровно открытые слоты, но заполненные сверх лимита не прячем.
          const shown = limited
            ? Math.max(limit, lastFilled + 1)
            : Math.max(BASE_FREE_LINES, list.slots.length);
          const used = limited ? list.slots.filter((s) => s.trim()).length : 0;

          return (
            <div key={list.id} style={{ flex: 1, minWidth: 200 }}>
              <h4>{titles[idx]}</h4>
              {limited && (
                <p className={`slot-limit-note ${used > limit ? 'over' : ''}`}>
                  Слотов открыто: {limit}
                  {used > limit ? ` (занято ${used} — больше лимита)` : ''}
                  {nextStep ? ` · ${nextStep.slots} слотов с ${nextStep.level} уровня` : ' · максимум'}
                </p>
              )}
              {Array.from({ length: shown }, (_, i) => (
                <div
                  className={`field ${limited && i >= limit ? 'slot-over' : ''}`}
                  key={i}
                  style={{ marginBottom: 4 }}
                >
                  <div className="row">
                    <input
                      value={list.slots[i] ?? ''}
                      onChange={(e) => setSlot(list.id, i, e.target.value)}
                      placeholder={`${i + 1})`}
                    />
                    {!limited && i >= BASE_FREE_LINES && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title="Убрать строку"
                        onClick={() =>
                          updateList(list.id, (l) => ({ ...l, slots: l.slots.filter((_, j) => j !== i) }))
                        }
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!limited && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setSlot(list.id, shown, '')}
                  title="Добавить строку"
                >
                  + строка
                </button>
              )}
            </div>
          );
        })}
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
