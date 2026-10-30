export const GROUP_SIZE = 5;

const oneLine = (text: string) => text.replace(/[\r\n]+/g, ' ');

/**
 * Участники группы: ровно пять однострочных полей поверх прежнего строкового формата (одна строка на участника).
 * Старые записи длиннее пяти строк сворачиваются: всё, что дальше четвёртой строки, собирается в пятое поле через запятую.
 */
export function groupRows(value: string): string[] {
  const lines = value.split(/\r?\n/);
  const tail = lines.slice(GROUP_SIZE - 1).map((line) => line.trim()).filter(Boolean);
  return Array.from({ length: GROUP_SIZE }, (_, index) => (index === GROUP_SIZE - 1 ? tail.join(', ') : lines[index] ?? ''));
}

export function updateGroupRow(value: string, index: number, text: string): string {
  const rows = groupRows(value);
  rows[index] = oneLine(text);
  return rows.join('\n');
}
