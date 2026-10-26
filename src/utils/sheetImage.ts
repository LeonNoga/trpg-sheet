import magicTemplate from '../assets/templates/magic.png';
import geneticTemplate from '../assets/templates/genetic.png';
import techTemplate from '../assets/templates/tech.png';
import { classBonusLines, SKILLS } from '../data/statsConfig';
import { bonusSum, computeDerivedStats, modifier, totalStat } from '../data/formulas';
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
  const [points] = classBonusLines(character.classRarity, character.uniqueLevelPoints);
  return [points.replace('Бонус очков характеристик', 'Очки характеристик'), 'Откат классовых способностей ↓', 'Стоимость классовых умений −50%'];
}

export async function renderSheetPage(character: Character): Promise<Blob> {
  const template = await loadImage(TEMPLATES[character.path]);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(template, 0, 0, WIDTH, HEIGHT);

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

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось создать картинку.'))), 'image/png'));
}
