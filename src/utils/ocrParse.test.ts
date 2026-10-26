import { describe, expect, it } from 'vitest';
import { parseCardText, slotFromLabel } from './ocrParse';

// Эталонные тексты — то, что реально выдал Tesseract на фото/скриншотах карточек (с характерными ошибками распознавания).
// Если правите парсер, эти карточки должны продолжать разбираться так же.

const ARMOR_SCREENSHOT = `ЭПИЧЕСКАЯ
Костяной латный доспех
Генетический путь * Уровень 1
"Доспех, сформированный из сросшихся ребер гигантского
реликтового монстра. "
® Защита: 12 ПЗ
+ Даёт +29 к Силе, +15 к Восприятию.`;

const SKIN_PHOTO = `" yd „
) Lo
| НЕОБЫЧНАЯ
а | Шкура Исполина
Генетический путь * Уровень 1
Невероятно толстая и грубая шкура реликтового
лесного хищника. Под тонкой кожей виден сложный
рисунок кровеносных сосудов и капилляров.
© Защита: 5 ПЗ
+ Даёт +10 к Выносливости, +5 к Силе.`;

const SHIRT_PHOTO_PRIMARY = `| ОБЫЧНАЯ
Кольчужная рубаха
® Защита: 21 ПЗ
+4 Даёт +9 к Выносливости.`;

// Второй проход (локальная бинаризация) — читает бледные строки, но теряет плашку редкости.
const SHIRT_PHOTO_FAINT = `Кольчужная рубаха
Генетический путь « Уровень 1
"Рубаха мелкого кольчужного плетения, не сковывающая
движений. При контакте с кожей предмет кажется
теплым и живым."
Защита: 21 ПЗ
Даёт +9 к Выносливости.`;

const CLAWS = `АРТЕФАКТ + НЕОБЫЧНАЯ
Когти хищника
Генетический путь * Слот: Руки
«Выдвижные когтевые импланты над костяшками. Хват
привыкает к ладони так плотно, что предмет
перестаёт ощущаться чужим. Поверхность гладкая, как
полированная кость. Плоть образца растёт вокруг
мутации «Хищные охотничьи когти».»
. Вложенная ДНК-способность «Хищные
охотничьи когти» (Необычная)
Безоружные атаки когтями рук или передних лап
(навык Драка) наносят режущий урон в размере 1d6 +
модификатор Силы и полностью игнорируют до 2
единиц ПЗ брони. Вы получаете постоянный бонус +2 к
проверкам Атлетики при лазании.
4 АКТИВАЦИЯ У ОТКАТ
Не требует затрат. Отсутствует
@ КАСТ E длитЕЛЬНОСТЬ
Мгновенно. Постоянно.
< Свойства: +10 к Силе и +5 к Ловкости.`;

const DOME = `АРТЕФАКТ . НЕОБЫЧНАЯ
Плазменный купол-щит
Технологический путь * Слот: Щит
«Складной эмиттер, разворачивающий дрожащую
плазменную плёнку. Разворот предмета раскрывает
защитную плоскость ровно на ширину
владельца. Стендовые испытания предмета состояли из
одного пункта: стабильность «Живой щит \\"Перехват\\"».
. Вложенная технология «Живой щит \\"Перехват\\" »
(Необычная)
Используется как Реакция, когда союзник на соседней
клетке (в пределах 1 метра) становится целью атаки.
4 АКТИВАЦИЯ У ОТКАТ
Потребляет 10 единиц 3 минуты.
Энергии.
@ КАСТ ДЛИТЕЛЬНОСТЬ
1 Реакция. Мгновенно.
+ Свойства: + 2 ПЗ: +9 к Стойкости, +5 к Живучести.`;

const RUNE_AMULET = `АРТЕФАКТ - РЕДКАЯ
Рунный Амулет
Магический путь * Слот: Шея
«От него идёт ровное тепло, разгоняющее усталость по
венам. В полнолуние знаки на нём светятся сами собой.
Руная вязь на поверхности повторяет контуры умения
«Кровь прилива».»

. Вложенное умение «Кровь прилива» (Редкая)
Вы концентрируете Дух на своем теле, мгновенно
восстанавливая 3d6 + модификатор Живучести хитов.
Если рядом с вами (в радиусе 3 метров) есть открытый
источник воды (лужа, река, дождь), эффективность
исцеления увеличивается в полтора раза.

# АКТИВАЦИЯ I ОТКАТ
Потребляет 10 единиц Духа 5 минут.
и 5 единиц Выносливости.
@ КАСТ Е длитЕЛЬНОСТЬ
1 действие. Мгновенно.
+ Свойства: Даёт +11 к Духу и +6 к Стойкости.`;

describe('обычные карточки предметов', () => {
  it('скриншот: редкость, название, уровень, путь, защита и бонусы из «Даёт»', () => {
    const card = parseCardText(ARMOR_SCREENSHOT);
    expect(card.kind).toBe('item');
    expect(card.rarity).toBe('epic');
    expect(card.name).toBe('Костяной латный доспех');
    expect(card.level).toBe(1);
    expect(card.path).toBe('genetic');
    expect(card.statBonuses).toEqual({ defense: 12, strength: 29, perception: 15 });
    expect(card.flavorText).toContain('сросшихся ребер');
  });

  it('фото: мусор перед названием отбрасывается, описание без кавычек находится', () => {
    const card = parseCardText(SKIN_PHOTO);
    expect(card.name).toBe('Шкура Исполина');
    expect(card.rarity).toBe('uncommon');
    expect(card.statBonuses).toEqual({ defense: 5, endurance: 10, strength: 5 });
    expect(card.flavorText).toContain('Невероятно толстая');
  });

  it('«НЕОБЫЧНАЯ» не путается с «ОБЫЧНАЯ»', () => {
    expect(parseCardText(SKIN_PHOTO).rarity).toBe('uncommon');
    expect(parseCardText(SHIRT_PHOTO_PRIMARY).rarity).toBe('common');
  });

  it('плохо распознанное «ПЗ» всё равно даёт защиту', () => {
    expect(parseCardText('ОБЫЧНАЯ\nШкура\nЗащита: 3 П3\nДаёт +4 к Выносливости.').statBonuses).toEqual({
      defense: 3,
      endurance: 4,
    });
  });

  it('второй проход добавляет путь, уровень и описание, которых нет в первом', () => {
    const primary = parseCardText(SHIRT_PHOTO_PRIMARY);
    const faint = parseCardText(SHIRT_PHOTO_FAINT);
    expect(primary.level).toBeUndefined();
    expect(faint.level).toBe(1);
    expect(faint.path).toBe('genetic');
    expect(faint.flavorText).toContain('Рубаха мелкого кольчужного плетения');
  });

  it('бонусы из прозы умений не считаются постоянными', () => {
    const card = parseCardText('РЕДКАЯ\nУмение\nПока вы в тени, получаете +2 к Скрытности.\nДаёт +3 к Ловкости.');
    expect(card.statBonuses).toEqual({ agility: 3 });
  });
});

describe('артефакты', () => {
  it('когти: артефакт, слот «Руки», свойства и вложенная способность', () => {
    const card = parseCardText(CLAWS);
    expect(card.kind).toBe('artifact');
    expect(card.name).toBe('Когти хищника');
    expect(card.rarity).toBe('uncommon');
    expect(card.path).toBe('genetic');
    expect(card.slot).toBe('gloves');
    expect(card.statBonuses).toEqual({ strength: 10, agility: 5 });
    expect(card.artifact?.abilityName).toBe('Хищные охотничьи когти');
    expect(card.artifact?.abilityRarity).toBe('uncommon');
    expect(card.artifact?.abilityEffect).toContain('Безоружные атаки когтями');
    // +2 к Атлетике из описания способности — не бонус артефакта.
    expect(card.statBonuses).not.toHaveProperty('athletics');
  });

  it('купол-щит: слот «Щит», «+ 2 ПЗ» — защита, название способности с кавычками внутри', () => {
    const card = parseCardText(DOME);
    expect(card.kind).toBe('artifact');
    expect(card.path).toBe('tech');
    expect(card.slot).toBe('shield');
    expect(card.statBonuses).toEqual({ defense: 2, fortitude: 9, vitality: 5 });
    expect(card.artifact?.abilityName).toContain('Живой щит');
  });

  it('амулет: ресурс «Дух», слот «Шея» → амулеты', () => {
    const card = parseCardText(RUNE_AMULET);
    expect(card.slot).toBe('amulets');
    expect(card.rarity).toBe('rare');
    expect(card.statBonuses).toEqual({ resource: 11, fortitude: 6 });
    expect(card.artifact?.abilityName).toBe('Кровь прилива');
    expect(card.artifact?.abilityRarity).toBe('rare');
  });
});

describe('слоты по подписи', () => {
  it.each([
    ['Руки', 'gloves'],
    ['Шея', 'amulets'],
    ['Щит', 'shield'],
    ['Оружие', 'weapon'],
    ['Двуручное', 'twohanded'],
    ['Голова', 'headwear'],
    ['Ноги', 'boots'],
  ])('«%s» → %s', (label, slot) => {
    expect(slotFromLabel(label)).toBe(slot);
  });
});
