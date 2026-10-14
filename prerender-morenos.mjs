/**
 * Pre-renderiza a landing page do Salao Morenos.
 *
 * Diferenca para o prerender.mjs da Vegas: aquela pagina e quase toda estatica,
 * entao o runtime do Claude Design pode ser jogado fora depois da captura. Esta
 * aqui e uma pagina com estado (mega menu, menu do celular, modal de unidades,
 * lightbox da galeria, abas e sanfona do FAQ, carrossel de etapas, hover dos
 * servicos e dos mapas). Reescrever tudo isso em JavaScript comum significaria
 * manter uma segunda implementacao do design, que iria divergir na primeira
 * reexportacao.
 *
 * Entao a pagina publicada tem as duas camadas:
 *
 *   1. Uma copia ESTATICA da pagina montada (capturada aqui, no build). E o que
 *      o visitante ve no primeiro quadro e o que o robo de busca le: texto,
 *      imagens e links prontos, sem depender de JavaScript.
 *   2. O template original + o runtime, carregados com `defer`. Quando o React
 *      monta, a copia estatica sai e a pagina viva entra no lugar, com todas as
 *      interacoes exatamente como foram desenhadas.
 *
 * Se o JavaScript falhar ou for bloqueado, a camada 1 continua na tela: a
 * pagina permanece legivel e os links de ancora funcionam.
 *
 * A captura roda em viewport de celular (390x844) porque a largura decide o que
 * o design monta (`isDesktop = innerWidth >= 1120`): o menu inferior fixo e o
 * botao de menu so existem no celular. Celular tambem e como o Google indexa.
 *
 * Uso: node prerender-morenos.mjs <dir-do-palco> <arquivo-de-saida> <extras-head.html>
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2]);
const OUT = process.argv[3];
const EXTRAS = process.argv[4] ? fs.readFileSync(process.argv[4], 'utf8') : '';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end('nao encontrado');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const erros = [];
page.on('pageerror', (e) => erros.push(String(e.message)));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('#dc-root > *', { timeout: 30000 });
await page.waitForTimeout(2500);

// --- copia estatica da pagina montada ---------------------------------------
const capturado = await page.evaluate(() => {
  // 1) O runtime cria as regras de :hover via CSSOM (insertRule), que nao
  //    aparecem no outerHTML. Sem isto os hovers somem na copia estatica.
  const perdidas = [];
  for (const folha of document.styleSheets) {
    const dono = folha.ownerNode;
    if (dono && dono.tagName === 'STYLE' && dono.textContent.trim()) continue; // ja esta no HTML
    if (folha.href) continue;                                                  // arquivo externo
    try {
      for (const regra of folha.cssRules) perdidas.push(regra.cssText);
    } catch (e) { /* folha de outra origem */ }
  }
  if (perdidas.length) {
    const s = document.createElement('style');
    s.setAttribute('data-runtime-css', '');
    s.textContent = '/* regras que o runtime cria via CSSOM */\n' + perdidas.join('\n');
    document.head.appendChild(s);
  }

  // 2) As secoes nascem com opacity:0 para a animacao de rolagem. Sem
  //    JavaScript elas precisam nascer visiveis.
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    el.style.opacity = '';
    el.style.animation = '';
  });

  // 3) A primeira imagem (LCP) nao pode esperar: o resto pode.
  const imgs = [...document.querySelectorAll('#dc-root img')];
  imgs.forEach((img, i) => {
    if (i === 0) { img.removeAttribute('loading'); img.setAttribute('fetchpriority', 'high'); }
    else if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  // 4) A copia estatica nao tem JavaScript: um botao que so funciona depois da
  //    montagem nao pode anunciar estado aberto/fechado para leitor de tela.
  document.querySelectorAll('#dc-root [aria-expanded]').forEach((el) => {
    el.setAttribute('aria-expanded', 'false');
  });

  const cabeca = [...document.head.children]
    .filter((el) => {
      if (el.tagName !== 'SCRIPT') return true;
      const src = el.getAttribute('src') || '';
      if (/support\.js|vendor\/react/.test(src)) return false;      // runtime
      if (!src && /__resources/.test(el.textContent || '')) return false; // shim
      return true;
    })
    .map((el) => el.outerHTML).join('\n');

  const raiz = document.getElementById('dc-root');
  return {
    cabeca,
    corpo: raiz ? raiz.innerHTML : '',
    titulo: document.title,
    secoes: document.querySelectorAll('#dc-root section').length,
    imagens: imgs.length,
    texto: (raiz ? raiz.innerText : '').trim().length,
  };
});

await browser.close();
server.close();

if (!capturado.corpo || capturado.secoes < 8 || capturado.texto < 3000) {
  console.error('ERRO: a montagem nao produziu a pagina esperada ' +
    `(${capturado.secoes} secoes, ${capturado.texto} caracteres).`);
  process.exit(1);
}
if (erros.length) {
  console.error('ERRO: JavaScript falhou durante a montagem:', erros.slice(0, 5));
  process.exit(1);
}

// --- template original, para o runtime montar no navegador -------------------
const fonte = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const recorta = (inicio, fim, oque) => {
  const a = fonte.indexOf(inicio);
  const b = fonte.indexOf(fim, a);
  if (a < 0 || b < 0) {
    console.error(`ERRO: nao achei ${oque} no template.`);
    process.exit(1);
  }
  return fonte.slice(a, b + fim.length);
};

const template = recorta('<x-dc>', '</x-dc>', 'o bloco <x-dc>');
const logica = recorta('<script type="text/x-dc"', '</script>', 'o script do componente');
// vai do mapa de recursos ate a tag do runtime — as duas coisas que o
// build-morenos.py injeta no lugar do <script src="./support.js"> original
const shim = recorta('<script>\n/* Runtime deps',
  '<script src="./support.js" defer></script>', 'o shim do runtime');

// O <x-dc> fica escondido por uma regra que o proprio runtime injeta. Se o
// runtime nao carregar, o template apareceria como texto solto embaixo da
// pagina — entao a regra tambem entra no HTML publicado.
const TROCA = `<style id="mo-troca">
  x-dc { display: none !important; }
  #dc-root { display: none; }
  html.mo-vivo #dc-root { display: block; }
  html.mo-vivo #mo-estatico { display: none; }
</style>`;

const COLA = `<script>
/* Troca a copia estatica pela pagina viva assim que o runtime monta.
   Enquanto #dc-root esta escondido por CSS, o navegador nunca pinta as duas
   camadas ao mesmo tempo — a troca acontece em um unico quadro, e a altura da
   pagina e a mesma nas duas, entao a rolagem fica onde estava.
   Se o runtime nunca montar, nada disso roda e a copia estatica continua. */
(function () {
  var raiz = document.documentElement;
  function troca() {
    var vivo = document.getElementById('dc-root');
    if (!vivo || !vivo.firstElementChild) return false;
    var y = window.pageYOffset || raiz.scrollTop || 0;
    raiz.classList.add('mo-vivo');
    var estatico = document.getElementById('mo-estatico');
    if (estatico && estatico.parentNode) estatico.parentNode.removeChild(estatico);
    if (y) window.scrollTo(0, y);
    return true;
  }
  if (troca()) return;
  var obs = new MutationObserver(function () { if (troca()) obs.disconnect(); });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(function () { obs.disconnect(); troca(); }, 15000);
})();
</script>`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${capturado.cabeca}
${EXTRAS.trim()}
${TROCA}
</head>
<body>
<div id="mo-estatico">
${capturado.corpo}
</div>
${template}
${logica}
${shim}
${COLA}
</body>
</html>
`;

fs.writeFileSync(OUT, html);

console.log(`pre-renderizado -> ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
console.log(`  ${capturado.secoes} secoes, ${capturado.imagens} imagens, ` +
  `${capturado.texto} caracteres de texto`);
console.log(`  titulo: ${capturado.titulo}`);
