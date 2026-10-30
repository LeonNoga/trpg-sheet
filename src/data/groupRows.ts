/** Keep the legacy string format and retain overflow in the fifth field. */
export function groupRows(value: string): string[] {
  const lines = value.split(/\r?\n/);
  return Array.from({ length: 5 }, (_, index) => index === 4 ? lines.slice(4).join('\n') : lines[index] ?? '');
}

export function updateGroupRow(value: string, index: number, text: string): string {
  const rows = groupRows(value);
  rows[index] = text;
  return rows.join('\n');
}
