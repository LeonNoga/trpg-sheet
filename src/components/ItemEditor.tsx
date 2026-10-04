import { useState } from 'react';
import { ALL_BONUS_KEYS, bonusLabel, ITEM_PATH_LABELS, RARITY_LABELS, RARITY_ORDER } from '../data/statsConfig';
import { fileToImageDataUrl } from '../utils/file';
import { parseCardText } from '../utils/ocrParse';
import { NumberField } from './NumberField';
import type { BonusKey, EquipItem, ItemPath, Path } from '../types';

const ITEM_PATH_ORDER: ItemPath[] = ['none', 'genetic', 'magic', 'tech'];

interface Props {
  item: EquipItem;
  path?: Path;
  onSave: (item: EquipItem) => void;
  onCancel: () => void;
}

export function ItemEditor({ item, path, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<EquipItem>(item);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const bonusEntries = Object.entries(draft.statBonuses) as [BonusKey, number][];

  function updateField<K extends keyof EquipItem>(key: K, value: EquipItem[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function addBonusRow() {
    const used = new Set(bonusEntries.map(([k]) => k));
    const next = ALL_BONUS_KEYS.find((k) => !used.has(k)) ?? ALL_BONUS_KEYS[0];
    setDraft((d) => ({ ...d, statBonuses: { ...d.statBonuses, [next]: 1 } }));
  }

  function changeBonusKey(oldKey: BonusKey, newKey: BonusKey) {
    setDraft((d) => {
      const { [oldKey]: value, ...rest } = d.statBonuses;
      return { ...d, statBonuses: { ...rest, [newKey]: value ?? 0 } };
    });
  }

  function changeBonusValue(key: BonusKey, value: number) {
    setDraft((d) => ({ ...d, statBonuses: { ...d.statBonuses, [key]: value } }));
  }

  function removeBonusRow(key: BonusKey) {
    setDraft((d) => {
      const { [key]: _removed, ...rest } = d.statBonuses;
      return { ...d, statBonuses: rest };
    });
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    const dataUrl = await fileToImageDataUrl(file);
    updateField('image', dataUrl);
  }

  async function handleRecognizeText() {
    if (!draft.image) return;
    setOcrBusy(true);
    setOcrError(null);
    try {
      const { recognize } = await import('tesseract.js');
      const result = await recognize(draft.image, 'rus+eng');
      const text = result.data.text.trim();
      if (text) {
        const parsed = parseCardText(text);
        setDraft((d) => ({
          ...d,
          effect: d.effect ? `${d.effect}\n${text}` : text,
          name: d.name || parsed.name || d.name,
          rarity: d.rarity ?? parsed.rarity,
          category: d.category || parsed.category,
          level: d.level ?? parsed.level,
          path: d.path && d.path !== 'none' ? d.path : (parsed.path ?? d.path),
          flavorText: d.flavorText || parsed.flavorText,
          statBonuses: { ...parsed.statBonuses, ...d.statBonuses },
        }));
      }
    } catch (err) {
      setOcrError('Не удалось распознать текст. Попробуйте фото почётче.');
      console.error(err);
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <div className="field">
          <label>Название</label>
          <input value={draft.name} onChange={(e) => updateField('name', e.target.value)} />
        </div>
        <div className="field">
          <label>Редкость</label>
          <select
            value={draft.rarity ?? ''}
            onChange={(e) => updateField('rarity', (e.target.value || undefined) as EquipItem['rarity'])}
          >
            <option value="">—</option>
            {RARITY_ORDER.map((r) => (
              <option key={r} value={r}>
                {RARITY_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {draft.kind === 'ability' && (
          <div className="field">
            <label>Категория</label>
            <input value={draft.category ?? ''} onChange={(e) => updateField('category', e.target.value)} />
          </div>
        )}
        <div className="field">
          <label>Путь</label>
          <select value={draft.path ?? 'none'} onChange={(e) => updateField('path', e.target.value as ItemPath)}>
            {ITEM_PATH_ORDER.map((p) => (
              <option key={p} value={p}>
                {ITEM_PATH_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 100 }}>
          <label>Уровень</label>
          <input
            type="number"
            value={draft.level ?? ''}
            onChange={(e) => updateField('level', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div className="field">
        <label>Описание (курсив-флейвор)</label>
        <textarea value={draft.flavorText ?? ''} onChange={(e) => updateField('flavorText', e.target.value)} />
      </div>

      <div className="field">
        <label>Эффект</label>
        <textarea value={draft.effect ?? ''} onChange={(e) => updateField('effect', e.target.value)} />
      </div>

      {draft.kind === 'ability' && (
        <div className="row">
          <div className="field">
            <label>Активация</label>
            <input value={draft.activation ?? ''} onChange={(e) => updateField('activation', e.target.value)} />
          </div>
          <div className="field">
            <label>Откат</label>
            <input value={draft.cooldown ?? ''} onChange={(e) => updateField('cooldown', e.target.value)} />
          </div>
          <div className="field">
            <label>Каст</label>
            <input value={draft.cast ?? ''} onChange={(e) => updateField('cast', e.target.value)} />
          </div>
          <div className="field">
            <label>Длительность</label>
            <input value={draft.duration ?? ''} onChange={(e) => updateField('duration', e.target.value)} />
          </div>
        </div>
      )}

      <div className="field">
        <label>Фото (необязательно)</label>
        <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} />
        {draft.image && (
          <>
            <img src={draft.image} alt="" className="item-image" style={{ maxHeight: 160 }} />
            <button type="button" className="btn btn-sm" disabled={ocrBusy} onClick={handleRecognizeText} style={{ marginTop: 6 }}>
              {ocrBusy ? 'Распознаём (офлайн)...' : 'Распознать текст с фото'}
            </button>
            {ocrError && <p className="error-text">{ocrError}</p>}
          </>
        )}
      </div>

      <div className="field">
        <label>Бонусы к характеристикам/показателям</label>
        {bonusEntries.map(([key, value]) => (
          <div className="row" key={key} style={{ marginBottom: 4 }}>
            <select value={key} onChange={(e) => changeBonusKey(key, e.target.value as BonusKey)}>
              {ALL_BONUS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {bonusLabel(k, path)}
                </option>
              ))}
            </select>
            <NumberField style={{ maxWidth: 90 }} value={value} onChange={(v) => changeBonusValue(key, v)} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeBonusRow(key)}>
              Убрать
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={addBonusRow}>
          + бонус
        </button>
      </div>

      <div className="item-actions">
        <button className="btn btn-primary" onClick={() => onSave(draft)} disabled={!draft.name.trim()}>
          Сохранить
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
