// Подготовка фото карточки к распознаванию: обрезка по границам листа, поворот и выравнивание контраста.
// Всё считается на canvas в браузере, без сторонних библиотек.

export function loadCanvas(src: string, maxSide = 2400): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
    img.src = src;
  });
}

function resized(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(canvas.width * scale));
  out.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

/** Масштабирует так, чтобы большая сторона стала ровно `side` (вверх и вниз). */
export function scaleToLongSide(canvas: HTMLCanvasElement, side: number): HTMLCanvasElement {
  return resized(canvas, side / Math.max(canvas.width, canvas.height));
}

/** Поворот по часовой стрелке на quarterTurns × 90°. */
export function rotateCanvas(canvas: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return canvas;
  const out = document.createElement('canvas');
  const swap = turns % 2 === 1;
  out.width = swap ? canvas.height : canvas.width;
  out.height = swap ? canvas.width : canvas.height;
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

function luminanceOf(data: Uint8ClampedArray, i: number): number {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/** Порог Оцу по гистограмме яркости: отделяет светлую бумагу от тёмного фона. */
function otsuThreshold(lum: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  lum.forEach((v) => hist[v]++);
  const total = lum.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Находит на фото светлый лист (самую большую связную светлую область) и обрезает по нему.
 * Если лист и так занимает почти весь кадр (скриншот карточки) или найти его не удалось — возвращает исходник.
 */
export function cropToSheet(canvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; cropped: boolean } {
  const side = 220;
  const scale = side / Math.max(canvas.width, canvas.height);
  const w = Math.max(8, Math.round(canvas.width * scale));
  const h = Math.max(8, Math.round(canvas.height * scale));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const lum = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) lum[p] = luminanceOf(data, p * 4);
  const threshold = otsuThreshold(lum);

  let mask = new Uint8Array(w * h);
  let bright = 0;
  for (let p = 0; p < w * h; p++) {
    if (lum[p] > threshold) {
      mask[p] = 1;
      bright++;
    }
  }
  const fraction = bright / (w * h);
  if (fraction > 0.88 || fraction < 0.03) return { canvas, cropped: false };

  // Если кромка кадра преимущественно светлая — лист уже занимает кадр, обрезать нечего.
  let edgeBright = 0;
  let edgeTotal = 0;
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      edgeTotal++;
      edgeBright += mask[y * w + x];
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      edgeTotal++;
      edgeBright += mask[y * w + x];
    }
  }
  if (edgeBright / edgeTotal > 0.6) return { canvas, cropped: false };

  // Тёмная рамка карточки разрезала бы лист на кольцо и серединку — склеиваем дилатацией.
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (
          mask[y * w + x] ||
          (x > 0 && mask[y * w + x - 1]) ||
          (x < w - 1 && mask[y * w + x + 1]) ||
          (y > 0 && mask[(y - 1) * w + x]) ||
          (y < h - 1 && mask[(y + 1) * w + x])
        ) {
          next[y * w + x] = 1;
        }
      }
    }
    mask = next;
  }

  // Самая большая связная область (заливка стеком).
  const seen = new Uint8Array(w * h);
  let best = { area: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    let area = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const neighbours = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const n of neighbours) {
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (area > best.area) best = { area, minX, minY, maxX, maxY };
  }

  const boxW = best.maxX - best.minX + 1;
  const boxH = best.maxY - best.minY + 1;
  // Слишком маленькая находка — скорее всего блик или посторонний предмет, а не карточка.
  if (best.area < w * h * 0.08 || boxW * boxH > w * h * 0.95) return { canvas, cropped: false };

  const pad = 0.015;
  const x0 = Math.max(0, Math.floor(((best.minX / w) - pad) * canvas.width));
  const y0 = Math.max(0, Math.floor(((best.minY / h) - pad) * canvas.height));
  const x1 = Math.min(canvas.width, Math.ceil((((best.maxX + 1) / w) + pad) * canvas.width));
  const y1 = Math.min(canvas.height, Math.ceil((((best.maxY + 1) / h) + pad) * canvas.height));
  const out = document.createElement('canvas');
  out.width = x1 - x0;
  out.height = y1 - y0;
  out.getContext('2d')!.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { canvas: out, cropped: true };
}

/** Серое изображение с растянутым контрастом (2–98 перцентили): серая бумага и тусклая печать читаются лучше. */
export function enhanceContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0);
  const image = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = image;
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i += 4) hist[Math.round(luminanceOf(data, i))]++;
  const total = data.length / 4;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let t = 0; t < 256; t++) {
    acc += hist[t];
    if (acc >= total * 0.02) {
      lo = t;
      break;
    }
  }
  acc = 0;
  for (let t = 255; t >= 0; t--) {
    acc += hist[t];
    if (acc >= total * 0.02) {
      hi = t;
      break;
    }
  }
  const range = Math.max(40, hi - lo);
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((luminanceOf(data, i) - lo) * 255) / range));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

export function canvasToJpeg(canvas: HTMLCanvasElement, maxSide = 1400, quality = 0.88): string {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const target = scale < 1 ? resized(canvas, scale) : canvas;
  return target.toDataURL('image/jpeg', quality);
}

/**
 * Локальная бинаризация (порог = среднее по окну): вытягивает бледную серую печать и убирает градиент освещения
 * и блики, с которыми глобальный контраст не справляется.
 */
export function adaptiveBinarize(canvas: HTMLCanvasElement, windowFraction = 1 / 18, bias = 0.9): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const { data } = image;

  // Интегральное изображение яркости для среднего по окну за O(1).
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += luminanceOf(data, (y * w + x) * 4);
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + rowSum;
    }
  }
  const half = Math.max(8, Math.round(Math.max(w, h) * windowFraction));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h, y + half + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w, x + half + 1);
      const sum =
        integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const i = (y * w + x) * 4;
      const v = luminanceOf(data, i) < mean * bias ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
  ctx.putImageData(image, 0, 0);
  return out;
}
