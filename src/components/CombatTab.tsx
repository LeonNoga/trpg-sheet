import { useState } from 'react';
import { useAppData } from '../state/useAppData';
import { useGroupEncounter } from '../hooks/useGroupEncounter';
import { AmountAdjust } from './AmountAdjust';
import { NumberField } from './NumberField';
import { FloatingPanel } from './FloatingPanel';
import { EnemyDetails } from './EnemyDetails';
import {
  addParticipant,
  endEncounter,
  inGroup,
  nextTurn,
  orderOf,
  removeParticipant,
  startEncounter,
  updateParticipant,
} from '../data/gm';
import type { Encounter, EncounterParticipant, Enemy, PartyMember } from '../types';

const CONDITION_SUGGESTIONS = ['Оглушён', 'Горит', 'Кровотечение', 'Отравлен', 'Заражён', 'Парализован', 'Страх', 'Замедлен'];

/** Кто в бою: игрок (мини-карточка) или противник. Выбывшие противники (здоровье 0) пропускаются в очереди. */
function resolve(p: EncounterParticipant, members: PartyMember[], enemies: Enemy[]) {
  const member = p.kind === 'player' ? members.find((m) => m.id === p.refId) : undefined;
  const enemy = p.kind === 'enemy' ? enemies.find((e) => e.id === p.refId) : undefined;
  return { member, enemy, missing: !member && !enemy };
}

function ConditionAdder({ onAdd, onClose, label = 'Добавить' }: { onAdd: (name: string, rounds?: number) => void; onClose: () => void; label?: string }) {
  const [name, setName] = useState('');
  const [rounds, setRounds] = useState('');
  const valid = name.trim() !== '';
  const submit = () => {
    if (!valid) return;
    const n = Math.floor(Number(rounds));
    onAdd(name.trim(), rounds.trim() !== '' && n > 0 ? n : undefined);
    onClose();
  };
  return (
    <div className="row condition-adder">
      <input
        value={name}
        list="condition-names"
        placeholder="Состояние"
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <datalist id="condition-names">
        {CONDITION_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        style={{ maxWidth: 90 }}
        value={rounds}
        placeholder="раундов"
        onChange={(e) => setRounds(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="btn btn-sm btn-primary" disabled={!valid} onClick={submit}>
        {label}
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

/** Панель действий над выбранными участниками боя: урон и лечение «толпе», смерть, инициатива, состояние. */
function MassActions({
  count,
  onDamage,
  onKill,
  onInitiative,
  onCondition,
  onRemove,
  onClear,
}: {
  count: number;
  onDamage: (amount: number) => void;
  onKill: () => void;
  onInitiative: (mode: 'set' | 'shift', value: number) => void;
  onCondition: (name: string, rounds?: number) => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [initiative, setInitiative] = useState('');
  const [conditionOpen, setConditionOpen] = useState(false);
  const dmg = Number(amount);
  const dmgValid = amount.trim() !== '' && Number.isFinite(dmg) && dmg !== 0;
  const init = Number(initiative);
  const initValid = initiative.trim() !== '' && Number.isFinite(init);

  return (
    <div className="card batch-actions">
      <b>Выбрано: {count}</b>
      <div className="row">
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          placeholder="Урон / лечение"
          style={{ maxWidth: 140 }}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Урон или лечение каждому выбранному"
        />
        <button
          className="btn btn-sm"
          disabled={!dmgValid}
          onClick={() => {
            onDamage(-Math.abs(dmg));
            setAmount('');
          }}
        >
          − Урон каждому
        </button>
        <button
          className="btn btn-sm"
          disabled={!dmgValid}
          onClick={() => {
            onDamage(Math.abs(dmg));
            setAmount('');
          }}
        >
          + Лечение каждому
        </button>
        <button className="btn btn-sm btn-danger" onClick={onKill} title="Здоровье выбранных противников становится 0">
          ☠ Умерли
        </button>
      </div>
      <div className="row">
        <input
          type="number"
          inputMode="numeric"
          value={initiative}
          placeholder="Инициатива"
          style={{ maxWidth: 130 }}
          onChange={(e) => setInitiative(e.target.value)}
          aria-label="Инициатива выбранным"
        />
        <button className="btn btn-sm" disabled={!initValid} onClick={() => onInitiative('set', init)}>
          Поставить всем
        </button>
        <button className="btn btn-sm" disabled={!initValid} onClick={() => onInitiative('shift', init)} title="Прибавить число (можно отрицательное) к инициативе каждого">
          Сдвинуть на ±
        </button>
        {conditionOpen ? (
          <ConditionAdder label="Всем" onAdd={onCondition} onClose={() => setConditionOpen(false)} />
        ) : (
          <button className="btn btn-sm" onClick={() => setConditionOpen(true)}>
            + состояние всем
          </button>
        )}
        <button className="btn btn-sm btn-ghost" onClick={onRemove}>
          Убрать из боя
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onClear}>
          Снять выбор
        </button>
      </div>
    </div>
  );
}

/** Бой группы: порядок инициативы, раунды, чей ход, здоровье, смерть, состояния и массовые действия. */
export function CombatTab() {
  const { members, enemies, groups, activeGroupId, updateMembers, updateEnemies } = useAppData();
  const [encounter, save] = useGroupEncounter(activeGroupId);
  const [conditionFor, setConditionFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groupMembers = members.filter((m) => inGroup(m, activeGroupId, groups));
  const groupEnemies = enemies.filter((e) => inGroup(e, activeGroupId, groups));

  const isOut = (p: EncounterParticipant) => {
    const { enemy, missing } = resolve(p, members, enemies);
    return missing || (!!enemy && enemy.hp <= 0);
  };
  const order = orderOf(encounter);
  const inCombatPlayers = new Set(encounter.participants.filter((p) => p.kind === 'player').map((p) => p.refId));
  const inCombatEnemies = new Set(encounter.participants.filter((p) => p.kind === 'enemy').map((p) => p.refId));
  const freeEnemies = groupEnemies.filter((e) => !inCombatEnemies.has(e.id));
  const selectedParts = encounter.participants.filter((p) => selected.has(p.id));

  function addPlayers() {
    let next: Encounter = encounter;
    for (const m of groupMembers) {
      if (!inCombatPlayers.has(m.id)) next = addParticipant(next, { kind: 'player', refId: m.id, initiative: m.initiative });
    }
    save(next);
  }

  function addEnemies(list: Enemy[]) {
    let next: Encounter = encounter;
    for (const e of list) next = addParticipant(next, { kind: 'enemy', refId: e.id, initiative: e.initiative });
    save(next);
  }

  function setHp(p: EncounterParticipant, hp: number) {
    const { member, enemy } = resolve(p, members, enemies);
    if (member) updateMembers(members.map((m) => (m.id === member.id ? { ...m, hp, updatedAt: Date.now() } : m)));
    if (enemy) updateEnemies(enemies.map((e) => (e.id === enemy.id ? { ...e, hp: Math.max(0, hp), updatedAt: Date.now() } : e)));
  }

  /** Урон или лечение (delta со знаком) каждому из выбранных за один раз. */
  function massHp(delta: number) {
    const ids = new Set(selectedParts.map((p) => `${p.kind}:${p.refId}`));
    const apply = (hp: number, max: number) => (delta >= 0 ? Math.max(hp, Math.min(max, hp + delta)) : hp + delta);
    if (selectedParts.some((p) => p.kind === 'player')) {
      updateMembers(members.map((m) => (ids.has(`player:${m.id}`) ? { ...m, hp: apply(m.hp, m.hpMax), updatedAt: Date.now() } : m)));
    }
    if (selectedParts.some((p) => p.kind === 'enemy')) {
      updateEnemies(enemies.map((e) => (ids.has(`enemy:${e.id}`) ? { ...e, hp: Math.max(0, apply(e.hp, e.hpMax)), updatedAt: Date.now() } : e)));
    }
  }

  function kill(enemyIds: Set<string>) {
    updateEnemies(enemies.map((e) => (enemyIds.has(e.id) ? { ...e, hp: 0, updatedAt: Date.now() } : e)));
  }

  function massInitiative(mode: 'set' | 'shift', value: number) {
    save({
      ...encounter,
      participants: encounter.participants.map((p) => (selected.has(p.id) ? { ...p, initiative: mode === 'set' ? value : p.initiative + value } : p)),
    });
  }

  function massCondition(name: string, rounds?: number) {
    save({
      ...encounter,
      participants: encounter.participants.map((p) =>
        selected.has(p.id) ? { ...p, conditions: [...p.conditions, { id: crypto.randomUUID(), name, rounds }] } : p,
      ),
    });
  }

  function massRemove() {
    if (!confirm(`Убрать из боя выбранных: ${selectedParts.length}?`)) return;
    let next = encounter;
    for (const p of selectedParts) next = removeParticipant(next, p.id, isOut);
    save(next);
    setSelected(new Set());
  }

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const nameOfCurrent = (() => {
    const cur = encounter.participants.find((p) => p.id === encounter.currentId);
    if (!cur) return '—';
    const { member, enemy } = resolve(cur, members, enemies);
    return member?.name || enemy?.name || 'неизвестно';
  })();

  return (
    <div>
      <div className="card combat-controls">
        <div className="combat-status">
          {encounter.active ? (
            <>
              <b>Раунд {encounter.round}</b>
              <span className="muted">Ходит: {nameOfCurrent}</span>
            </>
          ) : (
            <span className="muted">Бой не идёт. Соберите участников и начните.</span>
          )}
        </div>
        <div className="top-actions" style={{ marginBottom: 0 }}>
          {encounter.active ? (
            <>
              <button className="btn btn-primary" onClick={() => save(nextTurn(encounter, isOut))}>
                ▶ Следующий ход
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (confirm('Завершить бой? Порядок и раунд сбросятся, участники останутся в списке.')) save(endEncounter(encounter));
                }}
              >
                🏁 Завершить бой
              </button>
            </>
          ) : (
            <button className="btn btn-primary" disabled={order.length === 0} onClick={() => save(startEncounter(encounter, isOut))}>
              ⚔ Начать бой
            </button>
          )}
          <button className="btn" onClick={addPlayers} disabled={groupMembers.every((m) => inCombatPlayers.has(m.id))}>
            + Игроки группы
          </button>
          <button className="btn" onClick={() => addEnemies(freeEnemies)} disabled={freeEnemies.length === 0}>
            + Все противники ({freeEnemies.length})
          </button>
          {encounter.participants.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (confirm('Убрать всех участников из боя?')) {
                  save({ ...endEncounter(encounter), participants: [] });
                  setSelected(new Set());
                }
              }}
            >
              Очистить
            </button>
          )}
        </div>
        {order.length > 1 && (
          <div className="top-actions" style={{ margin: '8px 0 0' }}>
            <span className="muted">Выбор:</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set(order.map((p) => p.id)))}>
              все
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set(order.filter((p) => p.kind === 'enemy').map((p) => p.id)))}>
              противники
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set(order.filter((p) => p.kind === 'player').map((p) => p.id)))}>
              игроки
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set(order.filter((p) => p.kind === 'enemy' && !isOut(p)).map((p) => p.id)))}>
              живые противники
            </button>
            {selected.size > 0 && (
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>
                снять
              </button>
            )}
          </div>
        )}
      </div>

      {selectedParts.length > 0 && (
        <MassActions
          count={selectedParts.length}
          onDamage={massHp}
          onKill={() => kill(new Set(selectedParts.filter((p) => p.kind === 'enemy').map((p) => p.refId)))}
          onInitiative={massInitiative}
          onCondition={massCondition}
          onRemove={massRemove}
          onClear={() => setSelected(new Set())}
        />
      )}

      {order.length === 0 && (
        <div className="empty-state">
          В бою никого нет. Добавьте игроков группы и противников — противника можно отправить и из его карточки («⚔ В бой»).
          Инициатива подставляется из карточки (кубик + параметр считаете сами): впишите итоговое значение, порядок сложится
          по нему.
        </div>
      )}

      {order.map((p) => {
        const { member, enemy, missing } = resolve(p, members, enemies);
        const current = encounter.active && encounter.currentId === p.id;
        const out = isOut(p);
        const hp = member ? member.hp : enemy?.hp ?? 0;
        const hpMax = member ? member.hpMax : enemy?.hpMax ?? 0;
        const name = member?.name || enemy?.name || 'Удалён';
        const stats = member ?? enemy;
        return (
          <div key={p.id} className={`card combat-row ${member ? 'side-player' : enemy ? 'side-enemy' : ''} ${current ? 'current' : ''} ${out ? 'out' : ''}`}>
            <div className="combat-main">
              <input type="checkbox" checked={selected.has(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} aria-label={`Выбрать «${name}»`} />
              <span className="combat-turn" aria-hidden="true">
                {current ? '▶' : ''}
              </span>
              <label className="combat-init" title="Инициатива (итог броска)">
                <span className="muted">Иниц.</span>
                <NumberField value={p.initiative} onChange={(v) => save(updateParticipant(encounter, p.id, { initiative: v }))} />
              </label>
              <div className="combat-name">
                <b>
                  {out && !missing ? '💀 ' : ''}
                  {name}
                </b>
                <span className={`side-badge ${member ? 'player' : 'enemy'}`}>{member ? 'Игрок' : enemy ? 'Противник' : ''}</span>
                <div className="muted">
                  {member
                    ? `Игрок${member.playerName ? ` ${member.playerName}` : ''} · ур. ${member.level}${member.type ? ` · ${member.type}` : ''}`
                    : enemy
                      ? `${enemy.kind || 'Противник'}${enemy.level ? ` · ур. ${enemy.level}` : ''}`
                      : ''}
                  {missing ? ' запись удалена' : ''}
                </div>
              </div>
              {stats && (
                <div className="combat-stats" aria-label="Основные числа">
                  {[['ПЗ', stats.defense], ['С', stats.speed], ['ПВ', stats.passivePerception], ['СС', stats.resistance]].map(([label, value]) => (
                    <div className="stat-box" key={label}>
                      <span>{label}</span>
                      <b>{value}</b>
                    </div>
                  ))}
                </div>
              )}
              {!missing && (
                <div className="combat-hp">
                  <span>
                    ❤ {hp} / {hpMax}
                  </span>
                  <AmountAdjust current={hp} max={hpMax} onChange={(value) => setHp(p, value)} />
                  {enemy && (out ? (
                    <button className="btn btn-sm" onClick={() => setHp(p, enemy.hpMax)} title="Вернуть противника в строй с полным здоровьем">
                      Поднять
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-danger" onClick={() => setHp(p, 0)} title="Противник умер: здоровье становится 0">
                      ☠ Умер
                    </button>
                  ))}
                </div>
              )}
              <button className="btn btn-ghost btn-sm" title="Убрать из боя" onClick={() => save(removeParticipant(encounter, p.id, isOut))}>
                ✕
              </button>
            </div>

            <div className="combat-conditions">
              {enemy && (
                <span className="combat-links">
                  {enemy.image && (
                    <FloatingPanel title="Картинка противника" panel={<img className="enemy-image" src={enemy.image} alt={enemy.name} />}>
                      <img className="combat-thumb" src={enemy.image} alt="" />
                    </FloatingPanel>
                  )}
                  <FloatingPanel
                    title="Карточка противника: при наведении, нажмите, чтобы закрепить"
                    panel={
                      <div className="enemy-popup">
                        <h4 style={{ margin: 0 }}>{enemy.name}</h4>
                        <div className="muted">
                          {[enemy.kind, enemy.level ? `ур. ${enemy.level}` : ''].filter(Boolean).join(' · ') || 'Противник'} · ❤ {enemy.hp} / {enemy.hpMax}
                        </div>
                        <div className="combat-stats" style={{ margin: '8px 0' }}>
                          {[['ПЗ', enemy.defense], ['С', enemy.speed], ['ПВ', enemy.passivePerception], ['И', enemy.initiative], ['СС', enemy.resistance]].map(([label, value]) => (
                            <div className="stat-box" key={label}>
                              <span>{label}</span>
                              <b>{value}</b>
                            </div>
                          ))}
                        </div>
                        <EnemyDetails enemy={enemy} />
                      </div>
                    }
                  >
                    <span className="btn btn-sm">📄 Карточка</span>
                  </FloatingPanel>
                </span>
              )}
              {p.conditions.map((c) => (
                <span key={c.id} className="effect-chip neg">
                  <span className="effect-name">{c.name}</span>
                  {c.rounds !== undefined && <span className="effect-left">{c.rounds} р.</span>}
                  <button
                    type="button"
                    aria-label={`Снять «${c.name}»`}
                    onClick={() => save(updateParticipant(encounter, p.id, { conditions: p.conditions.filter((x) => x.id !== c.id) }))}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {conditionFor === p.id ? (
                <ConditionAdder
                  onAdd={(n, r) => save(updateParticipant(encounter, p.id, { conditions: [...p.conditions, { id: crypto.randomUUID(), name: n, rounds: r }] }))}
                  onClose={() => setConditionFor(null)}
                />
              ) : (
                <button className="btn btn-sm btn-ghost" onClick={() => setConditionFor(p.id)}>
                  + состояние
                </button>
              )}
            </div>
          </div>
        );
      })}

      {freeEnemies.length > 0 && (
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Противники не в бою</h4>
          <div className="top-actions" style={{ marginBottom: 0 }}>
            {freeEnemies.map((e) => (
              <button key={e.id} className="btn btn-sm" onClick={() => addEnemies([e])}>
                + {e.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
