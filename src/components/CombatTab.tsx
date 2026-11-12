import { useState } from 'react';
import { useAppData } from '../state/useAppData';
import { useGroupEncounter } from '../hooks/useGroupEncounter';
import { AmountAdjust } from './AmountAdjust';
import { NumberField } from './NumberField';
import { computeDerivedStats } from '../data/formulas';
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
import { PATH_RESOURCE_LABEL } from '../data/statsConfig';
import type { Character, Encounter, EncounterParticipant, Enemy } from '../types';

const CONDITION_SUGGESTIONS = ['Оглушён', 'Горит', 'Кровотечение', 'Отравлен', 'Заражён', 'Парализован', 'Страх', 'Замедлен'];

/** Кто в бою: игрок (персонаж мастер-вида) или противник. Выбывшие противники (здоровье 0) пропускаются в очереди. */
function resolve(p: EncounterParticipant, characters: Character[], enemies: Enemy[]) {
  const character = p.kind === 'player' ? characters.find((c) => c.id === p.refId) : undefined;
  const enemy = p.kind === 'enemy' ? enemies.find((e) => e.id === p.refId) : undefined;
  return { character, enemy, missing: !character && !enemy };
}

function ConditionAdder({ onAdd, onClose }: { onAdd: (name: string, rounds?: number) => void; onClose: () => void }) {
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
        Добавить
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

/** Бой группы: порядок инициативы, раунды, чей ход, здоровье участников и состояния. */
export function CombatTab() {
  const { characters, enemies, groups, activeGroupId, updateCharacter, updateEnemies } = useAppData();
  const [encounter, save] = useGroupEncounter(activeGroupId);
  const [conditionFor, setConditionFor] = useState<string | null>(null);

  const groupCharacters = characters.filter((c) => c.roster !== 'personal' && inGroup(c, activeGroupId, groups));
  const groupEnemies = enemies.filter((e) => inGroup(e, activeGroupId, groups));

  const isOut = (p: EncounterParticipant) => {
    const { enemy, missing } = resolve(p, characters, enemies);
    return missing || (!!enemy && enemy.hp <= 0);
  };
  const order = orderOf(encounter);
  const inCombatPlayers = new Set(encounter.participants.filter((p) => p.kind === 'player').map((p) => p.refId));
  const inCombatEnemies = new Set(encounter.participants.filter((p) => p.kind === 'enemy').map((p) => p.refId));
  const freeEnemies = groupEnemies.filter((e) => !inCombatEnemies.has(e.id));

  function addPlayers() {
    let next: Encounter = encounter;
    for (const c of groupCharacters) {
      if (inCombatPlayers.has(c.id)) continue;
      next = addParticipant(next, { kind: 'player', refId: c.id, initiative: computeDerivedStats(c).initiative });
    }
    save(next);
  }

  function addEnemies(list: Enemy[]) {
    let next: Encounter = encounter;
    for (const e of list) next = addParticipant(next, { kind: 'enemy', refId: e.id, initiative: e.initiative });
    save(next);
  }

  function setHp(p: EncounterParticipant, hp: number) {
    const { character, enemy } = resolve(p, characters, enemies);
    if (character) updateCharacter({ ...character, pools: { ...character.pools, hp } });
    if (enemy) updateEnemies(enemies.map((e) => (e.id === enemy.id ? { ...e, hp, updatedAt: Date.now() } : e)));
  }

  function addCondition(p: EncounterParticipant, name: string, rounds?: number) {
    save(updateParticipant(encounter, p.id, { conditions: [...p.conditions, { id: crypto.randomUUID(), name, rounds }] }));
  }

  return (
    <div>
      <div className="card combat-controls">
        <div className="combat-status">
          {encounter.active ? (
            <>
              <b>Раунд {encounter.round}</b>
              <span className="muted">
                Ходит:{' '}
                {(() => {
                  const cur = encounter.participants.find((p) => p.id === encounter.currentId);
                  if (!cur) return '—';
                  const { character, enemy } = resolve(cur, characters, enemies);
                  return character?.characterName || enemy?.name || 'неизвестно';
                })()}
              </span>
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
          <button className="btn" onClick={addPlayers} disabled={groupCharacters.every((c) => inCombatPlayers.has(c.id))}>
            + Игроки группы
          </button>
          <button className="btn" onClick={() => addEnemies(freeEnemies)} disabled={freeEnemies.length === 0}>
            + Все противники ({freeEnemies.length})
          </button>
          {encounter.participants.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (confirm('Убрать всех участников из боя?')) save({ ...endEncounter(encounter), participants: [] });
              }}
            >
              Очистить
            </button>
          )}
        </div>
      </div>

      {order.length === 0 && (
        <div className="empty-state">
          В бою никого нет. Добавьте игроков группы и противников — противника можно отправить и из его карточки («⚔ В бой»).
          Инициатива подставляется из характеристик, её можно поправить.
        </div>
      )}

      {order.map((p) => {
        const { character, enemy, missing } = resolve(p, characters, enemies);
        const current = encounter.active && encounter.currentId === p.id;
        const out = isOut(p);
        const max = character ? computeDerivedStats(character) : null;
        const name = character?.characterName || enemy?.name || 'Удалён';
        return (
          <div key={p.id} className={`card combat-row ${current ? 'current' : ''} ${out ? 'out' : ''}`}>
            <div className="combat-main">
              <span className="combat-turn" aria-hidden="true">
                {current ? '▶' : ''}
              </span>
              <label className="combat-init" title="Инициатива">
                <span className="muted">Иниц.</span>
                <NumberField value={p.initiative} onChange={(v) => save(updateParticipant(encounter, p.id, { initiative: v }))} />
              </label>
              <div className="combat-name">
                <b>
                  {out && !missing ? '💀 ' : ''}
                  {name}
                </b>
                <div className="muted">
                  {p.kind === 'player' ? `Игрок${character?.species ? ` · ${character.species}` : ''}` : enemy?.kind || 'Противник'}
                  {missing ? ' · запись удалена' : ''}
                </div>
              </div>
              {!missing && (
                <div className="combat-hp">
                  <span>
                    ❤ {character ? character.pools.hp : enemy!.hp} / {character ? max!.hp : enemy!.hpMax}
                  </span>
                  <AmountAdjust
                    current={character ? character.pools.hp : enemy!.hp}
                    max={character ? max!.hp : enemy!.hpMax}
                    onChange={(hp) => setHp(p, hp)}
                  />
                </div>
              )}
              <button
                className="btn btn-ghost btn-sm"
                title="Убрать из боя"
                onClick={() => save(removeParticipant(encounter, p.id, isOut))}
              >
                ✕
              </button>
            </div>

            {character && max && (
              <div className="combat-pools muted">
                ⚡ Выносл. {character.pools.staminaPoints}/{max.staminaPoints} · {PATH_RESOURCE_LABEL[character.path]}{' '}
                {character.pools.resourcePoints}/{max.resourcePoints} · ПЗ {max.defense}
              </div>
            )}
            {enemy && (
              <div className="combat-pools muted">
                ПЗ {enemy.defense} · С {enemy.speed} · СС {enemy.resistance}
              </div>
            )}

            <div className="combat-conditions">
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
                <ConditionAdder onAdd={(n, r) => addCondition(p, n, r)} onClose={() => setConditionFor(null)} />
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
