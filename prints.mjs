// Print de pagina inteira de cada rota, desktop e celular.
//
// Uso:
//   cd public && python3 -m http.server 8099 &
//   node prints.mjs http://127.0.0.1:8099 [pasta-de-saida]
//
// Por que reducedMotion: as entradas com data-reveal comecam invisiveis e so
// aparecem quando entram na tela. Num print de pagina inteira metade da pagina
// sairia em branco. Com movimento reduzido o vegas.js nem esconde.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";

const BASE = process.argv[2] || "http://127.0.0.1:8099";
const SAIDA = process.argv[3] || "prints";

const sitemap = readFileSync(new URL("./public/sitemap.xml", import.meta.url), "utf8");
const rotas = [...sitemap.matchAll(/<loc>https:\/\/vegasaceleradora\.com\.br([^<]*)<\/loc>/g)]
  .map((m) => m[1]);
rotas.push("/404.html");

const nomeDe = (r) =>
  r === "/" ? "home" : r.replace(/^\/|\/$/g, "").replace(/\//g, "--").replace(/\.html$/, "");

const nav = await chromium.launch();
const telas = [
  { nome: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { nome: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];

for (const tela of telas) {
  const dir = `${SAIDA}/${tela.nome}`;
  mkdirSync(dir, { recursive: true });
  const ctx = await nav.newContext({ ...tela, reducedMotion: "reduce" });
  for (const rota of rotas) {
    const pg = await ctx.newPage();
    await pg.goto(BASE + rota, { waitUntil: "load" });
    // O cabecalho e sticky: num print de pagina inteira ele acompanha a
    // rolagem e aparece carimbado no meio da pagina. Fixa no topo so para o print.
    await pg.addStyleTag({ content: ".topo{position:absolute !important}" });
    await pg.waitForTimeout(250);
    const arquivo = `${dir}/${nomeDe(rota)}.png`;
    await pg.screenshot({ path: arquivo, fullPage: true });
    console.log(`${tela.nome.padEnd(8)} ${rota.padEnd(44)} ${arquivo}`);
    await pg.close();
  }
  await ctx.close();
}
await nav.close();
console.log(`\n${rotas.length} rotas x ${telas.length} telas = ${rotas.length * telas.length} prints em ${SAIDA}/`);
