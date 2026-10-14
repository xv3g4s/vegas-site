/**
 * Confere o public/morenos/index.html publicado, servindo a pasta como um host
 * qualquer faria. Verifica, nesta ordem:
 *
 *   1. sem JavaScript: a copia estatica aparece, com texto, imagens e links;
 *   2. com JavaScript: o runtime monta, a copia estatica sai e sobra uma
 *      pagina so (sem conteudo duplicado);
 *   3. as interacoes que dependem do runtime respondem (modal de unidades,
 *      mega menu, FAQ, lightbox da galeria);
 *   4. nenhuma requisicao sai para dominio de terceiro;
 *   5. nenhum erro de JavaScript no console.
 *
 * Uso: node checar-morenos.mjs [dir-publicado] [dir-de-capturas]
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || 'public/morenos');
const CAPTURAS = process.argv[3] ? path.resolve(process.argv[3]) : null;
if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain',
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

const falhas = [];
const ok = [];
const checa = (cond, msg) => (cond ? ok : falhas).push(msg);

const browser = await chromium.launch();
const CELULAR = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const MESA = { viewport: { width: 1440, height: 900 } };

// ---------------------------------------------------- 1) sem JavaScript -----
{
  const ctx = await browser.newContext({ ...CELULAR, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({
    texto: document.body.innerText.trim().length,
    imagens: [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length,
    links: document.querySelectorAll('#mo-estatico a[href]').length,
    h1: document.querySelectorAll('#mo-estatico h1').length,
    templateVisivel: [...document.querySelectorAll('x-dc')]
      .some((el) => getComputedStyle(el).display !== 'none'),
    vivoVisivel: !!document.querySelector('#dc-root'),
  }));
  checa(r.texto > 3000, `sem JS: ${r.texto} caracteres de texto na tela`);
  checa(r.imagens > 5, `sem JS: ${r.imagens} imagens carregadas`);
  checa(r.links > 20, `sem JS: ${r.links} links na copia estatica`);
  checa(r.h1 === 1, `sem JS: ${r.h1} <h1> (esperado 1)`);
  checa(!r.templateVisivel, 'sem JS: o template <x-dc> continua escondido');
  checa(!r.vivoVisivel, 'sem JS: nao existe #dc-root (o runtime nao rodou)');
  if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, '1-sem-js-celular.png'), fullPage: false });
  await ctx.close();
}

// ---------------------------------------------------- 2) com JavaScript -----
for (const [nome, perfil] of [['celular', CELULAR], ['desktop', MESA]]) {
  const ctx = await browser.newContext(perfil);
  const page = await ctx.newPage();
  const externas = [];
  const errosJs = [];
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) externas.push(u);
  });
  page.on('pageerror', (e) => errosJs.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errosJs.push(m.text()); });

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('html.mo-vivo', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const r = await page.evaluate(() => ({
    trocou: document.documentElement.classList.contains('mo-vivo'),
    estaticoFora: !document.getElementById('mo-estatico'),
    h1: document.querySelectorAll('h1').length,
    secoes: document.querySelectorAll('#dc-root section').length,
    texto: document.body.innerText.trim().length,
  }));
  checa(r.trocou, `${nome}: o runtime montou e a pagina viva entrou`);
  checa(r.estaticoFora, `${nome}: a copia estatica saiu do DOM`);
  checa(r.h1 === 1, `${nome}: ${r.h1} <h1> depois da troca (esperado 1)`);
  checa(r.secoes >= 8, `${nome}: ${r.secoes} secoes na pagina viva`);
  checa(externas.length === 0,
    externas.length ? `${nome}: REQUISICAO EXTERNA -> ${externas.slice(0, 3).join(', ')}`
                    : `${nome}: nenhuma requisicao a dominio de terceiro`);
  checa(errosJs.length === 0,
    errosJs.length ? `${nome}: ERRO DE JS -> ${errosJs.slice(0, 3).join(' | ')}`
                   : `${nome}: nenhum erro de JavaScript`);
  if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `2-com-js-${nome}.png`) });

  // ------------------------------------------------- 3) interacoes ----------
  // modal de unidades
  await page.getByRole('button', { name: /^Agendar$/i }).first().click();
  await page.waitForTimeout(700);
  let visivel = await page.getByRole('dialog', { name: 'Escolha sua unidade' }).isVisible().catch(() => false);
  checa(visivel, `${nome}: o modal de unidades abre no "Agendar"`);
  if (CAPTURAS && visivel) await page.screenshot({ path: path.join(CAPTURAS, `3-modal-${nome}.png`) });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  visivel = await page.getByRole('dialog', { name: 'Escolha sua unidade' }).isVisible().catch(() => false);
  checa(!visivel, `${nome}: Escape fecha o modal`);

  // menu: mega menu no desktop, sanfona no celular
  if (nome === 'desktop') {
    await page.getByRole('button', { name: 'Unidades' }).first().hover();
    await page.waitForTimeout(600);
    const itens = await page.getByRole('link', { name: /Cidade Continental/ }).count();
    checa(itens > 0, `${nome}: o mega menu de Unidades abre no hover`);
    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `4-megamenu-${nome}.png`) });
  } else {
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await page.waitForTimeout(600);
    const aberto = await page.getByRole('navigation', { name: 'Menu' }).isVisible().catch(() => false);
    checa(aberto, `${nome}: o menu do celular abre`);
    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `4-menu-${nome}.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // FAQ: trocar de categoria e abrir uma pergunta
  await page.getByRole('tab', { name: 'O Clube' }).first().click();
  await page.waitForTimeout(500);
  const perg = page.getByRole('button', { name: /Como funciona o Clube/ });
  checa(await perg.count() > 0, `${nome}: a aba "O Clube" troca as perguntas do FAQ`);
  if (await perg.count() > 0) {
    await perg.first().click();
    await page.waitForTimeout(400);
    const resp = await page.getByText(/assinatura mensal da Morenos/).count();
    checa(resp > 0, `${nome}: a sanfona do FAQ abre a resposta`);
  }

  // lightbox da galeria
  const lupa = page.getByRole('button', { name: /^Ampliar:/ });
  if (await lupa.count() > 0) {
    await lupa.first().click();
    await page.waitForTimeout(600);
    const lb = await page.getByRole('dialog', { name: 'Imagem ampliada' }).isVisible().catch(() => false);
    checa(lb, `${nome}: o lightbox da galeria abre`);
    if (CAPTURAS && lb) await page.screenshot({ path: path.join(CAPTURAS, `5-lightbox-${nome}.png`) });
    await page.keyboard.press('Escape');
  }

  // Rolagem horizontal indevida. Nao basta comparar scrollWidth com
  // clientWidth: a pagina tem carrossel e marquise dentro de caixas com
  // overflow escondido, que contam no scrollWidth sem rolar nada. O que
  // importa e se a pagina ANDA para o lado quando alguem empurra.
  const andou = await page.evaluate(() => {
    window.scrollTo(600, window.pageYOffset);
    const x = window.pageXOffset;
    window.scrollTo(0, window.pageYOffset);
    return x;
  });
  checa(andou === 0, `${nome}: a pagina nao anda para o lado (rolagem horizontal: ${andou}px)`);

  // No celular, conteudo mais largo que a tela faz o navegador ALARGAR o
  // viewport de layout: a pagina encolhe e todo elemento position:fixed (modal,
  // lightbox, barra inferior) nasce maior que a tela, com a borda direita —
  // e o botao de fechar — fora dela. innerWidth maior que clientWidth denuncia.
  const larguras = await page.evaluate(() => ({
    janela: window.innerWidth, documento: document.documentElement.clientWidth,
  }));
  checa(larguras.janela === larguras.documento,
    `${nome}: viewport de layout na largura da tela ` +
    `(${larguras.janela}px janela / ${larguras.documento}px documento)`);

  // e o botao de fechar do modal precisa caber na tela
  await page.getByRole('button', { name: /^Agendar$/i }).first().click();
  await page.waitForTimeout(600);
  const fechar = await page.evaluate(() => {
    const b = document.querySelector('[role="dialog"][aria-label="Escolha sua unidade"] button[aria-label="Fechar"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { direita: Math.round(r.right), tela: document.documentElement.clientWidth };
  });
  checa(fechar && fechar.direita <= fechar.tela,
    fechar ? `${nome}: o botao de fechar do modal cabe na tela ` +
             `(borda em ${fechar.direita}px de ${fechar.tela}px)`
           : `${nome}: nao achei o botao de fechar do modal`);
  await page.keyboard.press('Escape');

  await ctx.close();
}

await browser.close();
server.close();

ok.forEach((m) => console.log('  ok   ' + m));
falhas.forEach((m) => console.log('  FALHA ' + m));
console.log(`\n${ok.length} ok, ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
