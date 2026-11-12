import { useMemo, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { useUndo } from '../state/useUndo';
import { useGroupEncounter } from '../hooks/useGroupEncounter';
import { AmountAdjust } from './AmountAdjust';
import { NumberField } from './NumberField';
import { ENEMY_KINDS, addParticipant, cloneEnemy, createBlankEnemy, createEnemyGroup, inGroup } from '../data/gm';
import { STAT_LABELS, STAT_ORDER } from '../data/statsConfig';
import { fileToImageDataUrl } from '../utils/file';
import type { Encounter, Enemy, EnemyGroup } from '../types';

const NUMBER_FIELDS: { key: 'defense' | 'speed' | 'passivePerception' | 'initiative' | 'resistance'; label: string; short: string }[] = [
  { key: 'defense', label: 'Показатель защиты', short: 'ПЗ' },
  { key: 'speed', label: 'Скорость', short: 'С' },
  { key: 'passivePerception', label: 'Пассивное восприятие', short: 'ПВ' },
  { key: 'initiative', label: 'Инициатива', short: 'И' },
  { key: 'resistance', label: 'Сложность сопротивления', short: 'СС' },
];

function EnemyEditor({ enemy, enemyGroups, onSave, onCancel }: { enemy: Enemy; enemyGroups: EnemyGroup[]; onSave: (enemy: Enemy) => void; onCancel: () => void }) {
  const { groups } = useAppData();
  const [draft, setDraft] = useState<Enemy>(enemy);
  const set = <K extends keyof Enemy>(key: K, value: Enemy[K]) => setDraft((d) => ({ ...d, [key]: value }));
  // Типы выбираются из списка; прежнее свободное значение остаётся доступным.
  const kinds = draft.kind && !ENEMY_KINDS.includes(draft.kind) ? [...ENEMY_KINDS, draft.kind] : ENEMY_KINDS;

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
          <select value={draft.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="">— не указан —</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
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
        <button type="button" className="btn btn-sm" onClick={() => set('fields', [...draft.fields, { id: crypto.randomUUID(), label: '', value: '' }])}>
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

      <div className="row">
        {enemyGroups.length > 0 && (
          <div className="field" style={{ maxWidth: 260 }}>
            <label>Подгруппа противников</label>
            <select value={draft.enemyGroupId ?? ''} onChange={(e) => set('enemyGroupId', e.target.value || undefined)}>
              <option value="">— без подгруппы —</option>
              {enemyGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {groups.length > 1 && (
          <div className="field" style={{ maxWidth: 260 }}>
            <label>Группа игроков</label>
            <select value={draft.groupId ?? groups[0].id} onChange={(e) => set('groupId', e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

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

function EnemyGroupEditor({ group, onSave, onCancel }: { group: EnemyGroup; onSave: (group: EnemyGroup) => void; onCancel: () => void }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  return (
    <div className="card">
      <h3 className="card-title">{group.name ? 'Изменить подгруппу' : 'Новая подгруппа противников'}</h3>
      <div className="field">
        <label>Название</label>
        <input value={name} autoFocus placeholder="Орда у склада" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Описание</label>
        <textarea
          className="notes-textarea"
          style={{ minHeight: 80 }}
          value={description}
          placeholder="Где встречается, как действует, что известно игрокам…"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="item-actions">
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave({ ...group, name: name.trim(), description })}>
          Сохранить
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

interface CardProps {
  enemy: Enemy;
  inCombat: boolean;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onChangeHp: (hp: number) => void;
  onEdit: () => void;
  onClone: () => void;
  onToCombat: () => void;
  onDelete: () => void;
}

/** Мини-карточка противника: всё основное (в том числе изменить, копировать, в бой, умер) доступно, не разворачивая её. */
function EnemyCard({ enemy, inCombat, selected, onSelect, onChangeHp, onEdit, onClone, onToCombat, onDelete }: CardProps) {
  const [open, setOpen] = useState(false);
  const down = enemy.hp <= 0;
  const fill = Math.max(0, Math.min(100, (enemy.hp / Math.max(1, enemy.hpMax)) * 100));
  const stats = STAT_ORDER.filter((k) => enemy.stats[k] !== undefined);
  const hasDetails = !!(enemy.image || stats.length || enemy.attacks || enemy.description || enemy.fields.some((f) => f.label || f.value));

  return (
    <div className={`card enemy-card ${down ? 'down' : ''} ${selected ? 'selected' : ''}`}>
      <div className="enemy-head">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Выбрать «${enemy.name}»`} />
        {enemy.image && <img className="enemy-thumb" src={enemy.image} alt="" onClick={() => setOpen((o) => !o)} />}
        <div className="enemy-title" onClick={() => hasDetails && setOpen((o) => !o)} style={{ cursor: hasDetails ? 'pointer' : 'default' }}>
          <h4>
            {down ? '💀 ' : ''}
            {enemy.name} {hasDetails && <span className="muted">{open ? '▴' : '▾'}</span>}
          </h4>
          <div className="muted">{[enemy.kind, enemy.level ? `ур. ${enemy.level}` : ''].filter(Boolean).join(' · ') || 'Противник'}</div>
          <div className="enemy-numbers">
            {NUMBER_FIELDS.map(({ key, short, label }) => (
              <span key={key} title={label}>
                {short} <b>{enemy[key]}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="enemy-hp">
          <div className="enemy-hp-bar" style={{ ['--fill' as string]: `${fill}%` }}>
            <span>
              ❤ {enemy.hp} / {enemy.hpMax}
            </span>
          </div>
          <AmountAdjust current={enemy.hp} max={enemy.hpMax} onChange={onChangeHp} />
        </div>
      </div>

      <div className="enemy-actions">
        <button className="btn btn-sm" onClick={onEdit}>
          ✎ Изменить
        </button>
        <button className="btn btn-sm" onClick={onClone}>
          ⧉ Копии
        </button>
        <button className="btn btn-sm" disabled={inCombat} onClick={onToCombat}>
          {inCombat ? 'В бою' : '⚔ В бой'}
        </button>
        {down ? (
          <button className="btn btn-sm" onClick={() => onChangeHp(enemy.hpMax)}>
            Поднять
          </button>
        ) : (
          <button className="btn btn-sm btn-danger" onClick={() => onChangeHp(0)} title="Здоровье становится 0">
            ☠ Умер
          </button>
        )}
        <button className="btn btn-sm btn-ghost" onClick={onDelete}>
          ✕
        </button>
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
          {enemy.fields
            .filter((f) => f.label || f.value)
            .map((f) => (
              <p className="item-effect" key={f.id}>
                <b>{f.label || 'Поле'}:</b> {f.value}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

/** Противники группы: подгруппы, фильтры, мини-карточки с быстрыми действиями и массовые действия над выбранными. */
export function EnemiesTab() {
  const { enemies, updateEnemies, enemyGroups, updateEnemyGroups, groups, activeGroupId } = useAppData();
  const { showUndo } = useUndo();
  const [encounter, saveEncounter] = useGroupEncounter(activeGroupId);
  const [editing, setEditing] = useState<Enemy | null>(null);
  const [editingGroup, setEditingGroup] = useState<EnemyGroup | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState('');
  const [moveTo, setMoveTo] = useState('');

  const mine = useMemo(() => enemies.filter((e) => inGroup(e, activeGroupId, groups)), [enemies, activeGroupId, groups]);
  const myGroups = useMemo(() => enemyGroups.filter((g) => inGroup(g, activeGroupId, groups)), [enemyGroups, activeGroupId, groups]);
  const kinds = useMemo(() => Array.from(new Set([...ENEMY_KINDS, ...mine.map((e) => e.kind).filter(Boolean)])), [mine]);
  const levels = useMemo(() => Array.from(new Set(mine.map((e) => e.level).filter((l): l is number => !!l))).sort((a, b) => a - b), [mine]);
  const inCombat = new Set(encounter.participants.filter((p) => p.kind === 'enemy').map((p) => p.refId));

  const q = query.trim().toLowerCase();
  const filtersActive = q !== '' || kindFilter !== 'all' || levelFilter !== 'all';
  const matches = (e: Enemy) => {
    if (q && !`${e.name} ${e.kind} ${e.description} ${e.attacks}`.toLowerCase().includes(q)) return false;
    if (kindFilter === 'none' ? !!e.kind : kindFilter !== 'all' && e.kind !== kindFilter) return false;
    if (levelFilter === 'none' ? !!e.level : levelFilter !== 'all' && String(e.level ?? '') !== levelFilter) return false;
    return true;
  };
  const shown = mine.filter(matches);
  const ungrouped = shown.filter((e) => !e.enemyGroupId || !myGroups.some((g) => g.id === e.enemyGroupId));
  const selectedEnemies = mine.filter((e) => selected.has(e.id));

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

  function toCombat(list: Enemy[]) {
    let next: Encounter = encounter;
    for (const e of list) next = addParticipant(next, { kind: 'enemy', refId: e.id, initiative: e.initiative });
    saveEncounter(next);
  }

  function setHp(id: string, hp: number) {
    // У противников здоровье не уходит ниже нуля: 0 — значит умер.
    updateEnemies(enemies.map((e) => (e.id === id ? { ...e, hp: Math.max(0, hp), updatedAt: Date.now() } : e)));
  }

  function massHp(delta: number) {
    const ids = new Set(selectedEnemies.map((e) => e.id));
    updateEnemies(
      enemies.map((e) =>
        ids.has(e.id) ? { ...e, hp: delta >= 0 ? Math.max(e.hp, Math.min(e.hpMax, e.hp + delta)) : Math.max(0, e.hp + delta), updatedAt: Date.now() } : e,
      ),
    );
  }

  function massKill() {
    const ids = new Set(selectedEnemies.map((e) => e.id));
    updateEnemies(enemies.map((e) => (ids.has(e.id) ? { ...e, hp: 0, updatedAt: Date.now() } : e)));
  }

  function massDelete() {
    if (!confirm(`Удалить выбранных противников: ${selectedEnemies.length}?`)) return;
    const removed = selectedEnemies;
    const ids = new Set(removed.map((e) => e.id));
    updateEnemies(enemies.filter((e) => !ids.has(e.id)));
    setSelected(new Set());
    showUndo(`Удалено противников: ${removed.length}`, () => updateEnemies([...enemies]));
  }

  function massMove() {
    const ids = new Set(selectedEnemies.map((e) => e.id));
    updateEnemies(enemies.map((e) => (ids.has(e.id) ? { ...e, enemyGroupId: moveTo || undefined } : e)));
    setMoveTo('');
  }

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function saveSubgroup(group: EnemyGroup) {
    const exists = enemyGroups.some((g) => g.id === group.id);
    updateEnemyGroups(exists ? enemyGroups.map((g) => (g.id === group.id ? group : g)) : [...enemyGroups, group]);
    setEditingGroup(null);
  }

  function deleteSubgroup(group: EnemyGroup) {
    if (!confirm(`Удалить подгруппу «${group.name}»? Её противники останутся в общем списке.`)) return;
    updateEnemies(enemies.map((e) => (e.enemyGroupId === group.id ? { ...e, enemyGroupId: undefined } : e)));
    updateEnemyGroups(enemyGroups.filter((g) => g.id !== group.id));
  }

  function duplicateSubgroup(group: EnemyGroup) {
    const copy = createEnemyGroup(group.groupId ?? activeGroupId, `${group.name} (копия)`, group.description);
    const members = mine
      .filter((e) => e.enemyGroupId === group.id)
      .map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        enemyGroupId: copy.id,
        hp: e.hpMax,
        fields: e.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    updateEnemyGroups([...enemyGroups, copy]);
    updateEnemies([...enemies, ...members]);
  }

  const card = (enemy: Enemy) => (
    <EnemyCard
      key={enemy.id}
      enemy={enemy}
      inCombat={inCombat.has(enemy.id)}
      selected={selected.has(enemy.id)}
      onSelect={(on) => toggle(enemy.id, on)}
      onChangeHp={(hp) => setHp(enemy.id, hp)}
      onEdit={() => setEditing(enemy)}
      onClone={() => clone(enemy)}
      onToCombat={() => toCombat([enemy])}
      onDelete={() => remove(enemy)}
    />
  );

  if (editing) {
    return <EnemyEditor enemy={editing} enemyGroups={myGroups} onSave={save} onCancel={() => setEditing(null)} />;
  }
  if (editingGroup) {
    return <EnemyGroupEditor group={editingGroup} onSave={saveSubgroup} onCancel={() => setEditingGroup(null)} />;
  }

  const dmg = Number(amount);
  const dmgValid = amount.trim() !== '' && Number.isFinite(dmg) && dmg !== 0;

  return (
    <div>
      <div className="top-actions">
        <button className="btn btn-primary" onClick={() => setEditing(createBlankEnemy(activeGroupId))}>
          + Противник
        </button>
        <button className="btn" onClick={() => setEditingGroup(createEnemyGroup(activeGroupId, ''))}>
          + Подгруппа
        </button>
      </div>

      {mine.length > 0 && (
        <div className="tray-filters">
          <input className="tray-search" placeholder="Поиск по названию, типу, описанию" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="all">Любой тип</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
            <option value="none">Тип не указан</option>
          </select>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="all">Любой уровень</option>
            {levels.map((l) => (
              <option key={l} value={String(l)}>
                Уровень {l}
              </option>
            ))}
            <option value="none">Без уровня</option>
          </select>
          {filtersActive && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setQuery('');
                setKindFilter('all');
                setLevelFilter('all');
              }}
            >
              Сбросить
            </button>
          )}
          <span className="muted">
            Показано {shown.length} из {mine.length}
          </span>
          {shown.length > 1 && (
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set(shown.map((e) => e.id)))}>
              Выбрать показанных
            </button>
          )}
        </div>
      )}

      {selectedEnemies.length > 0 && (
        <div className="card batch-actions">
          <b>Выбрано: {selectedEnemies.length}</b>
          <div className="row">
            <button className="btn btn-sm btn-primary" onClick={() => toCombat(selectedEnemies.filter((e) => !inCombat.has(e.id)))}>
              ⚔ В бой выбранных
            </button>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              placeholder="Урон / лечение"
              style={{ maxWidth: 140 }}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              className="btn btn-sm"
              disabled={!dmgValid}
              onClick={() => {
                massHp(-Math.abs(dmg));
                setAmount('');
              }}
            >
              − Урон каждому
            </button>
            <button
              className="btn btn-sm"
              disabled={!dmgValid}
              onClick={() => {
                massHp(Math.abs(dmg));
                setAmount('');
              }}
            >
              + Лечение каждому
            </button>
            <button className="btn btn-sm btn-danger" onClick={massKill}>
              ☠ Умерли
            </button>
          </div>
          <div className="row">
            {myGroups.length > 0 && (
              <>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  <option value="">— общий список —</option>
                  {myGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm" onClick={massMove}>
                  Переместить в подгруппу
                </button>
              </>
            )}
            <button className="btn btn-sm btn-ghost" onClick={massDelete}>
              Удалить
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>
              Снять выбор
            </button>
          </div>
        </div>
      )}

      {mine.length === 0 && myGroups.length === 0 && (
        <div className="empty-state">
          Противников этой группы пока нет. Заведите зомби, монстра или NPC: название, тип, основные числа, описание и
          картинка. Противников можно собирать в подгруппы («Орда у склада»), размножать («Копии») и отправлять в бой по
          одному или пачкой.
        </div>
      )}

      {myGroups.map((group) => {
        const inside = shown.filter((e) => e.enemyGroupId === group.id);
        const all = mine.filter((e) => e.enemyGroupId === group.id);
        if (filtersActive && inside.length === 0) return null;
        return (
          <div className="card enemy-subgroup" key={group.id}>
            <div className="enemy-subgroup-head">
              <div>
                <h3 className="card-title" style={{ margin: 0 }}>
                  📂 {group.name} <span className="muted">({all.length})</span>
                </h3>
                {group.description && <p className="muted" style={{ margin: '4px 0 0' }}>{group.description}</p>}
              </div>
              <div className="enemy-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => setEditing({ ...createBlankEnemy(activeGroupId), enemyGroupId: group.id })}
                >
                  + Противник
                </button>
                <button className="btn btn-sm" disabled={all.length === 0} onClick={() => toCombat(all.filter((e) => !inCombat.has(e.id)))}>
                  ⚔ В бой всех
                </button>
                <button className="btn btn-sm" disabled={all.length === 0} onClick={() => setSelected(new Set([...selected, ...all.map((e) => e.id)]))}>
                  Выбрать
                </button>
                <details className="more-menu">
                  <summary className="btn btn-sm" aria-label="Действия с подгруппой">
                    ⋯
                  </summary>
                  <div className="more-menu-list">
                    <button className="btn btn-ghost" onClick={() => setEditingGroup(group)}>
                      Изменить
                    </button>
                    <button className="btn btn-ghost" onClick={() => duplicateSubgroup(group)}>
                      Копировать подгруппу
                    </button>
                    <button className="btn btn-ghost btn-danger" onClick={() => deleteSubgroup(group)}>
                      Удалить подгруппу
                    </button>
                  </div>
                </details>
              </div>
            </div>
            {inside.length === 0 && <p className="muted">В подгруппе пока нет противников.</p>}
            {inside.map(card)}
          </div>
        );
      })}

      {(ungrouped.length > 0 || myGroups.length === 0) && (
        <div>
          {myGroups.length > 0 && <h4 className="muted">Без подгруппы</h4>}
          {ungrouped.map(card)}
        </div>
      )}
    </div>
  );
}
