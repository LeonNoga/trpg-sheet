// Копирует файлы распознавания (воркер Tesseract, ядро WASM, языковые данные) в public/ocr,
// чтобы они отдавались с нашего же сайта, а не с внешнего CDN: так OCR не зависит от чужих серверов,
// а после первого использования кэшируется сервис-воркером и работает без интернета.
// Файлы большие (≈10 МБ), поэтому в git они не хранятся — берутся из node_modules при dev/build.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // Ядро выбирается на устройстве по поддержке SIMD; качается только нужный вариант.
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/rus/4.0.0_best_int/rus.traineddata.gz', 'lang/rus.traineddata.gz'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
];

for (const [from, to] of files) {
  const source = join(root, from);
  const target = join(out, to);
  if (!existsSync(source)) {
    console.error(`copy-ocr-assets: не найден ${from} — выполните npm install`);
    process.exit(1);
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
console.log(`copy-ocr-assets: скопировано файлов — ${files.length}`);
