import { useState } from 'react';

const TARGET_TABLE: { target: string; penalty: string; effect: string }[] = [
  { target: 'Голова', penalty: '-10', effect: 'x3, Оглушение / Ослепление' },
  { target: 'Шея', penalty: '-8', effect: 'x2, Кровотечение' },
  { target: 'Кисть', penalty: '-7', effect: 'x1/2, Обезоруживание' },
  { target: 'Рука', penalty: '-5', effect: 'x1/2, Помеха' },
  { target: 'Пах', penalty: '-5', effect: 'x1, Болевой шок' },
  { target: 'Нога', penalty: '-4', effect: 'x1/2, Скорость x0.5 / Шанс сбить с ног' },
  { target: 'Туловище', penalty: '-1', effect: '—' },
];

const CALC_LIST = [
  { name: 'Взрыв куба', desc: 'Если на d10 выпало 10 — перебрось и прибавь к сумме' },
  { name: 'Атака', desc: '3д10 + Мод + Навык' },
  { name: 'Пассивная Защита (ПЗ)', desc: '18 + Стойкость + Бонус брони' },
  { name: 'Крит', desc: 'Итог ≥ TN + 15 (удвоение количества кубов)' },
];

const DAMAGE_LIST = [
  { name: 'Ближний бой', desc: 'Урон оружия + Сила' },
  { name: 'Дальний бой', desc: 'Только урон оружия' },
  { name: 'Магия/Тех', desc: 'Урон заклинания/технологии + Интеллект' },
  { name: 'Броски урона', desc: 'НЕ взрываются' },
];

interface ActionRow {
  cost: string;
  name: string;
  desc: string;
}

interface ActionSection {
  title: string;
  rows: ActionRow[];
}

const ACTION_SECTIONS: ActionSection[] = [
  {
    title: '0 действий (бесплатно)',
    rows: [
      { cost: '0д', name: 'Пассивная защита', desc: 'Работает автоматически, 18 + Стойкость + Броня' },
      { cost: '0д', name: 'Что-то сказать', desc: 'Крикнуть «Осторожно, зомби!»' },
      { cost: '0д', name: 'Плакать', desc: 'Хнык-хнык' },
    ],
  },
  {
    title: '1 действие',
    rows: [
      {
        cost: '1д',
        name: 'Атака',
        desc: '3д10 (взрывные) + Модификатор характеристики + Навык. Штраф: многократные атаки за ход дают −5, −10',
      },
      { cost: '1д', name: 'Перемещение', desc: 'До 5м + Мод. Ловкости. Можно дробить' },
      { cost: '1д', name: 'Использовать предмет / Обыскать тело', desc: '' },
      { cost: '1д', name: 'Встать', desc: 'Снять статус «лёжа/сбит с ног»' },
      { cost: '1д', name: 'Сбить с ног', desc: 'Противостояние Силы против Стойкости/Силы' },
      { cost: '1д', name: 'Захват', desc: 'Противостояние Силы против Ловкости/Силы' },
      { cost: '1д', name: 'Освободиться из захвата', desc: 'Противостояние Ловкости/Силы против Силы' },
      { cost: '1д', name: 'Защитная стойка', desc: '+3 Пунктам Защиты до следующего хода' },
      { cost: '1д', name: 'Сменить оружие / Перехват', desc: '' },
      { cost: '1д', name: 'Помочь союзнику', desc: 'Даёт союзнику Преимущество' },
      { cost: '1д', name: 'Осмотреться', desc: 'Пройти проверку Восприятия' },
      {
        cost: '1д',
        name: 'Укрыться / Выглянуть из-за препятствия',
        desc: '+5 к ПЗ против дальних атак до вашего следующего хода',
      },
    ],
  },
  {
    title: '2 действия',
    rows: [
      { cost: '2д', name: 'Мощный удар', desc: 'Холодное оружие: Урон x1,5' },
      { cost: '2д', name: 'Отступление', desc: 'Отойти без провокации атаки (включает 1/2 скорости)' },
      {
        cost: '2д',
        name: 'Удушение',
        desc: 'Сила vs Ловк/Сила. Даёт Скованность. Каждый ход можно наносить 1d3+Сила или держать',
      },
    ],
  },
  {
    title: '3 действия и комбинированные действия',
    rows: [
      { cost: '3д', name: 'Подготовить действие', desc: 'Пропуск хода → Мгновенное действие по триггеру' },
      {
        cost: '1–4д',
        name: 'Прицеливание',
        desc: 'Бонус к первой атаке. 1д: +2, 2д: +5, 3д: +8, 4д: +10. Сбрасывается при уроне/движении',
      },
      { cost: '1д/шаг', name: 'Перезарядка', desc: 'Можно копить действия в разные ходы' },
      {
        cost: '1д/шаг',
        name: 'Спринт',
        desc: 'Бег сверх лимита. Следующее перемещение: Скорость + Мод. Ловкости',
      },
      { cost: '1–3д', name: 'Способность', desc: 'По описанию' },
    ],
  },
  {
    title: '1 действие — реакции (нужно оставить одно действие в свой ход)',
    rows: [
      { cost: 'Р', name: 'Уклонение', desc: 'Противостояние Атаки против Акробатики' },
      { cost: 'Р', name: 'Блок щитом', desc: '+4 или +6 ПЗ на одну атаку' },
      { cost: 'Р', name: 'Парирование', desc: 'Противостояние Атаки против Холодного оружия' },
      { cost: 'Р', name: 'Перехват атаки', desc: 'Получить урон вместо союзника в 2м' },
    ],
  },
];

export function CombatMemoScreen() {
  const [view, setView] = useState<'text' | 'image'>('text');

  return (
    <div>
      <div className="top-actions">
        <button className={`nav-tab ${view === 'text' ? 'active' : ''}`} onClick={() => setView('text')}>
          Текст
        </button>
        <button className={`nav-tab ${view === 'image' ? 'active' : ''}`} onClick={() => setView('image')}>
          Фото
        </button>
      </div>

      <p className="muted">
        Общая памятка, одинаковая для всех — редактирование недоступно в интерфейсе.
      </p>

      {view === 'image' ? (
        <div className="card">
          <img src={`${import.meta.env.BASE_URL}reference/combat-memo.webp`} alt="Боевая памятка" className="item-image" />
        </div>
      ) : (
        <>
          <div className="card">
            <h3 className="card-title">Тактика и прицельные атаки</h3>
            <table className="ref-table">
              <thead>
                <tr>
                  <th>Цель</th>
                  <th>Штраф</th>
                  <th>Эффект</th>
                </tr>
              </thead>
              <tbody>
                {TARGET_TABLE.map((row) => (
                  <tr key={row.target}>
                    <td>{row.target}</td>
                    <td>{row.penalty}</td>
                    <td>{row.effect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="card-title">Боевые расчёты</h3>
            {CALC_LIST.map((row) => (
              <p key={row.name} className="memo-line">
                <strong>{row.name}:</strong> {row.desc}
              </p>
            ))}
          </div>

          <div className="card">
            <h3 className="card-title">Урон и стойкость</h3>
            {DAMAGE_LIST.map((row) => (
              <p key={row.name} className="memo-line">
                <strong>{row.name}:</strong> {row.desc}
              </p>
            ))}
          </div>

          {ACTION_SECTIONS.map((section) => (
            <div className="card" key={section.title}>
              <h3 className="card-title">{section.title}</h3>
              <table className="ref-table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>Цена</th>
                    <th>Действие</th>
                    <th>Эффект</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.name}>
                      <td>{row.cost}</td>
                      <td>{row.name}</td>
                      <td>{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
