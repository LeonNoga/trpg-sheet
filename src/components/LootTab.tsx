import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { NumberField } from './NumberField';
import { SpeciesBonusesCard } from './TraitBlocks';
import { absorbFromPearl, fillPearl } from '../data/development';
import type { Character, DevelopmentPearl, TraitList } from '../types';

interface Props {
  character: Character;
  onPatch: (updater: (c: Character) => Character) => void;
}

/** Число с дробной частью (запятая или точка): не сбивается, пока пользователь печатает «1,». */
function DecimalField({ value, onChange, ...rest }: { value: number; onChange: (value: number) => void; 'aria-label'?: string }) {
  const [text, setText] = useState(String(value).replace('.', ','));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (Number(text.replace(',', '.')) !== value) setText(String(value).replace('.', ','));
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^\d*[.,]?\d*$/.test(raw)) return;
        setText(raw);
        const num = Number(raw.replace(',', '.'));
        if (raw !== '' && Number.isFinite(num)) onChange(num);
      }}
      onBlur={() => setText(String(value).replace('.', ','))}
      {...rest}
    />
  );
}

function PearlDialog({
  pearl,
  stock,
  onAbsorb,
  onFill,
  onClose,
}: {
  pearl: DevelopmentPearl;
  stock: number;
  onAbsorb: (amount: number) => void;
  onFill: (amount: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const amount = Math.floor(Number(text));
  const valid = text.trim() !== '' && Number.isFinite(amount) && amount > 0;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="card-title">Всосать?</h3>
        <p>
          В жемчужине: <b>{pearl.points}</b> · Ваши очки развития: <b>{stock}</b>
        </p>
        <div className="field" style={{ maxWidth: 220 }}>
          <label>Сколько очков</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={text}
            placeholder="Количество"
            autoFocus
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="quick-amounts">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setText(String(Math.max(0, pearl.points)))}>
            Всё из жемчужины ({Math.max(0, pearl.points)})
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setText(String(Math.max(0, stock)))}>
            Весь запас ({Math.max(0, stock)})
          </button>
        </div>
        <div className="item-actions">
          <button
            className="btn btn-primary"
            disabled={!valid || pearl.points <= 0}
            onClick={() => onAbsorb(amount)}
            title="Перенести очки из жемчужины в свои очки развития"
          >
            ⬇ Всосать из жемчужины
          </button>
          <button
            className="btn"
            disabled={!valid || stock <= 0}
            onClick={() => onFill(amount)}
            title="Перенести свои очки развития в жемчужину"
          >
            ⬆ Вложить в жемчужину
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

/** Вкладка «Лут»: очки развития, жемчужины и пыль развития, системное оружие и снаряжение. */
export function LootTab({ character, onPatch }: Props) {
  const [pearlId, setPearlId] = useState<string | null>(null);
  const itemNames = character.items.map((i) => i.name).filter(Boolean);
  const pearls = character.pearls ?? [];
  const dust = character.dust ?? [];
  const openPearl = pearls.find((p) => p.id === pearlId) ?? null;

  return (
    <div>
      <div className="card">
        <h3 className="card-title">Очки развития</h3>
        <div className="field" style={{ maxWidth: 200 }}>
          <NumberField
            value={character.developmentPoints}
            onChange={(v) => onPatch((c) => ({ ...c, developmentPoints: v }))}
            aria-label="Очки развития"
          />
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Жемчужины развития</h3>
        {pearls.length === 0 && <p className="muted">Жемчужин пока нет.</p>}
        {pearls.map((pearl) => (
          <div className="loot-row" key={pearl.id}>
            <button
              type="button"
              className="loot-name"
              onClick={() => setPearlId(pearl.id)}
              title="Всосать очки из жемчужины или вложить в неё свои"
            >
              🔮 Жемчужина развития
            </button>
            <label className="loot-value">
              <span className="muted">Очки развития</span>
              <NumberField
                value={pearl.points}
                min={0}
                onChange={(v) =>
                  onPatch((c) => ({ ...c, pearls: (c.pearls ?? []).map((p) => (p.id === pearl.id ? { ...p, points: Math.max(0, v) } : p)) }))
                }
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Удалить жемчужину"
              onClick={() => {
                if (confirm('Удалить жемчужину развития?')) onPatch((c) => ({ ...c, pearls: (c.pearls ?? []).filter((p) => p.id !== pearl.id) }));
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onPatch((c) => ({ ...c, pearls: [...(c.pearls ?? []), { id: uuid(), points: 0 }] }))}
        >
          + Добавить жемчужину
        </button>
      </div>

      <div className="card">
        <h3 className="card-title">Пыль развития</h3>
        {dust.length === 0 && <p className="muted">Пыли пока нет.</p>}
        {dust.map((entry) => (
          <div className="loot-row" key={entry.id}>
            <span className="loot-name static">✨ Пыль развития</span>
            <label className="loot-value">
              <span className="muted">Объём</span>
              <DecimalField
                value={entry.volume}
                aria-label="Объём пыли развития"
                onChange={(v) =>
                  onPatch((c) => ({ ...c, dust: (c.dust ?? []).map((d) => (d.id === entry.id ? { ...d, volume: Math.max(0, v) } : d)) }))
                }
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Удалить пыль"
              onClick={() => {
                if (confirm('Удалить пыль развития?')) onPatch((c) => ({ ...c, dust: (c.dust ?? []).filter((d) => d.id !== entry.id) }));
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onPatch((c) => ({ ...c, dust: [...(c.dust ?? []), { id: uuid(), volume: 0 }] }))}
        >
          + Добавить пыль
        </button>
      </div>

      <SpeciesBonusesCard
        title="Системное оружие"
        list={character.systemWeapons}
        pickFromNames={itemNames}
        onChange={(systemWeapons: TraitList) => onPatch((c) => ({ ...c, systemWeapons }))}
      />

      <SpeciesBonusesCard
        title="Системное снаряжение"
        list={character.systemGear}
        pickFromNames={itemNames}
        onChange={(systemGear: TraitList) => onPatch((c) => ({ ...c, systemGear }))}
      />

      {openPearl && (
        <PearlDialog
          pearl={openPearl}
          stock={character.developmentPoints}
          onAbsorb={(amount) => onPatch((c) => absorbFromPearl(c, openPearl.id, amount))}
          onFill={(amount) => onPatch((c) => fillPearl(c, openPearl.id, amount))}
          onClose={() => setPearlId(null)}
        />
      )}
    </div>
  );
}
