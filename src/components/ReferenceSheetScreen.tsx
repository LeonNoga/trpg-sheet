import { useState } from 'react';
import { useAppData } from '../state/AppDataContext';
import { fileToDataUrl } from '../utils/file';
import { MAX_LEVEL } from '../data/progression';
import { NumberField } from './NumberField';
import { v4 as uuid } from 'uuid';
import type { ReferenceSection } from '../types';

export function ReferenceSheetScreen() {
  const { referenceSheet, updateReferenceSheet, progressionConfig, updateProgressionConfig } = useAppData();
  const [tab, setTab] = useState<'combat' | 'progression'>('combat');
  const [bulkValue, setBulkValue] = useState(100);

  function updateSections(sections: ReferenceSection[]) {
    updateReferenceSheet({ ...referenceSheet, sections });
  }

  function addSection() {
    updateSections([...referenceSheet.sections, { id: uuid(), title: 'Новый раздел', rows: [] }]);
  }

  function removeSection(id: string) {
    updateSections(referenceSheet.sections.filter((s) => s.id !== id));
  }

  function updateSectionTitle(id: string, title: string) {
    updateSections(referenceSheet.sections.map((s) => (s.id === id ? { ...s, title } : s)));
  }

  function addRow(sectionId: string) {
    updateSections(
      referenceSheet.sections.map((s) =>
        s.id === sectionId ? { ...s, rows: [...s.rows, { id: uuid(), action: '', cost: '', effect: '' }] } : s,
      ),
    );
  }

  function updateRow(sectionId: string, rowId: string, field: 'action' | 'cost' | 'effect', value: string) {
    updateSections(
      referenceSheet.sections.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)) },
      ),
    );
  }

  function removeRow(sectionId: string, rowId: string) {
    updateSections(
      referenceSheet.sections.map((s) =>
        s.id !== sectionId ? s : { ...s, rows: s.rows.filter((r) => r.id !== rowId) },
      ),
    );
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    updateReferenceSheet({ ...referenceSheet, mode: 'image', image: dataUrl });
  }

  function setXp(levelIndex: number, value: number) {
    const next = [...progressionConfig.xpToNextLevel];
    next[levelIndex] = value;
    updateProgressionConfig({ ...progressionConfig, xpToNextLevel: next });
  }

  function fillRemainingWith(value: number) {
    updateProgressionConfig({
      ...progressionConfig,
      xpToNextLevel: progressionConfig.xpToNextLevel.map(() => value),
    });
  }

  return (
    <div>
      <div className="section-tabs">
        <button className={`nav-tab ${tab === 'combat' ? 'active' : ''}`} onClick={() => setTab('combat')}>
          Боевая памятка
        </button>
        <button className={`nav-tab ${tab === 'progression' ? 'active' : ''}`} onClick={() => setTab('progression')}>
          Прогрессия уровней
        </button>
      </div>

      {tab === 'combat' && (
        <div>
          <div className="top-actions">
            <button
              className="btn"
              onClick={() => updateReferenceSheet({ ...referenceSheet, mode: 'structured' })}
            >
              Текстовый режим
            </button>
            <label className="btn">
              Загрузить как картинку/файл
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleImageUpload(e.target.files?.[0])}
              />
            </label>
          </div>

          {referenceSheet.mode === 'image' && referenceSheet.image && (
            <div className="card">
              <img src={referenceSheet.image} alt="Боевая памятка" className="item-image" />
            </div>
          )}

          {referenceSheet.mode === 'structured' &&
            referenceSheet.sections.map((section) => (
              <div className="card" key={section.id}>
                <div className="row">
                  <input
                    style={{ fontWeight: 600, fontSize: 15, border: 'none', background: 'transparent', flex: 1 }}
                    value={section.title}
                    onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                  />
                  <button className="btn btn-sm btn-danger" onClick={() => removeSection(section.id)}>
                    Удалить раздел
                  </button>
                </div>
                <table className="ref-table">
                  <thead>
                    <tr>
                      <th>Действие</th>
                      <th>Стоимость</th>
                      <th>Эффект</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input value={row.action} onChange={(e) => updateRow(section.id, row.id, 'action', e.target.value)} />
                        </td>
                        <td>
                          <input value={row.cost} onChange={(e) => updateRow(section.id, row.id, 'cost', e.target.value)} />
                        </td>
                        <td>
                          <input value={row.effect} onChange={(e) => updateRow(section.id, row.id, 'effect', e.target.value)} />
                        </td>
                        <td>
                          <button className="btn btn-sm btn-ghost" onClick={() => removeRow(section.id, row.id)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => addRow(section.id)}>
                  + строка
                </button>
              </div>
            ))}

          {referenceSheet.mode === 'structured' && (
            <button className="btn" onClick={addSection}>
              + раздел
            </button>
          )}
        </div>
      )}

      {tab === 'progression' && (
        <div className="card">
          <p className="muted">
            Точная формула прогрессии ещё не готова — заполните таблицу своими значениями, её можно менять
            в любой момент для баланса.
          </p>
          <div className="row">
            <div className="field" style={{ maxWidth: 200 }}>
              <label>Очков характеристик за уровень</label>
              <NumberField
                value={progressionConfig.pointsPerLevel}
                onChange={(v) => updateProgressionConfig({ ...progressionConfig, pointsPerLevel: v })}
              />
            </div>
            <div className="field" style={{ maxWidth: 200 }}>
              <label>Быстро заполнить все уровни</label>
              <NumberField value={bulkValue} onChange={setBulkValue} />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => fillRemainingWith(bulkValue)}>
                Применить ко всем
              </button>
            </div>
          </div>

          <div className="progression-table">
            <table className="ref-table">
              <thead>
                <tr>
                  <th>Уровень</th>
                  <th>Опыта до следующего</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i).map((i) => (
                  <tr key={i}>
                    <td>
                      {i + 1} → {i + 2}
                    </td>
                    <td>
                      <NumberField value={progressionConfig.xpToNextLevel[i] ?? 0} onChange={(v) => setXp(i, v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
