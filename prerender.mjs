/**
 * Pre-renderiza o template do Claude Design para HTML estatico.
 *
 * O `index.html` do Claude Design e um template: o `support.js` baixa React e
 * monta a pagina no navegador do visitante. Isso custa 207 KB de runtime e
 * adia o LCP, porque nada pinta antes do JS rodar.
 *
 * Aqui a montagem acontece UMA vez, no build, dentro de um Chromium headless.
 * O visitante recebe o resultado pronto. A interatividade volta pelo site.js,
 * que e JavaScript comum e nao depende de framework nenhum.
 *
 * Nao perdemos a edicao visual: o design continua sendo editado no projeto do
 * Claude Design e reexportado para src/. O editor nunca abre a pagina publicada.
 *
 * Uso: node prerender.mjs <dir-do-template> <arquivo-de-saida>
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2]);
const OUT = process.argv[3];
const SCRIPT = process.argv[4] || 'site.js';  // arquivo de interatividade desta pagina

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// A pre-renderizacao roda num Chromium de verdade. Sem bloquear o que e
// externo, o coletor de analytics registraria uma visita a cada build, vinda
// da maquina que compila. A tag continua no HTML publicado — so nao executa
// aqui. De quebra, o build fica reprodutivel e sem depender de rede.
await page.route('**/*', (rota) => {
  if (rota.request().url().startsWith(base)) rota.continue();
  else rota.abort();
});

const erros = [];
page.on('pageerror', (e) => erros.push(String(e.message)));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

// --- 1) captura o popup de lead, que so existe quando aberto -----------------
await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')]
    .find((x) => /CONTRATE A NOSSA ASSESSORIA/i.test(x.textContent || ''));
  if (a) a.click();
});
await page.waitForTimeout(1200);
const modalHTML = await page.evaluate(() => {
  const m = document.querySelector('[data-lead-modal]');
  return m && m.parentElement ? m.parentElement.outerHTML : '';
});

// fecha o popup para nao capturar a pagina com ele aberto
await page.evaluate(() => {
  const b = document.querySelector('[data-lead-modal] button[aria-label="Fechar"]');
  if (b) b.click();
});
await page.waitForTimeout(800);

// --- 2) o balao de chat aparece sozinho depois de alguns segundos ------------
await page.waitForTimeout(7000);
const chatHTML = await page.evaluate(() => {
  const c = document.querySelector('[data-chat-bubble]');
  return c ? c.outerHTML : '';
});
await page.evaluate(() => {
  const c = document.querySelector('[data-chat-bubble]');
  if (c) c.remove();
});

// --- 3) serializa a pagina montada ------------------------------------------
// o popup foi capturado como string, antes do evaluate final: limpa ali tambem
const limpo = (h) => h.replace(/(name="(?:landing_page|referrer)"[^>]*value=")[^"]*/g, '$1');

const html = await page.evaluate(({ modalHTML, chatHTML, SCRIPT }) => {
  // 3a) O runtime injeta os estilos de :hover via CSSOM (insertRule), que NAO
  //     aparece no outerHTML. Sem isto os hovers somem no estatico.
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
    s.textContent = '/* regras que o runtime criava via CSSOM */\n' + perdidas.join('\n');
    document.head.appendChild(s);
  }

  // 3a-bis) Contraste em texto com degrade.
  //   Texto pintado por degrade tem preenchimento transparente, entao o
  //   auditor de contraste nao consegue medir e reprova. A correcao e dar a
  //   `color` um valor real — o visual nao muda, porque quem apaga o
  //   preenchimento e o -webkit-text-fill-color. Qual valor depende do fundo
  //   real de cada elemento, e isso so da para saber aqui, com a pagina montada.
  (function corrigeContraste() {
    const parse = (c) => {
      const m = String(c).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map(parseFloat);
      return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = (c) => {
      const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const razao = (a, b) => {
      const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2);
      return (hi + 0.05) / (lo + 0.05);
    };
    const fundoDe = (el) => {
      let e = el;
      while (e) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0.5) return c.rgb;
        e = e.parentElement;
      }
      return [255, 255, 255];
    };
    const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));

    document.querySelectorAll('*').forEach((el) => {
      if (el.children.length || !(el.textContent || '').trim()) return;
      const cs = getComputedStyle(el);
      const preenchimento = parse(cs.webkitTextFillColor || cs.color);
      const cor = parse(cs.color);
      const transparente = (preenchimento && preenchimento.a < 0.1) || (cor && cor.a < 0.1);
      if (!transparente) return;

      const fundo = fundoDe(el);
      // candidatos: as paradas do proprio degrade e a cor do contorno
      const cands = [];
      // O degrade costuma estar num ancestral (background-clip:text pinta o
      // texto dos descendentes), enquanto o texto fica num <span> que o runtime
      // cria. Sem subir a arvore nao ha parada de cor para escolher.
      let comGrad = el, grad = '';
      for (let i = 0; comGrad && i < 4; i++) {
        const g = getComputedStyle(comGrad).backgroundImage || '';
        if (/gradient/.test(g)) { grad = g; break; }
        comGrad = comGrad.parentElement;
      }
      (grad.match(/rgba?\([^)]+\)/g) || []).forEach((c) => { const p = parse(c); if (p) cands.push(p.rgb); });
      (grad.match(/#[0-9a-fA-F]{6}/g) || []).forEach((h) => cands.push(hexToRgb(h)));
      const contorno = parse(cs.webkitTextStrokeColor);
      if (contorno && contorno.a > 0.3) cands.push(contorno.rgb);
      if (!cands.length) return;

      let melhor = cands[0], melhorR = razao(cands[0], fundo);
      cands.forEach((c) => { const r = razao(c, fundo); if (r > melhorR) { melhorR = r; melhor = c; } });
      el.style.color = 'rgb(' + melhor.join(',') + ')';
      if (!cs.webkitTextFillColor || parse(cs.webkitTextFillColor).a < 0.1) {
        el.style.webkitTextFillColor = 'transparent';
      }
    });

    // Botoes-pilula tem so background-image (degrade) e background-color
    // transparente; o auditor entao mede o texto branco contra o fundo da
    // secao. Uma cor solida por baixo do degrade resolve, sem mudar o visual.
    document.querySelectorAll('a, button').forEach((el) => {
      const cs = getComputedStyle(el);
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0.1) return;
      const grad = cs.backgroundImage || '';
      if (!/gradient/.test(grad)) return;
      const cores = (grad.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean)
        .filter((c) => c.a > 0.5);
      if (!cores.length) return;
      const texto = parse(cs.color);
      let melhor = cores[0].rgb, melhorR = texto ? razao(texto.rgb, cores[0].rgb) : 0;
      cores.forEach((c) => {
        const r = texto ? razao(texto.rgb, c.rgb) : 0;
        if (r > melhorR) { melhorR = r; melhor = c.rgb; }
      });
      el.style.backgroundColor = 'rgb(' + melhor.join(',') + ')';
    });
  })();

  // 3b) a tela de carregamento existe para esconder a montagem do runtime;
  //     numa pagina estatica o conteudo ja chega pronto
  document.querySelectorAll('[data-preloader]').forEach((el) => el.remove());

  // 3c) o JS escondia os elementos para anima-los na rolagem. Sem ele,
  //     precisam nascer visiveis — o site.js reanima depois.
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    el.style.opacity = ''; el.style.transform = ''; el.style.transition = '';
    el.removeAttribute('data-reveal-init');
    el.removeAttribute('data-reveal-done');
  });
  document.querySelectorAll('[data-parallax]').forEach((el) => { el.style.transform = ''; });
  document.querySelectorAll('[data-progress]').forEach((el) => { el.style.width = '0%'; });

  // 3d) fora o runtime: support.js, React e o shim que apontava para vendor/
  document.querySelectorAll('script').forEach((el) => {
    const src = el.getAttribute('src') || '';
    if (/support\.js|vendor\/react/.test(src)) { el.remove(); return; }
    if (!src && /__resources/.test(el.textContent || '')) el.remove();
  });

  // 3d-bis) a captura roda contra um servidor local; nenhum vestigio dele pode
  //         sobrar no HTML publicado. O site.js repreenche em tempo real.
  document.querySelectorAll('input[type="hidden"]').forEach((el) => {
    if (/127\.0\.0\.1|localhost/.test(el.value || '')) el.value = '';
  });

  // 3e) popup e chat entram ocultos; o site.js so alterna a visibilidade,
  //     entao o visual continua sendo exatamente o que o runtime produzia
  if (modalHTML || chatHTML) {
    const guarda = document.createElement('div');
    guarda.setAttribute('data-partes', '');
    guarda.hidden = true;
    guarda.innerHTML =
      (modalHTML ? '<div data-parte="lead">' + modalHTML + '</div>' : '') +
      (chatHTML ? '<div data-parte="chat">' + chatHTML + '</div>' : '');
    document.body.appendChild(guarda);
  }

  const s = document.createElement('script');
  s.src = SCRIPT; s.defer = true;
  document.body.appendChild(s);

  return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
}, { modalHTML: limpo(modalHTML), chatHTML: limpo(chatHTML), SCRIPT });

fs.writeFileSync(OUT, html);

const info = await page.evaluate(() => ({
  titulo: document.title,
  secoes: document.querySelectorAll('section').length,
  imagens: document.querySelectorAll('img').length,
  texto: document.body.innerText.trim().length,
}));

console.log(`pre-renderizado -> ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
console.log(`  ${info.secoes} secoes, ${info.imagens} imagens, ${info.texto} caracteres de texto`);
console.log(`  popup: ${modalHTML.length} chars | chat: ${chatHTML.length} chars`);
if (erros.length) console.log('  ERROS DE JS NA MONTAGEM:', erros.slice(0, 5));

await browser.close();
server.close();

if (info.secoes < 8) {
  console.error('ERRO: a montagem nao produziu a pagina esperada.');
  process.exit(1);
}
