import { ALL_BONUS_KEYS, bonusLabel } from '../data/statsConfig';
import { NumberField } from './NumberField';
import type { BonusKey, Path } from '../types';

type Bonuses = Partial<Record<BonusKey, number>>;

interface Props {
  value: Bonuses;
  onChange: (value: Bonuses) => void;
  path?: Path;
  addLabel?: string;
}

/** Список «характеристика / показатель — значение» (со знаком: бонус или штраф) с добавлением и удалением строк. */
export function BonusEditor({ value, onChange, path, addLabel = '+ бонус' }: Props) {
  const entries = Object.entries(value) as [BonusKey, number][];

  function add() {
    const used = new Set(entries.map(([k]) => k));
    const next = ALL_BONUS_KEYS.find((k) => !used.has(k)) ?? ALL_BONUS_KEYS[0];
    onChange({ ...value, [next]: 1 });
  }

  function changeKey(oldKey: BonusKey, newKey: BonusKey) {
    const { [oldKey]: v, ...rest } = value;
    onChange({ ...rest, [newKey]: v ?? 0 });
  }

  function remove(key: BonusKey) {
    const { [key]: _removed, ...rest } = value;
    onChange(rest);
  }

  return (
    <div>
      {entries.map(([key, amount]) => (
        <div className="row" key={key} style={{ marginBottom: 4 }}>
          <select value={key} onChange={(e) => changeKey(key, e.target.value as BonusKey)}>
            {ALL_BONUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {bonusLabel(k, path)}
              </option>
            ))}
          </select>
          <NumberField style={{ maxWidth: 90 }} value={amount} onChange={(v) => onChange({ ...value, [key]: v })} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(key)}>
            Убрать
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={add}>
        {addLabel}
      </button>
    </div>
  );
}
