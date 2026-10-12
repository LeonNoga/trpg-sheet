export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface AbilityGrid {
  activation?: string;
  cooldown?: string;
  cast?: string;
  duration?: string;
}

/** Слова из TSV-вывода Tesseract (уровень 5 — отдельные слова) с координатами. */
export function wordsFromTsv(tsv: string): OcrWord[] {
  return tsv
    .split('\n')
    .slice(1)
    .map((line) => line.split('\t'))
    .filter((c) => c.length >= 12 && c[0] === '5' && c[11].trim() !== '')
    .map((c) => ({
      text: c[11].trim(),
      x0: Number(c[6]),
      y0: Number(c[7]),
      x1: Number(c[6]) + Number(c[8]),
      y1: Number(c[7]) + Number(c[9]),
    }));
}

const cy = (w: OcrWord) => (w.y0 + w.y1) / 2;
const cx = (w: OcrWord) => (w.x0 + w.x1) / 2;

function findLabel(words: OcrWord[], pattern: RegExp): OcrWord | undefined {
  // Самая нижняя подходящая подпись: слово «активация» может встретиться и в тексте эффекта выше.
  return words.filter((w) => pattern.test(w.text.toUpperCase())).sort((a, b) => b.y0 - a.y0)[0];
}

/** Собирает слова в строки по вертикали и склеивает слева направо. */
function joinWords(words: OcrWord[]): string {
  if (words.length === 0) return '';
  const heights = words.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  const lineTolerance = Math.max(8, heights[Math.floor(heights.length / 2)] * 0.6);

  const sorted = [...words].sort((a, b) => cy(a) - cy(b));
  const lines: OcrWord[][] = [];
  for (const w of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(cy(w) - cy(last[0])) <= lineTolerance) last.push(w);
    else lines.push([w]);
  }
  return lines
    .map((line) => line.sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Самый широкий горизонтальный просвет между словами в диапазоне [from, to] — граница колонок. */
function widestGapCenter(words: OcrWord[], from: number, to: number): number | null {
  const spans = words
    .filter((w) => w.x1 > from && w.x0 < to)
    .map((w) => [Math.max(w.x0, from), Math.min(w.x1, to)] as const)
    .sort((a, b) => a[0] - b[0]);

  let best: { size: number; center: number } | null = null;
  let covered = from;
  for (const [s, e] of spans) {
    if (s - covered > (best?.size ?? 0)) best = { size: s - covered, center: (s + covered) / 2 };
    covered = Math.max(covered, e);
  }
  if (to - covered > (best?.size ?? 0)) best = { size: to - covered, center: (to + covered) / 2 };
  return best && best.size >= 6 ? best.center : null;
}

/**
 * На карточках умений внизу сетка 2×2: «Активация | Откат» и «Каст | Длительность».
 * Обычный OCR склеивает колонки в одну строку, поэтому разбираем по координатам слов:
 * находим подписи, определяем границу колонок по самому широкому просвету между текстами,
 * и собираем слова каждой ячейки отдельно.
 */
export function extractAbilityGrid(words: OcrWord[]): AbilityGrid {
  const activation = findLabel(words, /АКТИВАЦ/);
  const cooldown = findLabel(words, /ОТКАТ/);
  const cast = findLabel(words, /^\W*КАСТ/);
  const duration = findLabel(words, /ДЛИТ/);
  const result: AbilityGrid = {};

  if (!activation || !cooldown) return result;

  const row1Top = Math.max(activation.y1, cooldown.y1);
  const row2Labels = cast && duration && cast.y0 > row1Top ? { top: Math.min(cast.y0, duration.y0), bottom: Math.max(cast.y1, duration.y1) } : null;
  const below = words.filter((w) => cy(w) > row1Top);

  // Колонки: просвет между текстом левой и правой ячеек; запасной вариант — левее правой подписи на ширину иконки.
  const labelHeight = activation.y1 - activation.y0;
  const gap = widestGapCenter(below, Math.min(activation.x0, cooldown.x0), Math.max(activation.x0, cooldown.x0));
  const split = gap ?? Math.max(activation.x0, cooldown.x0) - labelHeight * 2.5;

  const cell = (rowFrom: number, rowTo: number, right: boolean) =>
    joinWords(below.filter((w) => cy(w) > rowFrom && cy(w) < rowTo && (cx(w) >= split) === right));

  const row1To = row2Labels ? row2Labels.top : Infinity;
  const act = cell(row1Top, row1To, false);
  const cool = cell(row1Top, row1To, true);
  if (act) result.activation = act;
  if (cool) result.cooldown = cool;

  if (row2Labels) {
    const c = cell(row2Labels.bottom, Infinity, false);
    const d = cell(row2Labels.bottom, Infinity, true);
    if (c) result.cast = c;
    if (d) result.duration = d;
  }

  return result;
}
