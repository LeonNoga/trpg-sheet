import { useState } from 'react';
import { useAppData } from '../state/useAppData';
import { useUndo } from '../state/useUndo';
import { useGroupEncounter } from '../hooks/useGroupEncounter';
import { AmountAdjust } from './AmountAdjust';
import { NumberField } from './NumberField';
import { addParticipant, cloneEnemy, createBlankEnemy, inGroup } from '../data/gm';
import { STAT_LABELS, STAT_ORDER } from '../data/statsConfig';
import { fileToImageDataUrl } from '../utils/file';
import type { Enemy } from '../types';

const KIND_SUGGESTIONS = ['Зомби', 'Монстр', 'Босс', 'NPC', 'Союзник', 'Животное'];

const NUMBER_FIELDS: { key: 'defense' | 'speed' | 'passivePerception' | 'initiative' | 'resistance'; label: string; short: string }[] = [
  { key: 'defense', label: 'Показатель защиты', short: 'ПЗ' },
  { key: 'speed', label: 'Скорость', short: 'С' },
  { key: 'passivePerception', label: 'Пассивное восприятие', short: 'ПВ' },
  { key: 'initiative', label: 'Инициатива', short: 'И' },
  { key: 'resistance', label: 'Сложность сопротивления', short: 'СС' },
];

function EnemyEditor({ enemy, onSave, onCancel }: { enemy: Enemy; onSave: (enemy: Enemy) => void; onCancel: () => void }) {
  const { groups } = useAppData();
  const [draft, setDraft] = useState<Enemy>(enemy);
  const set = <K extends keyof Enemy>(key: K, value: Enemy[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function handleImage(file: File | undefined) {
    if (!file) return;
    set('image', await fileToImageDataUrl(file, 1000));
  }

  return (
    <div className="card enemy-editor">
      <h3 className="card-title">{enemy.name ? 'Изменить противника' : 'Новый противник'}</h3>
      <div className="row">
        <div className="field" style={{ flex: 2, minWidth: 180 }}>
          <label>Название</label>
          <input value={draft.name} autoFocus placeholder="Гнилой зомби" onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>Тип</label>
          <input value={draft.kind} list="enemy-kinds" placeholder="Зомби, монстр, NPC…" onChange={(e) => set('kind', e.target.value)} />
          <datalist id="enemy-kinds">
            {KIND_SUGGESTIONS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        <div className="field" style={{ maxWidth: 100 }}>
          <label>Уровень</label>
          <NumberField value={draft.level ?? 0} min={0} onChange={(v) => set('level', v || undefined)} />
        </div>
      </div>

      <div className="row">
        <div className="field" style={{ maxWidth: 110 }}>
          <label>Здоровье (макс.)</label>
          <NumberField
            value={draft.hpMax}
            min={1}
            onChange={(v) => setDraft((d) => ({ ...d, hpMax: Math.max(1, v), hp: d.hp === d.hpMax ? Math.max(1, v) : Math.min(d.hp, Math.max(1, v)) }))}
          />
        </div>
        {NUMBER_FIELDS.map(({ key, label, short }) => (
          <div className="field" style={{ maxWidth: 90 }} key={key}>
            <label title={label}>{short}</label>
            <NumberField value={draft[key]} onChange={(v) => set(key, v)} aria-label={label} />
          </div>
        ))}
      </div>

      <details className="field">
        <summary>Основные характеристики (необязательно)</summary>
        <div className="enemy-stats-grid">
          {STAT_ORDER.map((key) => (
            <label key={key} className="field">
              <span>{STAT_LABELS[key]}</span>
              <input
                type="number"
                inputMode="numeric"
                value={draft.stats[key] ?? ''}
                placeholder="—"
                onChange={(e) => {
                  const { [key]: _drop, ...rest } = draft.stats;
                  set('stats', e.target.value === '' ? rest : { ...rest, [key]: Number(e.target.value) });
                }}
              />
            </label>
          ))}
        </div>
      </details>

      <div className="field">
        <label>Атаки и умения</label>
        <textarea
          className="notes-textarea"
          style={{ minHeight: 90 }}
          value={draft.attacks}
          placeholder="Укус: +5, 1к6+2 урона. Заражение при провале СС 12…"
          onChange={(e) => set('attacks', e.target.value)}
        />
      </div>
      <div className="field">
        <label>Описание</label>
        <textarea
          className="notes-textarea"
          style={{ minHeight: 90 }}
          value={draft.description}
          placeholder="Как выглядит, как себя ведёт, что с него выпадает…"
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="field">
        <label>Свои поля</label>
        {draft.fields.map((f) => (
          <div className="row" key={f.id} style={{ marginBottom: 4 }}>
            <input
              style={{ maxWidth: 160 }}
              value={f.label}
              placeholder="Название (Слабость)"
              onChange={(e) => set('fields', draft.fields.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
            />
            <input
              value={f.value}
              placeholder="Значение"
              onChange={(e) => set('fields', draft.fields.map((x) => (x.id === f.id ? { ...x, value: e.target.value } : x)))}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('fields', draft.fields.filter((x) => x.id !== f.id))}>
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => set('fields', [...draft.fields, { id: crypto.randomUUID(), label: '', value: '' }])}
        >
          + поле
        </button>
      </div>

      <div className="field">
        <label>Картинка карточки или портрет</label>
        <div className="row">
          <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} />
          {draft.image && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => set('image', undefined)}>
              Убрать
            </button>
          )}
        </div>
        {draft.image && <img src={draft.image} alt="" className="item-image" style={{ maxHeight: 180 }} />}
      </div>

      {groups.length > 1 && (
        <div className="field" style={{ maxWidth: 260 }}>
          <label>Группа</label>
          <select value={draft.groupId ?? groups[0].id} onChange={(e) => set('groupId', e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="item-actions">
        <button className="btn btn-primary" disabled={!draft.name.trim()} onClick={() => onSave({ ...draft, updatedAt: Date.now() })}>
          Сохранить
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

function EnemyCard({
  enemy,
  inCombat,
  onChangeHp,
  onEdit,
  onClone,
  onToCombat,
  onDelete,
}: {
  enemy: Enemy;
  inCombat: boolean;
  onChangeHp: (hp: number) => void;
  onEdit: () => void;
  onClone: () => void;
  onToCombat: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const down = enemy.hp <= 0;
  const fill = Math.max(0, Math.min(100, (enemy.hp / Math.max(1, enemy.hpMax)) * 100));
  const stats = STAT_ORDER.filter((k) => enemy.stats[k] !== undefined);

  return (
    <div className={`card enemy-card ${down ? 'down' : ''}`}>
      <div className="enemy-head" onClick={() => setOpen((o) => !o)}>
        {enemy.image && <img className="enemy-thumb" src={enemy.image} alt="" />}
        <div className="enemy-title">
          <h4>
            {down ? '💀 ' : ''}
            {enemy.name}
          </h4>
          <div className="muted">
            {[enemy.kind, enemy.level ? `ур. ${enemy.level}` : ''].filter(Boolean).join(' · ') || 'Противник'}
          </div>
          <div className="enemy-numbers">
            {NUMBER_FIELDS.map(({ key, short, label }) => (
              <span key={key} title={label}>
                {short} <b>{enemy[key]}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="enemy-hp" onClick={(e) => e.stopPropagation()}>
          <div className="enemy-hp-bar" style={{ ['--fill' as string]: `${fill}%` }}>
            <span>
              ❤ {enemy.hp} / {enemy.hpMax}
            </span>
          </div>
          <AmountAdjust current={enemy.hp} max={enemy.hpMax} onChange={onChangeHp} />
        </div>
      </div>

      {open && (
        <div className="enemy-body">
          {enemy.image && <img className="enemy-image" src={enemy.image} alt={enemy.name} />}
          {stats.length > 0 && (
            <div className="enemy-numbers" style={{ marginBottom: 8 }}>
              {stats.map((k) => (
                <span key={k}>
                  {STAT_LABELS[k]} <b>{enemy.stats[k]}</b>
                </span>
              ))}
            </div>
          )}
          {enemy.attacks && (
            <p className="item-effect">
              <b>Атаки и умения:</b>
              <br />
              {enemy.attacks}
            </p>
          )}
          {enemy.description && <p className="item-effect">{enemy.description}</p>}
          {enemy.fields.filter((f) => f.label || f.value).map((f) => (
            <p className="item-effect" key={f.id}>
              <b>{f.label || 'Поле'}:</b> {f.value}
            </p>
          ))}
          <div className="item-actions">
            <button className="btn btn-sm" onClick={onEdit}>
              Изменить
            </button>
            <button className="btn btn-sm" onClick={onClone}>
              Копии…
            </button>
            <button className="btn btn-sm" disabled={inCombat} onClick={onToCombat}>
              {inCombat ? 'Уже в бою' : '⚔ В бой'}
            </button>
            <button className="btn btn-sm btn-danger" onClick={onDelete}>
              Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Противники группы: заводятся с основными числами, описанием и картинкой; здоровье меняется прямо в карточке. */
export function EnemiesTab() {
  const { enemies, updateEnemies, groups, activeGroupId } = useAppData();
  const { showUndo } = useUndo();
  const [encounter, saveEncounter] = useGroupEncounter(activeGroupId);
  const [editing, setEditing] = useState<Enemy | null>(null);
  const [query, setQuery] = useState('');

  const mine = enemies.filter((e) => inGroup(e, activeGroupId, groups));
  const q = query.trim().toLowerCase();
  const shown = q ? mine.filter((e) => `${e.name} ${e.kind} ${e.description}`.toLowerCase().includes(q)) : mine;

  function save(enemy: Enemy) {
    const exists = enemies.some((e) => e.id === enemy.id);
    updateEnemies(exists ? enemies.map((e) => (e.id === enemy.id ? enemy : e)) : [...enemies, enemy]);
    setEditing(null);
  }

  function remove(enemy: Enemy) {
    const index = enemies.findIndex((e) => e.id === enemy.id);
    updateEnemies(enemies.filter((e) => e.id !== enemy.id));
    showUndo(`Удалён противник «${enemy.name}»`, () => {
      const next = [...enemies];
      next.splice(Math.min(index, next.length), 0, enemy);
      updateEnemies(next);
    });
  }

  function clone(enemy: Enemy) {
    const answer = prompt(`Сколько копий «${enemy.name}» создать? (с полным здоровьем, имена с номерами)`, '3');
    const count = Math.floor(Number(answer));
    if (!answer || !Number.isFinite(count) || count < 1) return;
    updateEnemies([...enemies, ...cloneEnemy(enemy, Math.min(count, 30), mine)]);
  }

  function toCombat(enemy: Enemy) {
    saveEncounter(addParticipant(encounter, { kind: 'enemy', refId: enemy.id, initiative: enemy.initiative }));
  }

  return (
    <div>
      {editing ? (
        <EnemyEditor enemy={editing} onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <div className="top-actions">
          <button className="btn btn-primary" onClick={() => setEditing(createBlankEnemy(activeGroupId))}>
            + Противник
          </button>
          {mine.length > 4 && (
            <input
              className="tray-search"
              style={{ maxWidth: 260 }}
              placeholder="Поиск по названию, типу, описанию"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </div>
      )}

      {mine.length === 0 && !editing && (
        <div className="empty-state">
          Противников этой группы пока нет. Заведите зомби, монстра или NPC: название, основные числа, описание и картинка.
          Потом любого можно размножить («Копии…») и отправить в бой.
        </div>
      )}

      {shown.map((enemy) => (
        <EnemyCard
          key={enemy.id}
          enemy={enemy}
          inCombat={encounter.participants.some((p) => p.kind === 'enemy' && p.refId === enemy.id)}
          onChangeHp={(hp) => updateEnemies(enemies.map((e) => (e.id === enemy.id ? { ...e, hp, updatedAt: Date.now() } : e)))}
          onEdit={() => setEditing(enemy)}
          onClone={() => clone(enemy)}
          onToCombat={() => toCombat(enemy)}
          onDelete={() => remove(enemy)}
        />
      ))}
    </div>
  );
}
