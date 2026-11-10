import { useRef, useState } from 'react';
import {
  bonusLabel,
  ITEM_PATH_LABELS,
  RARITY_LABELS,
  RARITY_ORDER,
  SLOT_TYPES,
} from '../data/statsConfig';
import { fileToImageDataUrl } from '../utils/file';
import { fieldsForKind, itemsFromCard, parseCardFields, recognizeOnce } from '../utils/ocrCards';
import { BonusEditor } from './BonusEditor';
import { bonusSummary, suggestActiveBonuses } from '../data/effects';
import type { EquipItem, ItemPath, Path, SlotType } from '../types';

const ITEM_PATH_ORDER: ItemPath[] = ['none', 'genetic', 'magic', 'tech'];

interface Props {
  item: EquipItem;
  path?: Path;
  onSave: (item: EquipItem) => void;
  onCancel: () => void;
  /** Куда добавить вторую половину артефакта (умение к предмету или наоборот), когда карточка распознана как артефакт. */
  onCompanion?: (item: EquipItem) => void;
}

export function ItemEditor({ item, path, onSave, onCancel, onCompanion }: Props) {
  const [draft, setDraft] = useState<EquipItem>(item);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  // Вторая запись артефакта (умение для предмета и наоборот): создаётся вместе с этой при сохранении.
  const [companion, setCompanion] = useState<EquipItem | null>(null);
  const [createCompanion, setCreateCompanion] = useState(true);
  const suggested = draft.kind === 'ability' ? suggestActiveBonuses(draft.effect) : {};

  function updateField<K extends keyof EquipItem>(key: K, value: EquipItem[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
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
      const result = await recognizeOnce(draft.image);
      const text = result.text;
      if (text) {
        // Для артефакта берём ту часть карточки, которая соответствует редактируемой записи (предмет или способность).
        const cardFields = parseCardFields(result);
        const parsed = fieldsForKind(cardFields, draft.kind);
        if (cardFields.kind === 'artifact' && onCompanion) {
          // itemsFromCard сам решает, что артефакт даёт: умение всегда, предмет — если есть характеристики.
          const other = itemsFromCard(result, draft.image!, draft.name || 'Артефакт').find((i) => i.kind !== draft.kind);
          setCompanion(other ?? null);
          setCreateCompanion(true);
        } else {
          setCompanion(null);
        }
        const addition = parsed.effect ?? text;
        setDraft((d) => ({
          ...d,
          artifact: d.artifact || parsed.artifact || undefined,
          effect: d.effect ? `${d.effect}
${addition}` : addition,
          name: d.name || parsed.name || d.name,
          rarity: d.rarity ?? parsed.rarity,
          category: d.category || parsed.category,
          level: d.level ?? parsed.level,
          path: d.path && d.path !== 'none' ? d.path : (parsed.path ?? d.path),
          slot: d.slot ?? parsed.slot,
          flavorText: d.flavorText || parsed.flavorText,
          activation: d.activation || parsed.activation,
          cooldown: d.cooldown || parsed.cooldown,
          cast: d.cast || parsed.cast,
          duration: d.duration || parsed.duration,
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
        {draft.kind === 'item' && (
          <div className="field">
            <label>Тип снаряжения (слот)</label>
            <select
              value={draft.slot ?? ''}
              onChange={(e) => updateField('slot', (e.target.value || undefined) as SlotType | undefined)}
              title="Только описывает предмет — в слот он не надевается, пока вы не выберете его на схеме"
            >
              <option value="">Без слота</option>
              {SLOT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field" style={{ maxWidth: 140 }}>
          <label>Артефакт</label>
          <label className="toggle" title="Артефактные умения попадают в список «Артефактные …» на вкладке персонажа">
            <input
              type="checkbox"
              checked={!!draft.artifact}
              onChange={(e) => updateField('artifact', e.target.checked || undefined)}
            />
            {draft.kind === 'ability' ? 'от артефакта' : 'это артефакт'}
          </label>
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
        <div className="row">
          <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} />
          <button type="button" className="btn btn-sm" onClick={() => camera.current?.click()}>
            Сфотографировать
          </button>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => handleImage(e.target.files?.[0])}
          />
        </div>
        {draft.image && (
          <>
            <img src={draft.image} alt="" className="item-image" style={{ maxHeight: 160 }} />
            <button type="button" className="btn btn-sm" disabled={ocrBusy} onClick={handleRecognizeText} style={{ marginTop: 6 }}>
              {ocrBusy ? 'Распознаём (офлайн)...' : 'Распознать текст с фото'}
            </button>
            {ocrError && <p className="error-text">{ocrError}</p>}
            {companion && (
              <label className="toggle" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={createCompanion} onChange={(e) => setCreateCompanion(e.target.checked)} />
                Это артефакт: при сохранении создать ещё и {companion.kind === 'ability' ? 'умение' : 'предмет'} «{companion.name}»
              </label>
            )}
          </>
        )}
      </div>

      <div className="field">
        <label>Бонусы к характеристикам/показателям</label>
        <BonusEditor value={draft.statBonuses} onChange={(statBonuses) => updateField('statBonuses', statBonuses)} path={path} />
      </div>

      {draft.kind === 'ability' && (
        <div className="field">
          <label>Бонус при активации (временный эффект)</label>
          <p className="muted" style={{ margin: '0 0 6px' }}>
            Действует после применения умения и сам исчезает по длительности из карточки. Штраф — со знаком «−».
          </p>
          <BonusEditor
            value={draft.activeBonuses ?? {}}
            onChange={(activeBonuses) => updateField('activeBonuses', activeBonuses)}
            path={path}
            addLabel="+ бонус при активации"
          />
          {Object.keys(suggested).length > 0 && Object.keys(draft.activeBonuses ?? {}).length === 0 && (
            <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 6 }} onClick={() => updateField('activeBonuses', suggested)}>
              Подставить из описания: {bonusSummary(suggested, (k) => bonusLabel(k, path))}
            </button>
          )}
        </div>
      )}

      <div className="item-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            onSave(draft);
            if (companion && createCompanion) onCompanion?.(companion);
          }}
          disabled={!draft.name.trim()}
        >
          Сохранить
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
