/**
 * Prepara a logo da tela de carregamento: reduz para a largura pedida e
 * reencoda em WebP.
 *
 *   node preparar-logo.mjs <entrada.png> <saida.webp> <largura> [qualidade] [--mascara]
 *   node preparar-logo.mjs logo.png logo-mascara.webp 400 0.8 --mascara
 *
 * A logo nunca passa de ~200px na tela, mas costuma chegar com 1000px ou mais.
 * Com --mascara o RGB e pintado de branco: a tela usa a imagem como MASCARA
 * CSS, entao so o canal alfa (a forma) aparece, e achatar a cor derruba o peso
 * sem mudar nada do que se ve. Na logo do Salao Morenos: 121 KB -> 27 KB.
 *
 * Usa o Chromium do playwright (canvas + toDataURL): sem ImageMagick, sem
 * cwebp. Se preferir ferramenta propria, o equivalente e:
 *   cwebp -q 80 -resize 400 0 logo.png -o logo-mascara.webp
 * (lembrando de achatar o RGB antes, se for mascara).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
// --mascara: a imagem so e usada como mascara CSS, entao o canal de cor nunca
// aparece. Pintando o RGB de branco, a parte com perdas do WebP fica quase sem
// informacao e so o alfa pesa: na logo da tela de abertura isso derruba 78%.
const mascara = args.includes('--mascara');
const [entrada, saida, larguraArg, qualidadeArg] = args.filter((a) => a !== '--mascara');
if (!entrada || !saida || !larguraArg) {
  console.error('uso: node preparar-logo.mjs <entrada> <saida> <largura> [qualidade] [--mascara]');
  process.exit(1);
}
const largura = Number(larguraArg);
const qualidade = Number(qualidadeArg || 0.86);

const bytes = fs.readFileSync(entrada);
const ext = path.extname(entrada).toLowerCase();
const tipo = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/webp';
const dataUrl = `data:${tipo};base64,${bytes.toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const resultado = await page.evaluate(async ({ dataUrl, largura, qualidade, mascara }) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const escala = Math.min(1, largura / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * escala);
  c.height = Math.round(img.naturalHeight * escala);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  if (mascara) {
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = 255; d.data[i + 1] = 255; d.data[i + 2] = 255; }
    ctx.putImageData(d, 0, 0);
  }
  return { url: c.toDataURL('image/webp', qualidade), w: c.width, h: c.height,
           origW: img.naturalWidth, origH: img.naturalHeight };
}, { dataUrl, largura, qualidade, mascara });
await browser.close();

const novo = Buffer.from(resultado.url.split(',')[1], 'base64');
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, novo);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`${path.basename(entrada)}  ${resultado.origW}x${resultado.origH} ${kb(bytes.length)}` +
  `  ->  ${resultado.w}x${resultado.h} ${kb(novo.length)}` +
  `  (-${Math.round((1 - novo.length / bytes.length) * 100)}%)` + (mascara ? '  [mascara]' : ''));
