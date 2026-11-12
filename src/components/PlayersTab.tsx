import { useRef, useState } from 'react';
import { useAppData } from '../state/useAppData';
import { useUndo } from '../state/useUndo';
import { AmountAdjust } from './AmountAdjust';
import { NumberField } from './NumberField';
import { PasteImportButton } from './FileDialogs';
import { createBlankMember, inGroup, memberFromCharacter } from '../data/gm';
import { readCharacterFile } from '../storage/exportImport';
import type { PartyMember } from '../types';

const NUMBER_FIELDS: { key: 'level' | 'hpMax' | 'defense' | 'speed' | 'passivePerception' | 'initiative' | 'resistance'; label: string; title: string }[] = [
  { key: 'level', label: 'Ур.', title: 'Уровень' },
  { key: 'hpMax', label: 'Макс. хиты', title: 'Максимум здоровья' },
  { key: 'defense', label: 'ПЗ', title: 'Показатель защиты' },
  { key: 'speed', label: 'С', title: 'Скорость' },
  { key: 'passivePerception', label: 'ПВ', title: 'Пассивное восприятие' },
  { key: 'initiative', label: 'Иниц.', title: 'Параметр инициативы' },
  { key: 'resistance', label: 'СС', title: 'Сложность сопротивления' },
];

function MemberCard({ member, onChange, onDelete }: { member: PartyMember; onChange: (patch: Partial<PartyMember>) => void; onDelete: () => void }) {
  const { groups } = useAppData();

  return (
    <div className="card member-card">
      <div className="row">
        <input
          className="member-name"
          value={member.name}
          placeholder="Имя персонажа"
          onChange={(e) => onChange({ name: e.target.value })}
          aria-label="Имя персонажа"
        />
        <input
          value={member.playerName}
          placeholder="Игрок"
          style={{ maxWidth: 160 }}
          onChange={(e) => onChange({ playerName: e.target.value })}
          aria-label="Имя игрока"
        />
        <input
          value={member.type}
          placeholder="Тип (вид / класс / модель)"
          style={{ maxWidth: 220 }}
          onChange={(e) => onChange({ type: e.target.value })}
          aria-label="Тип"
        />
        <button className="btn btn-ghost btn-sm" title="Удалить игрока" onClick={onDelete}>
          ✕
        </button>
      </div>

      <div className="member-numbers">
        {NUMBER_FIELDS.map(({ key, label, title }) => (
          <label key={key} className="member-number" title={title}>
            <span className="muted">{label}</span>
            <NumberField
              value={member[key]}
              onChange={(v) =>
                key === 'hpMax'
                  ? onChange({ hpMax: Math.max(1, v), hp: member.hp === member.hpMax ? Math.max(1, v) : Math.min(member.hp, Math.max(1, v)) })
                  : onChange({ [key]: v })
              }
            />
          </label>
        ))}
        <div className="member-hp">
          <span className="muted">Здоровье</span>
          <b>
            ❤ {member.hp} / {member.hpMax}
          </b>
          <AmountAdjust current={member.hp} max={member.hpMax} onChange={(hp) => onChange({ hp })} />
        </div>
      </div>

      <details>
        <summary className="muted">Заметка{member.note ? ' ✎' : ''}</summary>
        <textarea
          className="notes-textarea"
          style={{ minHeight: 70 }}
          value={member.note}
          placeholder="Особенности, о которых договорились с игроком…"
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </details>

      {groups.length > 1 && (
        <select
          className="group-move"
          value={member.groupId ?? groups[0].id}
          title="Перенести в другую группу"
          onChange={(e) => onChange({ groupId: e.target.value })}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              📁 {g.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Игроки группы: мини-карточки с основными числами; мастер вносит их со слов игроков и правит по ходу игры. */
export function PlayersTab() {
  const { members, updateMembers, groups, activeGroupId } = useAppData();
  const { showUndo } = useUndo();
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const mine = members.filter((m) => inGroup(m, activeGroupId, groups));
  const q = query.trim().toLowerCase();
  const shown = q ? mine.filter((m) => `${m.name} ${m.playerName} ${m.type}`.toLowerCase().includes(q)) : mine;

  function change(id: string, patch: Partial<PartyMember>) {
    updateMembers(members.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m)));
  }

  function remove(member: PartyMember) {
    const index = members.findIndex((m) => m.id === member.id);
    updateMembers(members.filter((m) => m.id !== member.id));
    showUndo(`Удалён игрок «${member.name || 'без имени'}»`, () => {
      const next = [...members];
      next.splice(Math.min(index, next.length), 0, member);
      updateMembers(next);
    });
  }

  async function handleFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    try {
      const preview = await readCharacterFile(file);
      updateMembers([...members, memberFromCharacter(preview.character, activeGroupId)]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось прочитать файл.');
    }
  }

  return (
    <div>
      <div className="top-actions">
        <button className="btn btn-primary" onClick={() => updateMembers([...members, createBlankMember(activeGroupId)])}>
          + Игрок
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()} title="Мини-карточка заполняется из файла JSON игрока; сама полная карточка в мастер-вид не попадает">
          Из файла игрока
        </button>
        <PasteImportButton onFile={handleFile} label="Из текста" />
        <input ref={fileInput} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
        {mine.length > 6 && (
          <input className="tray-search" style={{ maxWidth: 240 }} placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
      </div>

      {mine.length === 0 && (
        <div className="empty-state">
          В этой группе пока нет игроков. В начале сессии уточните у игроков основные числа и внесите их в мини-карточки.
          Если у игрока что-то меняется, он сообщает, и вы правите на ходу. Полную карточку для проверки открывайте в
          обычном списке «Персонажи».
        </div>
      )}

      {shown.map((member) => (
        <MemberCard key={member.id} member={member} onChange={(patch) => change(member.id, patch)} onDelete={() => remove(member)} />
      ))}
    </div>
  );
}
