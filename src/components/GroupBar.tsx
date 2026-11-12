import { useState } from 'react';
import { useAppData } from '../state/useAppData';
import { GroupHistoryDialog, GroupLogDialog } from './GroupDialogs';

/** Выбор группы игроков («подпапки» мастер-вида) и управление ими: создать, переименовать, удалить. */
export function GroupBar() {
  const { groups, activeGroupId, setActiveGroup, addGroup, renameGroup, deleteGroup } = useAppData();
  const active = groups.find((g) => g.id === activeGroupId);
  const [dialog, setDialog] = useState<'log' | 'history' | null>(null);

  return (
    <div className="group-bar">
      <span className="muted">Группа:</span>
      {groups.map((group) => (
        <button
          key={group.id}
          className={`nav-tab ${group.id === activeGroupId ? 'active' : ''}`}
          onClick={() => setActiveGroup(group.id)}
        >
          📁 {group.name}
        </button>
      ))}
      <button
        className="btn btn-sm"
        onClick={() => {
          const name = prompt('Название новой группы (например, «Пятничная кампания»)');
          if (name?.trim()) addGroup(name);
        }}
      >
        + Группа
      </button>
      {active && (
        <details className="more-menu">
          <summary className="btn btn-sm" aria-label="Управление группой">
            ⋯
          </summary>
          <div className="more-menu-list">
            <button className="btn btn-ghost" onClick={() => setDialog('log')}>
              Журнал группы
            </button>
            <button className="btn btn-ghost" onClick={() => setDialog('history')}>
              История группы
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                const name = prompt('Новое название группы', active.name);
                if (name?.trim()) renameGroup(active.id, name);
              }}
            >
              Переименовать
            </button>
            <button
              className="btn btn-ghost btn-danger"
              disabled={groups.length < 2}
              title={groups.length < 2 ? 'Последнюю группу удалить нельзя' : undefined}
              onClick={() => {
                const other = groups.find((g) => g.id !== active.id);
                if (
                  other &&
                  confirm(
                    `Удалить группу «${active.name}»? Её игроки, противники и лут перейдут в «${other.name}», бой группы будет сброшен.`,
                  )
                ) {
                  deleteGroup(active.id);
                }
              }}
            >
              Удалить группу
            </button>
          </div>
        </details>
      )}
      {active && dialog === 'log' && <GroupLogDialog group={active} onClose={() => setDialog(null)} />}
      {active && dialog === 'history' && <GroupHistoryDialog group={active} onClose={() => setDialog(null)} />}
    </div>
  );
}
