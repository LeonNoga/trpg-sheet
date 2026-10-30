import { groupRows } from '../data/groupRows';

export function GroupFields({ value, onChange }: { value: string; onChange: (index: number, text: string) => void }) {
  return (
    <fieldset className="group-fields">
      <legend>Группа</legend>
      {groupRows(value).map((text, index) => (
        <label className="group-member" key={index}>
          <span aria-hidden="true">{index + 1}</span>
          <textarea
            rows={Math.max(1, text.split('\n').length)}
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
