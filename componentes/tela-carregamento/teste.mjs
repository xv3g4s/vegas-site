/**
 * Verifica a tela de carregamento num site de verdade.
 *
 *   node teste.mjs                      # usa exemplo/index.html
 *   node teste.mjs https://cliente.com/ # usa o site do cliente
 *
 * Confere, com Chromium: a tela aparece na primeira carga, trava a rolagem,
 * so sai com a pagina carregada, devolve a rolagem, dispara o evento de fim,
 * usa o modo curto na segunda carga, respeita "reduzir movimento" e nunca
 * prende a pagina. Precisa de playwright.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const alvo = process.argv[2];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2' };

let base = alvo;
let srv = null;
if (!alvo) {
  srv = http.createServer((q, r) => {
    const pedido = decodeURIComponent(q.url.split('?')[0]);
    // a pagina de exemplo mora em exemplo/ e pede ../tela-carregamento.js:
    // procura nas duas pastas
    const tentativas = pedido === '/'
      ? [path.join(AQUI, 'exemplo/index.html')]
      : [path.join(AQUI, 'exemplo', pedido), path.join(AQUI, pedido)];
    const f = tentativas.find((x) => x.startsWith(AQUI) && fs.existsSync(x) && !fs.statSync(x).isDirectory());
    if (!f) { r.writeHead(404); return r.end('nao encontrado'); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}/`;
}

let ok = 0;
const falhas = [];
const checa = (c, m) => (c ? ok++ : falhas.push(m));

const navegador = await chromium.launch();

// sessionStorage e por ABA: a segunda carga tem que ser na mesma pagina, como
// quem clica num link interno. Aba nova e sessao nova — e ve a intro de novo.
async function carrega(ctx, url, { pagina = null } = {}) {
  const p = pagina || await ctx.newPage();
  const erros = [];
  const faltando = [];
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('response', (r) => { if (r.status() >= 400) faltando.push(`${r.status()} ${r.url()}`); });
  const marcas = {};
  if (!pagina) await p.addInitScript(() => {
    window.__tcEventos = [];
    ['tela-carregamento:fim'].forEach((n) =>
      window.addEventListener(n, (e) => window.__tcEventos.push({ n, modo: e.detail && e.detail.modo, t: Date.now() })));
  });
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  marcas.visivelCedo = await p.evaluate(() => !!document.querySelector('.tc'));
  marcas.logo = await p.evaluate(() => {
    const el = document.querySelector('.tc__base');
    if (!el) return null;
    const cs = getComputedStyle(el);
    const url = (cs.webkitMaskImage || cs.maskImage || '').match(/url\("?([^")]+)"?\)/);
    if (!url) return { url: null, pronta: false };
    return new Promise((r) => {
      const i = new Image();
      i.onload = () => r({ url: url[1], pronta: i.naturalWidth > 0 });
      i.onerror = () => r({ url: url[1], pronta: false });
      i.src = url[1];
    });
  });
  marcas.travada = await p.evaluate(() => document.documentElement.classList.contains('tc-carregando'));
  {
    await p.waitForFunction(() => !document.querySelector('.tc'), null, { timeout: 12000 });
    marcas.duracao = Date.now() - t0;
    marcas.prontaAoSair = await p.evaluate(() => document.readyState);
    marcas.destravada = await p.evaluate(() => !document.documentElement.classList.contains('tc-carregando'));
    marcas.eventos = await p.evaluate(() => window.__tcEventos);
    marcas.aria = await p.evaluate(() => (document.getElementById('conteudo') || document.querySelector('main') || document.body).getAttribute('aria-busy'));
  }
  marcas.erros = erros;
  marcas.faltando = faltando;
  return { p, marcas };
}

// 1) primeira carga da sessao: intro completa
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 } });
const primeira = await carrega(ctx, base);
checa(primeira.marcas.visivelCedo, 'a tela nao apareceu antes do DOM pronto');
checa(primeira.marcas.travada, 'a rolagem nao foi travada enquanto a tela cobria a pagina');
checa(primeira.marcas.prontaAoSair === 'complete', `a tela saiu com readyState=${primeira.marcas.prontaAoSair}`);
checa(primeira.marcas.destravada, 'a rolagem continuou travada depois da tela sair');
checa(primeira.marcas.aria === 'false', `aria-busy ficou em "${primeira.marcas.aria}" depois da tela sair`);
checa(primeira.marcas.eventos.length === 1 && primeira.marcas.eventos[0].modo === 'completo',
  `evento de fim: ${JSON.stringify(primeira.marcas.eventos)}`);
checa(primeira.marcas.duracao >= 1200, `a intro durou ${primeira.marcas.duracao}ms (esperado: pelo menos o tempo minimo)`);
checa(primeira.marcas.duracao < 9000, `a intro durou ${primeira.marcas.duracao}ms — tempo demais`);
checa(primeira.marcas.erros.length === 0, `erro de JavaScript: ${primeira.marcas.erros[0]}`);
checa(primeira.marcas.logo && primeira.marcas.logo.pronta,
  `a logo da tela nao carregou (${primeira.marcas.logo && primeira.marcas.logo.url}) — sem ela a tela fica vazia`);
checa(primeira.marcas.faltando.length === 0, `arquivo faltando: ${primeira.marcas.faltando[0]}`);
const rola = await primeira.p.evaluate(() => { window.scrollTo(0, 400); return window.scrollY; });
checa(rola > 0, 'a pagina nao rola depois que a tela sai');

// 2) segunda carga na MESMA sessao: modo curto
const segunda = await carrega(ctx, base, { pagina: primeira.p });
checa(segunda.marcas.visivelCedo, 'o modo curto nao mostrou a tela');
checa(segunda.marcas.eventos.length === 1 && segunda.marcas.eventos[0].modo === 'curto',
  `modo da segunda carga: ${JSON.stringify(segunda.marcas.eventos)}`);
checa(segunda.marcas.duracao < primeira.marcas.duracao,
  `modo curto (${segunda.marcas.duracao}ms) nao foi mais rapido que a intro (${primeira.marcas.duracao}ms)`);
checa(segunda.marcas.prontaAoSair === 'complete', 'no modo curto a tela saiu com a pagina ainda carregando');


// 3) ?intro traz a intro completa de volta
const volta = await carrega(ctx, base + (base.includes('?') ? '&' : '?') + 'intro', { pagina: segunda.p });
checa(volta.marcas.eventos[0] && volta.marcas.eventos[0].modo === 'completo',
  '?intro nao voltou para a intro completa');
await volta.p.close();
await ctx.close();

// 4) quem pede menos movimento
const ctxParado = await navegador.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
const parado = await carrega(ctxParado, base);
checa(parado.marcas.duracao < 4000, `com reducao de movimento a tela durou ${parado.marcas.duracao}ms`);
checa(parado.marcas.destravada, 'com reducao de movimento a rolagem ficou travada');
await parado.p.close();
await ctxParado.close();

// 5) sem JavaScript o site aparece normalmente
const ctxSemJs = await navegador.newContext({ viewport: { width: 1280, height: 860 }, javaScriptEnabled: false });
const semJs = await ctxSemJs.newPage();
await semJs.goto(base, { waitUntil: 'load' });
checa(!(await semJs.evaluate(() => !!document.querySelector('.tc')).catch(() => false)),
  'sem JavaScript a tela apareceu e ficou');
checa((await semJs.locator('h1').count()) > 0, 'sem JavaScript a pagina nao mostrou conteudo');
await ctxSemJs.close();

await navegador.close();
if (srv) srv.close();

console.log(`\nprimeira carga: ${primeira.marcas.duracao}ms   modo curto: ${segunda.marcas.duracao}ms   reduzido: ${parado.marcas.duracao}ms`);
falhas.forEach((f) => console.log(`  FALHA  ${f}`));
console.log(`\n${ok} ok, ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
