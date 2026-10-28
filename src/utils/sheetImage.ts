import magicTemplate from '../assets/templates/magic.png';
import geneticTemplate from '../assets/templates/genetic.png';
import techTemplate from '../assets/templates/tech.png';
import page2Template from '../assets/templates/page2.png';
import page3Template from '../assets/templates/page3.png';
import { classBonusLines, SKILLS } from '../data/statsConfig';
import { statPointsBudget } from '../data/progression';
import { bonusSum, computeDerivedStats, modifier, sumBaseStats, totalStat } from '../data/formulas';
import type { Character, Path, StatKey } from '../types';

// Рендер карточки «как на бумаге»: поверх шаблона листа 2000×1413 пишутся значения в нужных местах.
// Все координаты — в пикселях шаблона; шаблоны трёх путей совпадают по раскладке (отличаются подписями).

const TEMPLATES: Record<Path, string> = { magic: magicTemplate, genetic: geneticTemplate, tech: techTemplate };
const INK = '#1c2f78';
const WIDTH = 2000;
const HEIGHT = 1413;

// Строки «+ =» у характеристик: y центральной линии; база слева от «+», предметы между «+» и «=», итог справа.
const STAT_ROWS: { stat: StatKey; y: number }[] = [
  { stat: 'vitality', y: 328 },
  { stat: 'fortitude', y: 468 },
  { stat: 'agility', y: 610 },
  { stat: 'perception', y: 752 },
  { stat: 'intellect', y: 895 },
  { stat: 'strength', y: 1038 },
  { stat: 'endurance', y: 1180 },
  { stat: 'resource', y: 1322 },
];
const STAT_X = { base: 580, items: 672, total: 770, mod: 886 };

// Ряды навыков (центры кружков) — в порядке SKILLS; у «Дальнобойное оружие» и «Огнестрельное оружие» название в две строки.
const SKILL_ROWS = [243, 286, 329, 372, 414, 458, 500, 587, 630, 672, 714, 760, 803, 845, 885, 928, 1015, 1058, 1100, 1142, 1185, 1228, 1270, 1313, 1355];
const SKILL_CIRCLES = [
  { level: 15, x: 1435 },
  { level: 10, x: 1503 },
  { level: 5, x: 1570 },
];

// Списки слева: y подчёркивания строки.
const LIST_A_LINES = [588, 635, 683, 730, 778];
const LIST_B_LINES = [873, 920, 967, 1015, 1062];
const BONUS_LINES = [303, 352, 401, 448];

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить шаблон листа.'));
    img.src = src;
  });
}

interface TextOptions {
  size?: number;
  align?: CanvasTextAlign;
  bold?: boolean;
  maxWidth?: number;
  baseline?: CanvasTextBaseline;
}

/** Пишет текст; если не помещается в maxWidth — сначала уменьшает шрифт (до 14px), затем обрезает многоточием. */
function drawText(ctx: CanvasRenderingContext2D, value: string | number, x: number, y: number, o: TextOptions = {}) {
  let text = String(value);
  if (!text) return;
  let size = o.size ?? 34;
  const font = (px: number) => `${o.bold ? '700 ' : '500 '}${px}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font(size);
  if (o.maxWidth) {
    while (ctx.measureText(text).width > o.maxWidth && size > 14) {
      size -= 1;
      ctx.font = font(size);
    }
    while (ctx.measureText(text).width > o.maxWidth && text.length > 1) text = text.slice(0, -2) + '…';
  }
  ctx.fillStyle = INK;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  ctx.fillText(text, x, y);
}

/** Короткие формулировки фиксированных бонусов класса — на листе всего 4 строки по ~450 px. */
function shortBonusLines(character: Character): string[] {
  const from = Math.max(10, character.classLevel ?? 10);
  const rate = classBonusLines(character.classRarity, character.uniqueLevelPoints, character.classLevel)[0];
  const points = character.classRarity ? `Очки хар-к: +2 до ${from}-го ур., затем ${rate.split('дальше ')[1] ?? ''}` : 'Очки характеристик: +2 за уровень';
  return [points, 'Откат классовых способностей ↓', 'Стоимость классовых умений −50%'];
}

async function startPage(templateUrl: string) {
  const template = await loadImage(templateUrl);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(template, 0, 0, WIDTH, HEIGHT);
  return { canvas, ctx };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось создать картинку.'))), 'image/png'),
  );
}

/** Лист 1: характеристики, показатели, навыки, списки умений. */
async function renderMainPage(character: Character): Promise<Blob> {
  const { canvas, ctx } = await startPage(TEMPLATES[character.path]);

  // Шапка
  drawText(ctx, character.characterName, 142, 124, { size: 40, maxWidth: 820 });
  drawText(ctx, character.species, 158, 183, { size: 38, maxWidth: 430 });
  drawText(ctx, character.level, 898, 183, { size: 40, align: 'center' });
  drawText(ctx, character.experience, 1185, 66, { size: 44, maxWidth: 760 });

  // Левая колонка: бонусы и списки
  const bonuses = [...shortBonusLines(character), ...character.speciesBonuses.slots.filter((s) => s.trim())];
  bonuses.slice(0, BONUS_LINES.length).forEach((line, i) => drawText(ctx, line, 40, BONUS_LINES[i] - 12, { size: 26, maxWidth: 440 }));
  character.dnaLists[0]?.slots.slice(0, 5).forEach((line, i) => drawText(ctx, line, 88, LIST_A_LINES[i] - 14, { size: 30, maxWidth: 395 }));
  character.dnaLists[1]?.slots.slice(0, 5).forEach((line, i) => drawText(ctx, line, 88, LIST_B_LINES[i] - 14, { size: 30, maxWidth: 395 }));

  // Характеристики: база + предметы = итог, и модификатор в сером блоке
  for (const { stat, y } of STAT_ROWS) {
    const base = character.baseStats[stat];
    const items = bonusSum(character, stat);
    const total = totalStat(character, stat);
    drawText(ctx, base, STAT_X.base, y, { size: 34, align: 'center' });
    drawText(ctx, items === 0 ? 0 : signed(items), STAT_X.items, y, { size: 34, align: 'center' });
    drawText(ctx, total, STAT_X.total, y, { size: 34, align: 'center' });
    drawText(ctx, signed(modifier(total)), STAT_X.mod, y - 28, { size: 50, align: 'center', bold: true });
  }
  // Мудрость и Харизма: одно значение под названием и модификатор справа
  for (const [stat, valueY, modY] of [['wisdom', 1176, 1152], ['charisma', 1316, 1295]] as const) {
    const total = totalStat(character, stat);
    drawText(ctx, total, 1135, valueY, { size: 38, align: 'center' });
    drawText(ctx, signed(modifier(total)), 1303, modY, { size: 50, align: 'center', bold: true });
  }

  // Показатели
  const derived = computeDerivedStats(character);
  drawText(ctx, derived.hp, 1082, 328, { size: 34, align: 'center' });
  drawText(ctx, character.pools.hp, 1245, 328, { size: 38, align: 'center' });
  drawText(ctx, derived.defense, 1305, 447, { size: 52, align: 'center', bold: true });
  drawText(ctx, derived.speed, 1080, 585, { size: 52, align: 'center', bold: true });
  drawText(ctx, derived.passivePerception, 1300, 731, { size: 52, align: 'center', bold: true });
  drawText(ctx, signed(derived.initiative), 1075, 866, { size: 50, align: 'center', bold: true });
  drawText(ctx, derived.resistance, 1303, 1026, { size: 52, align: 'center', bold: true });
  // Пулы: слева — максимум (по формуле), в сером поле — текущее значение
  drawText(ctx, derived.staminaPoints, 100, 1182, { size: 36, align: 'center' });
  drawText(ctx, character.pools.staminaPoints, 312, 1182, { size: 38, align: 'center' });
  drawText(ctx, derived.resourcePoints, 100, 1324, { size: 36, align: 'center' });
  drawText(ctx, character.pools.resourcePoints, 312, 1324, { size: 38, align: 'center' });

  // Навыки: закрашены все степени до текущей, как в приложении
  SKILLS.forEach((skill, i) => {
    const level = character.skills[skill] ?? 0;
    for (const circle of SKILL_CIRCLES) {
      if (level < circle.level) continue;
      ctx.beginPath();
      ctx.arc(circle.x, SKILL_ROWS[i], 13, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  });

  return toBlob(canvas);
}

// ---------- Лист 2: доп. информация ----------

const LINE_PITCH = 47.6;
const range = (start: number, count: number) => Array.from({ length: count }, (_, i) => Math.round(start + i * LINE_PITCH));

const WEAPON_LINES = range(759, 14); // «Системное оружие»
const GEAR_LINES = range(137, 27); // «Системное снаряжение»
const NOTES_LINES = range(567, 18); // «Заметки»
const NOTES_OVERFLOW_LINES = range(92, 28); // правая колонка — продолжение заметок

/** Переносит текст по словам в строки не шире maxWidth (с учётом абзацев). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number): string[] {
  ctx.font = `500 ${size}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const attempt = current ? `${current} ${word}` : word;
      if (ctx.measureText(attempt).width <= maxWidth || !current) current = attempt;
      else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = 9;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

async function renderExtraPage(character: Character): Promise<Blob> {
  const { canvas, ctx } = await startPage(page2Template);

  // Группа, очки
  drawText(ctx, character.group, 208, 70, { size: 34, maxWidth: 270 });
  drawText(ctx, `${sumBaseStats(character)}/${statPointsBudget(character)}`, 92, 410, { size: 32, align: 'center', maxWidth: 120 });
  drawText(ctx, character.points, 92, 507, { size: 38, align: 'center', maxWidth: 120 });
  drawText(ctx, character.developmentPoints, 92, 587, { size: 38, align: 'center', maxWidth: 120 });

  // Системное оружие / снаряжение — построчно
  character.systemWeapons.slots
    .filter((s) => s.trim())
    .slice(0, WEAPON_LINES.length)
    .forEach((line, i) => drawText(ctx, line, 56, WEAPON_LINES[i] - 17, { size: 27, maxWidth: 430 }));
  character.systemGear.slots
    .filter((s) => s.trim())
    .slice(0, GEAR_LINES.length)
    .forEach((line, i) => drawText(ctx, line, 540, GEAR_LINES[i] - 17, { size: 27, maxWidth: 372 }));

  // Очки вдохновения: сколько отмечено
  const inspiration = character.inspirationPoints.filter(Boolean).length;
  if (character.inspirationPoints.length > 0) {
    drawText(ctx, `${inspiration}`, 1435, 68, { size: 46, align: 'center', bold: true });
  }

  // Статус заражения: кольцо вокруг отмеченных значков
  const columns = [1168, 1290, 1410];
  character.infectionStatus.success.forEach((on, i) => on && drawRing(ctx, columns[i], 262, 50));
  character.infectionStatus.fail.forEach((on, i) => on && drawRing(ctx, columns[i], 385, 50));

  // Заметки: сначала в блок «Заметки», остаток — в правую колонку
  const notes = character.notes.trim();
  if (notes) {
    const first = wrapText(ctx, notes, 372, 27);
    first.slice(0, NOTES_LINES.length).forEach((line, i) => drawText(ctx, line, 1088, NOTES_LINES[i] - 17, { size: 27 }));
    const rest = first.slice(NOTES_LINES.length).join(' ');
    if (rest.trim()) {
      wrapText(ctx, rest, 432, 27)
        .slice(0, NOTES_OVERFLOW_LINES.length)
        .forEach((line, i) => drawText(ctx, line, 1513, NOTES_OVERFLOW_LINES[i] - 17, { size: 27 }));
    }
  }

  return toBlob(canvas);
}

// ---------- Лист 3: экипировка ----------

interface SlotBox {
  /** Ключ слота схемы экипировки. */
  key: string;
  x: number;
  /** Центры строк внутри рамки. */
  ys: number[];
  width: number;
}

const ringYs = [790, 818, 846, 875, 903];
const handYs = [1213, 1261, 1309];

const SLOT_BOXES: SlotBox[] = [
  { key: 'glasses', x: 655, ys: [86], width: 195 },
  { key: 'headwear', x: 900, ys: [86], width: 195 },
  { key: 'earrings', x: 1170, ys: [93, 121, 149, 176], width: 168 },
  { key: 'cloak', x: 620, ys: [168], width: 195 },
  { key: 'amulets', x: 1220, ys: [262, 290, 318], width: 170 },
  { key: 'shoulders', x: 587, ys: [248], width: 195 },
  { key: 'armor', x: 1247, ys: [400], width: 195 },
  { key: 'elbows', x: 555, ys: [333], width: 195 },
  { key: 'belt', x: 1247, ys: [482], width: 195 },
  { key: 'bracers', x: 555, ys: [416], width: 195 },
  { key: 'gloves', x: 1247, ys: [566], width: 195 },
  { key: 'bracelets', x: 585, ys: [503, 531, 559, 587], width: 165 },
  { key: 'ringsLeft', x: 580, ys: ringYs, width: 165 },
  { key: 'thigh', x: 555, ys: [992], width: 195 },
  { key: 'shins', x: 555, ys: [1068], width: 195 },
  { key: 'ringsRight', x: 1275, ys: ringYs, width: 165 },
  { key: 'knees', x: 1247, ys: [992], width: 195 },
  { key: 'boots', x: 1247, ys: [1068], width: 195 },
  { key: 'handR', x: 552, ys: handYs, width: 425 },
  { key: 'handL', x: 1018, ys: handYs, width: 425 },
];

const INVENTORY_LINES = range(92, 27);

async function renderEquipmentPage(character: Character): Promise<Blob> {
  const { canvas, ctx } = await startPage(page3Template);
  const itemName = (id: string) => character.items.find((i) => i.id === id)?.name;
  const placed = new Set<string>();

  for (const box of SLOT_BOXES) {
    const ids = character.equippedSlots[box.key] ?? [];
    const names = ids.map((id) => {
      placed.add(id);
      return itemName(id);
    }).filter((n): n is string => !!n);
    if (names.length === 0) continue;
    if (box.ys.length === 1) {
      // Одна строка в рамке: несколько предметов перечисляем через запятую (шрифт сам уменьшится).
      drawText(ctx, names.join(', '), box.x, box.ys[0], { size: 24, maxWidth: box.width });
    } else {
      names.slice(0, box.ys.length).forEach((name, i) => drawText(ctx, name, box.x, box.ys[i], { size: 24, maxWidth: box.width }));
    }
  }

  // Остальные предметы (не стоящие в слотах) — списком в боковых колонках: сначала левая, затем правая.
  const rest = character.items.filter((i) => !placed.has(i.id) && i.name.trim());
  const perColumn = INVENTORY_LINES.length;
  rest.slice(0, perColumn).forEach((item, i) =>
    drawText(ctx, item.name, 66, INVENTORY_LINES[i] - 17, { size: 27, maxWidth: 430 }),
  );
  rest.slice(perColumn, perColumn * 2).forEach((item, i) =>
    drawText(ctx, item.name, 1500, INVENTORY_LINES[i] - 17, { size: 27, maxWidth: 430 }),
  );

  return toBlob(canvas);
}

/** Все три листа бумажной карточки: основной, дополнительная информация и экипировка. */
export async function renderSheetPages(character: Character): Promise<Blob[]> {
  return [await renderMainPage(character), await renderExtraPage(character), await renderEquipmentPage(character)];
}
