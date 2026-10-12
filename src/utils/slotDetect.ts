import type { SlotType } from '../types';

// Грубое определение слота по названию предмета (корни слов, любой падеж). Порядок важен:
// более специфичные корни раньше общих. Результат всегда можно поправить в карточке.
const SLOT_KEYWORDS: [RegExp, SlotType][] = [
  [/наплечник/, 'shoulders'],
  [/налокотник/, 'elbows'],
  [/наколенник/, 'knees'],
  [/набедренник/, 'thigh'],
  [/поножи|наголенник/, 'shins'],
  [/наруч/, 'bracers'],
  [/браслет/, 'bracelets'],
  [/перчатк|рукавиц/, 'gloves'],
  [/кольц|перстен/, 'rings'],
  [/серьг/, 'earrings'],
  [/амулет|кулон|ожерель|подвеск|талисман/, 'amulets'],
  [/плащ|накидк|мантия/, 'cloak'],
  [/очки|линз/, 'glasses'],
  [/шлем|шапк|капюшон|корона|диадем|маска|берет|шляп|убор/, 'headwear'],
  [/пояс|ремень/, 'belt'],
  [/ботин|сапог|обувь|туфл|кроссовк/, 'boots'],
  [/брон[яеи]|кираса|доспех|жилет|кольчуг|куртка|нагрудник/, 'armor'],
];

export function detectSlotType(name: string): SlotType | undefined {
  const lower = name.toLowerCase();
  return SLOT_KEYWORDS.find(([pattern]) => pattern.test(lower))?.[1];
}
