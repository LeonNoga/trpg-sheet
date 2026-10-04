export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
    img.src = src;
  });
}

/**
 * Читает изображение как data URL, уменьшая слишком большие фото (например с камеры телефона):
 * иначе одна карточка весит несколько мегабайт, и трей с экспортом быстро раздувается.
 * Скриншоты карточек обычно меньше лимита и остаются как есть, без повторного сжатия.
 */
export async function fileToImageDataUrl(file: File, maxSide = 1600): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= maxSide) return dataUrl;

  const scale = maxSide / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}
