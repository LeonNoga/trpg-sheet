import { CURRENT_SCHEMA_VERSION } from './migrations';
import { statPointsBudget } from './progression';
import type { Character } from '../types';

/** Что показываем перед импортом: персонаж из файла и что с ним сделает перенос на актуальную схему. */
export interface ImportPreview {
  character: Character;
  /** Версия схемы в файле (у очень старых файлов — 0). */
  fileVersion: number;
  /** Что изменится при переносе на новую схему (пусто, если файл уже актуальной версии). */
  notes: string[];
}

// Данные из файла приходят в произвольной форме.
type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Понятное описание миграции: что в старом файле будет пересчитано или заполнено. */
export function migrationNotes(raw: Raw, normalized: Character): string[] {
  const version: number = raw.schemaVersion ?? 0;
  if (version >= CURRENT_SCHEMA_VERSION) return [];

  const notes = [`Файл создан в старой версии приложения (схема ${version}, текущая — ${CURRENT_SCHEMA_VERSION}). При загрузке он будет приведён к новой схеме:`];
  const diff = (label: string, before: unknown, after: unknown) => {
    if (before !== after) notes.push(`${label}: ${before ?? '—'} → ${after}`);
  };

  diff('Очки характеристик за уровни (пересчёт по формуле)', raw.levelPoints, normalized.levelPoints);
  diff('Награда мастера (доп. очки)', raw.bonusStatPoints, normalized.bonusStatPoints);
  diff('Сложность сопротивления считается по', raw.resistanceSource, normalized.resistanceSource);

  if (normalized.classRarity && raw.classLevel === undefined) {
    notes.push('Уровень получения класса не указан — пока считается с 10-го; укажите точный на вкладке «Доп. информация».');
  }
  notes.push('Недостающие разделы (прыжки, лут, жемчужины и др.) будут созданы пустыми; ваши данные не удаляются.');
  return notes;
}

export interface CompareRow {
  label: string;
  current: string;
  incoming: string;
  differs: boolean;
}

const stamp = (ms: number) =>
  new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Сравнение того, что уже есть в приложении, с тем, что пришло из файла. */
export function compareCharacters(current: Character, incoming: Character): { rows: CompareRow[]; incomingOlder: boolean } {
  const row = (label: string, a: string | number, b: string | number): CompareRow => ({
    label,
    current: String(a),
    incoming: String(b),
    differs: String(a) !== String(b),
  });
  return {
    rows: [
      row('Имя персонажа', current.characterName || '—', incoming.characterName || '—'),
      row('Игрок', current.playerName || '—', incoming.playerName || '—'),
      row('Уровень', current.level, incoming.level),
      row('Опыт', current.experience, incoming.experience),
      row('Очки характеристик (всего)', statPointsBudget(current), statPointsBudget(incoming)),
      row('Снаряжение', current.items.length, incoming.items.length),
      row('Умения', current.abilities.length, incoming.abilities.length),
      row('Записей в журнале', current.changeLog?.length ?? 0, incoming.changeLog?.length ?? 0),
      row('Последнее изменение', stamp(current.updatedAt), stamp(incoming.updatedAt)),
    ],
    incomingOlder: incoming.updatedAt < current.updatedAt,
  };
}
