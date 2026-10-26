import { useState } from 'react';
import type { ReactNode } from 'react';
import { abilitySlotLimit } from '../data/statsConfig';
import { SlotUseButton } from './SlotUseButton';
import type { SlotUseInfo } from './SlotUseButton';
import type { TraitList } from '../types';

interface BonusesProps {
  title: string;
  list: TraitList;
  onChange: (list: TraitList) => void;
  /** Если задано — показывает выпадающий список для быстрого добавления строки по имени существующего предмета. */
  pickFromNames?: string[];
  /** Неизменяемые строки-бонусы по правилам системы — показываются над свободными строками. */
  fixedLines?: string[];
  /** Дополнительные элементы управления под заголовком (например, выбор редкости класса). */
  extra?: ReactNode;
}

export function SpeciesBonusesCard({ title, list, onChange, pickFromNames, fixedLines = [], extra }: BonusesProps) {
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
      {extra}
      {fixedLines.map((line) => (
        <div className="fixed-bonus" key={line}>
          {line}
        </div>
      ))}
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
  /** Заголовки списков по порядку: видовые, обычные (с лимитом по уровню), артефактные. */
  titles: string[];
  lists: TraitList[];
  level: number;
  /** Названия умений/ДНК/технологий персонажа — можно выбрать в слот из списка. */
  abilityNames?: string[];
  /** Умения, пришедшие от артефактов: в списке артефактных слотов они предлагаются первыми. */
  artifactAbilityNames?: string[];
  /** Сведения о способности по названию из слота: если есть стоимость или откат — рядом со слотом появляется кнопка применения. */
  slotUse?: (name: string) => SlotUseInfo | null;
  onUseAbility?: (id: string) => void;
  onResetCooldown?: (id: string) => void;
  onChange: (lists: TraitList[]) => void;
}

/** Строк в первом списке (видовые ДНК и т.п.) по умолчанию столько; дальше добавляются плюсиком. */
const BASE_FREE_LINES = 5;

export function DnaListsCard({
  titles,
  lists,
  level,
  abilityNames = [],
  artifactAbilityNames = [],
  slotUse,
  onUseAbility,
  onResetCooldown,
  onChange,
}: DnaListsProps) {
  const limit = abilitySlotLimit(level);

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

  const datalistId = `ability-names-${lists[0]?.id ?? 'x'}`;
  const artifactDatalistId = `${datalistId}-artifact`;
  const artifactOptions = [...new Set([...artifactAbilityNames, ...abilityNames])];

  return (
    <div className="card">
      {abilityNames.length > 0 && (
        <datalist id={datalistId}>
          {[...new Set(abilityNames)].map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
      {artifactOptions.length > 0 && (
        <datalist id={artifactDatalistId}>
          {artifactOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
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
              {limited && used > limit && (
                <p className="slot-limit-note over">Занято слотов: {used} — больше, чем открыто на этом уровне.</p>
              )}
              {Array.from({ length: shown }, (_, i) => (
                <div
                  className={`field ${limited && i >= limit ? 'slot-over' : ''}`}
                  key={i}
                  style={{ marginBottom: 4 }}
                >
                  <div className="row slot-row">
                    <input
                      value={list.slots[i] ?? ''}
                      onChange={(e) => setSlot(list.id, i, e.target.value)}
                      placeholder={`${i + 1})`}
                      // Стрелка справа открывает названия с соседней вкладки; можно и просто вписать текст.
                      list={idx === 2 ? (artifactOptions.length > 0 ? artifactDatalistId : undefined) : abilityNames.length > 0 ? datalistId : undefined}
                      autoComplete="off"
                    />
                    {(() => {
                      const info = slotUse?.(list.slots[i] ?? '');
                      return info ? (
                        <SlotUseButton
                          info={info}
                          onUse={() => onUseAbility?.(info.id)}
                          onResetCooldown={() => onResetCooldown?.(info.id)}
                        />
                      ) : null;
                    })()}
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
