// LCP, CLS e peso transferido por pagina. Medido em mobile emulado, que e o
// perfil que o Google usa para ranquear.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const BASE = process.argv[2] || "http://127.0.0.1:8099";
const sitemap = readFileSync(new URL("./public/sitemap.xml", import.meta.url), "utf8");
const rotas = [...sitemap.matchAll(/<loc>https:\/\/vegasaceleradora\.com\.br([^<]*)<\/loc>/g)].map((m) => m[1]);
rotas.push("/404.html");

const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  deviceScaleFactor: 3,
});
const linhas = [];
for (const rota of rotas) {
  const pg = await ctx.newPage();
  let bytes = 0;
  pg.on("response", async (r) => {
    try {
      const n = +(r.headers()["content-length"] || 0);
      bytes += n || (await r.body().then((b) => b.length).catch(() => 0));
    } catch {}
  });
  await pg.goto(BASE + rota, { waitUntil: "load" });
  const v = await pg.evaluate(() => new Promise((ok) => {
    let lcp = 0, cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; })
      .observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    const nv = performance.getEntriesByType("navigation")[0];
    setTimeout(() => {
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      ok({ lcp, cls, fcp: fcp ? fcp.startTime : 0, ttfb: nv ? nv.responseStart : 0,
           nos: document.querySelectorAll("*").length });
    }, 900);
  }));
  linhas.push({ rota, ...v, kb: Math.round(bytes / 1024) });
  await pg.close();
}
await nav.close();

const n = (x) => String(Math.round(x)).padStart(5);
console.log("rota".padEnd(44), "LCP", "  FCP", "  CLS", "  DOM", "    KB");
for (const l of linhas.sort((a, b) => b.lcp - a.lcp)) {
  console.log(l.rota.padEnd(44), n(l.lcp), n(l.fcp), l.cls.toFixed(3).padStart(5),
              n(l.nos), n(l.kb));
}
const pior = linhas.reduce((a, b) => (b.lcp > a.lcp ? b : a));
const clsMax = linhas.reduce((a, b) => (b.cls > a.cls ? b : a));
console.log(`\npior LCP: ${Math.round(pior.lcp)} ms em ${pior.rota}  (bom <= 2500)`);
console.log(`pior CLS: ${clsMax.cls.toFixed(3)} em ${clsMax.rota}  (bom <= 0.1)`);
console.log(`peso medio: ${Math.round(linhas.reduce((s, l) => s + l.kb, 0) / linhas.length)} KB`);
