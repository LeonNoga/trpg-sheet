import type { AbilityCost, UsageState } from '../data/abilityUse';

interface Props {
  cost: AbilityCost;
  /** Как называется Ресурс Пути у этого персонажа: Дух / Энергия / Биоэнергия. */
  resourceLabel: string;
  /** Пояснение к цене (например, скидка от Интеллекта). */
  note?: string;
  usage?: UsageState;
  onUse: () => void;
  onClear: (which: 'cooldown' | 'daily') => void;
}

/** Компактная строка под способностью: «Применить» со списанием стоимости и отметки отката / «сегодня». */
export function AbilityUseBar({ cost, resourceLabel, note, usage, onUse, onClear }: Props) {
  const parts = [
    cost.resource ? `−${cost.resource} ${resourceLabel}` : '',
    cost.stamina ? `−${cost.stamina} Вын.` : '',
  ].filter(Boolean);

  return (
    <div className="use-bar">
      <button
        className="btn btn-sm"
        onClick={onUse}
        disabled={usage?.daily}
        title={usage?.daily ? 'Уже применено сегодня — снимите отметку или начните новый день' : 'Списать стоимость и отметить откат'}
      >
        Применить{parts.length ? ` · ${parts.join(', ')}` : ''}
      </button>
      {usage?.cooldown && (
        <button className="use-chip" onClick={() => onClear('cooldown')} title="Откат идёт. Нажмите, чтобы снять отметку">
          ⏳ откат ✕
        </button>
      )}
      {usage?.daily && (
        <button className="use-chip" onClick={() => onClear('daily')} title="Использовано сегодня. Нажмите, чтобы снять отметку">
          ✓ сегодня ✕
        </button>
      )}
      {note && <span className="muted use-note">{note}</span>}
    </div>
  );
}
