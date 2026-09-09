#!/usr/bin/env python3
"""Gera public/index.html a partir do template do Claude Design em src/.

Duas etapas:

1. Monta o template: injeta `window.__resources` para o runtime pegar o React
   de runtime/vendor/ em vez de unpkg.com.
2. Pre-renderiza: abre esse template num Chromium headless (prerender.mjs), deixa
   o runtime montar a pagina uma unica vez e salva o resultado como HTML estatico.

O visitante recebe a pagina pronta. O runtime (support.js + React, 207 KB) nunca
chega ao navegador dele — fica em runtime/, usado so aqui no build. A
interatividade volta pelo public/site.js, em JavaScript comum.

Requer node com playwright disponivel. Sem isso, use --so-template para gerar
apenas a etapa 1 (a pagina fica dependente do runtime, como era antes).
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src" / "Vegas Aceleradora v2.dc.html"
PUBLIC = ROOT / "public"
RUNTIME = ROOT / "runtime"
OUT = PUBLIC / "index.html"

SHIM = '''<script>
/* Runtime deps servidas localmente (runtime/vendor/) em vez de unpkg.com.
   `window.__resources` e o hook oficial do runtime (cdnScriptFor em support.js):
   quando a URL do CDN esta mapeada aqui, o runtime carrega o arquivo local.
   So vale durante a pre-renderizacao: a pagina publicada nao carrega nada disso. */
window.__resources = {
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js": "vendor/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js": "vendor/react-dom.production.min.js"
};
</script>
<script src="./support.js"></script>'''

NEEDLE = '<script src="./support.js"></script>'

# o que a pre-renderizacao precisa enxergar servido junto do template
ASSETS = ["img", "fonts", "favicon.ico", "favicon-96x96.png", "apple-touch-icon.png",
          "icon-192.png", "icon-512.png", "site.webmanifest", "robots.txt", "sitemap.xml"]


def monta_template() -> str:
    html = SRC.read_text(encoding="utf-8")
    if html.count(NEEDLE) != 1:
        raise SystemExit(f"erro: esperava 1 ocorrencia de {NEEDLE!r}, achei {html.count(NEEDLE)}")
    return html.replace(NEEDLE, SHIM)


def main() -> int:
    template = monta_template()

    if "--so-template" in sys.argv:
        OUT.write_text(template, encoding="utf-8")
        print(f"template escrito em {OUT} ({OUT.stat().st_size} bytes) — SEM pre-renderizacao")
        return 0

    with tempfile.TemporaryDirectory() as tmp:
        palco = pathlib.Path(tmp) / "palco"
        palco.mkdir()
        (palco / "index.html").write_text(template, encoding="utf-8")
        # runtime: so existe aqui dentro, nunca em public/
        shutil.copy2(RUNTIME / "support.js", palco / "support.js")
        shutil.copytree(RUNTIME / "vendor", palco / "vendor")
        for nome in ASSETS:
            origem = PUBLIC / nome
            if not origem.exists():
                continue
            destino = palco / nome
            if origem.is_dir():
                shutil.copytree(origem, destino)
            else:
                shutil.copy2(origem, destino)

        r = subprocess.run(["node", str(ROOT / "prerender.mjs"), str(palco), str(OUT)],
                           cwd=ROOT)
        if r.returncode != 0:
            raise SystemExit("erro: a pre-renderizacao falhou; public/index.html nao foi tocado")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
