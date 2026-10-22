// Auditoria das paginas publicadas: SEO, semantica, acessibilidade e mobile.
// Le as rotas do public/sitemap.xml, entao audita o que foi construido de fato.
//
// Uso:
//   python3 construtor.py
//   (cd public && python3 -m http.server 8099 &)
//   node auditoria.mjs http://127.0.0.1:8099
//
// Sai com codigo 1 se achar qualquer problema — serve para CI.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const BASE = process.argv[2] || "http://127.0.0.1:8099";

const sitemap = readFileSync(new URL("./public/sitemap.xml", import.meta.url), "utf8");
const rotas = [...sitemap.matchAll(/<loc>https:\/\/vegasaceleradora\.com\.br([^<]*)<\/loc>/g)]
  .map((m) => m[1]);

const nav = await chromium.launch();
const prob = [];
const titulos = new Map();
const descricoes = new Map();
const internos = new Set();
let palavras = 0;
let jsonld = 0;

// ---------- desktop ----------
const ctx = await nav.newContext({ viewport: { width: 1366, height: 900 } });
for (const rota of rotas) {
  const pg = await ctx.newPage();
  const erros = [];
  pg.on("pageerror", (e) => erros.push(String(e)));
  // O proxy do ambiente bloqueia app.johnyweb.com (coletor do painel). E falha
  // de rede do sandbox, nao da pagina — so conta erro de origem propria.
  pg.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/johnyweb\.com|ERR_TUNNEL_CONNECTION_FAILED/.test(t)) return;
    erros.push(t);
  });
  pg.on("requestfailed", (r) => {
    if (/johnyweb\.com/.test(r.url())) return;
    erros.push(`recurso falhou: ${r.url()} (${r.failure()?.errorText})`);
  });
  const resp = await pg.goto(BASE + rota, { waitUntil: "load" });

  if (!resp || resp.status() >= 400) prob.push(`${rota}: HTTP ${resp ? resp.status() : "sem resposta"}`);
  for (const e of erros) prob.push(`${rota}: erro de JS — ${e}`);

  const d = await pg.evaluate(() => {
    const t = document.title;
    const desc = document.querySelector('meta[name="description"]')?.content || "";
    const can = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
    const rob = document.querySelector('meta[name="robots"]')?.content || "";
    const h1 = [...document.querySelectorAll("h1")].map((x) => x.textContent.trim());
    const niveis = [...document.querySelectorAll("h1,h2,h3,h4")].map((x) => +x.tagName[1]);
    // alt="" e valido e proposital para imagem decorativa; o que nao pode e o
    // atributo faltar.
    const semAlt = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length;
    const semDim = [...document.querySelectorAll("img")]
      .filter((i) => !i.getAttribute("width") || !i.getAttribute("height")).length;
    const texto = document.querySelector("main")?.innerText || "";
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')];
    const links = [...document.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href"))
      .filter((h) => h.startsWith("/"));
    const sanduiche = !!document.querySelector(".topo details, .sanduiche, [data-sanduiche]");
    // id duplicado: HTML invalido, e qualquer link de ancora ou aria-labelledby
    // passa a apontar para "o primeiro que aparecer".
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
    // ancora interna que nao existe na pagina de destino
    const ancoras = [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute("href").slice(1))
      .filter((h) => h && !document.getElementById(h));
    let ldOk = true;
    for (const s of ld) { try { JSON.parse(s.textContent); } catch { ldOk = false; } }
    return {
      t, desc, can, rob, h1, niveis, semAlt, semDim, ldOk, links, sanduiche, dup, ancoras,
      ld: ld.length,
      palavras: texto.trim().split(/\s+/).filter(Boolean).length,
      marcador: /PREENCHER|lorem ipsum|XXXX/.test(texto),
      // Marcador de componente que nao foi substituido. Ja aconteceu: um
      // {{VS}} escrito em varias linhas nao casou com a expressao e foi
      // publicado cru. O construtor agora para, e aqui ha a segunda rede.
      cru: /\{\{[A-Z-]/.test(texto),
    };
  });

  if (!d.t) prob.push(`${rota}: sem <title>`);
  if (d.t.length > 65) prob.push(`${rota}: title com ${d.t.length} caracteres`);
  if (titulos.has(d.t)) prob.push(`${rota}: title repetido de ${titulos.get(d.t)}`);
  titulos.set(d.t, rota);
  if (!d.desc) prob.push(`${rota}: sem meta description`);
  else if (d.desc.length > 165) prob.push(`${rota}: description com ${d.desc.length} caracteres`);
  if (descricoes.has(d.desc)) prob.push(`${rota}: description repetida de ${descricoes.get(d.desc)}`);
  descricoes.set(d.desc, rota);

  const esperado = `https://vegasaceleradora.com.br${rota}`;
  if (d.can !== esperado) prob.push(`${rota}: canonical ${d.can || "ausente"} (esperado ${esperado})`);
  if (/noindex/.test(d.rob)) prob.push(`${rota}: marcada noindex`);

  if (d.h1.length !== 1) prob.push(`${rota}: ${d.h1.length} H1`);
  for (let i = 1; i < d.niveis.length; i++) {
    if (d.niveis[i] - d.niveis[i - 1] > 1) {
      prob.push(`${rota}: salto de H${d.niveis[i - 1]} para H${d.niveis[i]}`);
      break;
    }
  }
  if (d.semAlt) prob.push(`${rota}: ${d.semAlt} imagem(ns) sem alt`);
  if (d.semDim) prob.push(`${rota}: ${d.semDim} imagem(ns) sem width/height`);
  if (!d.ldOk) prob.push(`${rota}: JSON-LD invalido`);
  if (!d.ld) prob.push(`${rota}: sem JSON-LD`);
  if (d.marcador) prob.push(`${rota}: texto placeholder visivel`);
  if (d.cru) prob.push(`${rota}: marcador de componente nao substituido`);
  if (d.palavras < 350) prob.push(`${rota}: ${d.palavras} palavras`);
  if (!d.sanduiche) prob.push(`${rota}: sem menu sanduiche`);
  for (const i of d.dup) prob.push(`${rota}: id duplicado "${i}"`);
  for (const a of d.ancoras) prob.push(`${rota}: ancora #${a} nao existe na pagina`);

  palavras += d.palavras;
  jsonld += d.ld;
  for (const l of d.links) internos.add(l.split("#")[0] || "/");
  await pg.close();
}
await ctx.close();

// ---------- links internos ----------
const pg = await (await nav.newContext()).newPage();
for (const l of [...internos].sort()) {
  const r = await pg.goto(BASE + l, { waitUntil: "commit" });
  if (!r || r.status() >= 400) prob.push(`link quebrado: ${l} -> ${r ? r.status() : "sem resposta"}`);
}

// ---------- mobile ----------
const mob = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
for (const rota of rotas) {
  const p = await mob.newPage();
  await p.goto(BASE + rota, { waitUntil: "load" });
  const d = await p.evaluate(() => {
    const vis = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.closest("details:not([open])");
    };
    const rotulo = (e) =>
      `${e.tagName.toLowerCase()}${e.className ? "." + String(e.className).split(/\s+/)[0] : ""} ` +
      `"${(e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28)}" ` +
      `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`;

    // 1. Controles de toque de verdade: botao, acordeao, campo. Meta de 44px
    //    (WCAG 2.5.5 AAA, que e a que a Vegas adotou).
    const alvos = [...document.querySelectorAll(".btn, button, summary, input, textarea, select, [role=button]")]
      .filter(vis)
      .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 24; })
      .map(rotulo);

    // 2. Links de navegacao em lista (menu, rodape). Nao sao "inline em bloco de
    //    texto", entao vale WCAG 2.5.8 AA: 24x24, ou 24px de folga ate o link
    //    vizinho. Link dentro de paragrafo tem a excecao de texto e fica fora.
    const emLista = [...document.querySelectorAll("nav li > a, footer li > a, footer a")]
      .filter(vis)
      .filter((e) => !e.classList.contains("btn"));
    for (const a of emLista) {
      const r = a.getBoundingClientRect();
      if (r.height >= 24 && r.width >= 24) continue;
      const perto = emLista.some((b) => {
        if (b === a) return false;
        const s = b.getBoundingClientRect();
        const dx = Math.abs((r.left + r.right) / 2 - (s.left + s.right) / 2);
        const dy = Math.abs((r.top + r.bottom) / 2 - (s.top + s.bottom) / 2);
        return Math.hypot(dx, dy) < 24;
      });
      if (perto) alvos.push(rotulo(a) + " (vizinho a menos de 24px)");
    }
    const pequenos = [...document.querySelectorAll("main p, main li, main td, main dd, main summary")]
      .filter(vis)
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 13).length;
    const sanduiche = !!document.querySelector(".topo details");
    const estoura = document.documentElement.scrollWidth > window.innerWidth + 1;
    return { alvos, pequenos, sanduiche, estoura, largura: document.documentElement.scrollWidth };
  });
  for (const a of d.alvos) prob.push(`mobile ${rota}: alvo de toque ${a}`);
  if (d.pequenos) prob.push(`mobile ${rota}: ${d.pequenos} bloco(s) com fonte < 13px`);
  if (!d.sanduiche) prob.push(`mobile ${rota}: sem sanduiche`);
  if (d.estoura) prob.push(`mobile ${rota}: rolagem horizontal (${d.largura}px)`);
  await p.close();
}

await nav.close();

console.log(`rotas auditadas: ${rotas.length}`);
console.log(`palavras no conteudo: ${palavras.toLocaleString("pt-BR")}`);
console.log(`blocos JSON-LD: ${jsonld}`);
console.log(`links internos distintos: ${internos.size}`);
console.log(prob.length ? `\nPROBLEMAS (${prob.length}):\n` + prob.join("\n") : "\nnenhum problema encontrado");
process.exit(prob.length ? 1 : 0);
