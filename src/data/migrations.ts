import { STARTING_STAT_POINTS } from './statsConfig';
import type { Character } from '../types';

/**
 * Версия схемы карточки персонажа. При любом несовместимом изменении формата данных:
 * 1) увеличить число, 2) добавить миграцию из предыдущей версии в MIGRATIONS.
 * Миграции выполняются по цепочке при загрузке из IndexedDB и при импорте файла.
 */
export const CURRENT_SCHEMA_VERSION = 1;

// Данные из старых версий приходят в произвольной форме, поэтому здесь свободная типизация.
type RawCharacter = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const MIGRATIONS: Record<number, (raw: RawCharacter) => RawCharacter> = {
  // 0 → 1: все изменения формата до введения номера версии.
  0: (raw) => {
    const { statPointsBudget: legacyBudget, keyStat, ...rest } = raw;
    const level: number = rest.level ?? 1;
    return {
      ...rest,
      // Раньше бюджет хранился числом; всё, что сверх 100 + 2 за уровень, переезжает в «награду мастера».
      levelPoints: rest.levelPoints ?? 2 * (level - 1),
      bonusStatPoints:
        rest.bonusStatPoints ??
        (legacyBudget !== undefined ? legacyBudget - (STARTING_STAT_POINTS + 2 * (level - 1)) : 0),
      resistanceSource: rest.resistanceSource ?? keyStat ?? 'auto',
      // Три пустые строки старых карточек заменены неизменяемыми бонусами класса — пустые убираем, записанное сохраняем.
      speciesBonuses:
        rest.speciesBonuses && rest.speciesBonuses.slots?.some((s: string) => s.trim())
          ? rest.speciesBonuses
          : rest.speciesBonuses
            ? { ...rest.speciesBonuses, slots: [] }
            : undefined,
    };
  },
};

/** Приводит данные любой старой версии к текущей схеме (без заполнения недостающих полей — это делает normalizeCharacter). */
export function migrateCharacter(raw: Character): Character {
  let data = raw as unknown as RawCharacter;
  let version: number = data.schemaVersion ?? 0;
  while (version < CURRENT_SCHEMA_VERSION) {
    data = MIGRATIONS[version](data);
    version += 1;
  }
  return { ...data, schemaVersion: CURRENT_SCHEMA_VERSION } as unknown as Character;
}

/** Данные созданы более новой версией приложения, чем эта (импорт файла от игрока с обновлённой версией). */
export function isFromNewerSchema(raw: { schemaVersion?: number }): boolean {
  return (raw.schemaVersion ?? 0) > CURRENT_SCHEMA_VERSION;
}
