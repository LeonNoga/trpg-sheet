import { groupRows } from '../data/groupRows';

/** Пять фиксированных однострочных полей участников: перенос строки и лишние строки невозможны. */
export function GroupFields({ value, onChange }: { value: string; onChange: (index: number, text: string) => void }) {
  return (
    <fieldset className="group-fields">
      <legend>Группа</legend>
      {groupRows(value).map((text, index) => (
        <label className="group-member" key={index}>
          <span aria-hidden="true">{index + 1}</span>
          <input
            type="text"
            aria-label={`Участник группы ${index + 1}`}
            value={text}
            placeholder="Имя участника"
            onChange={(event) => onChange(index, event.target.value)}
          />
        </label>
      ))}
    </fieldset>
  );
}
