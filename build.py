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
# (arquivo de origem, destino, script de interatividade)
#
# A raiz (public/index.html) passou a ser gerada pelo construtor.py — a Home do
# site institucional. A LP continua sendo gerada, mas em /lp-antiga/: fica
# disponivel para comparacao, com noindex (ver constroi()) e fora do sitemap.
# Dois geradores escrevendo o mesmo arquivo era o conflito que isso resolve.
PAGINAS = [
    (ROOT / "src" / "Vegas Aceleradora v2.dc.html", ROOT / "public" / "lp-antiga" / "index.html", "/site.js"),
]
SRC = PAGINAS[0][0]
PUBLIC = ROOT / "public"
RUNTIME = ROOT / "runtime"
OUT = PUBLIC / "lp-antiga" / "index.html"

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


def monta_template(origem: pathlib.Path) -> str:
    html = origem.read_text(encoding="utf-8")
    if html.count(NEEDLE) != 1:
        raise SystemExit(f"erro: esperava 1 ocorrencia de {NEEDLE!r}, achei {html.count(NEEDLE)}")
    return html.replace(NEEDLE, SHIM)


def constroi(origem: pathlib.Path, destino: pathlib.Path, script: str) -> None:
    template = monta_template(origem)
    destino.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        palco = pathlib.Path(tmp) / "palco"
        palco.mkdir()
        (palco / "index.html").write_text(template, encoding="utf-8")
        # runtime: so existe aqui dentro, nunca em public/
        shutil.copy2(RUNTIME / "support.js", palco / "support.js")
        shutil.copytree(RUNTIME / "vendor", palco / "vendor")
        for nome in ASSETS:
            de = PUBLIC / nome
            if not de.exists():
                continue
            para = palco / nome
            if de.is_dir():
                shutil.copytree(de, para)
            else:
                shutil.copy2(de, para)

        r = subprocess.run(
            ["node", str(ROOT / "prerender.mjs"), str(palco), str(destino), script], cwd=ROOT)
        if r.returncode != 0:
            raise SystemExit(f"erro: a pre-renderizacao de {origem.name} falhou; "
                             f"{destino} nao foi tocado")

    # Paginas de preview nao podem ser indexadas: o canonical delas aponta para
    # a Home real, e sem noindex o Google trataria as duas como conteudo
    # duplicado da mesma URL.
    if destino.parent.name != "public":
        rel = "/" + destino.parent.relative_to(PUBLIC).as_posix() + "/"
        html = destino.read_text(encoding="utf-8")
        html = html.replace('content="index, follow, max-image-preview:large"',
                            'content="noindex, nofollow"')
        # O canonical do template aponta para a raiz, que hoje e outra pagina.
        # Deixar os dois sinais em conflito (noindex aqui, canonical para a raiz)
        # e pedir para o Google escolher; aponta para si mesma e nao ha conflito.
        html = html.replace('href="https://vegasaceleradora.com.br/"',
                            f'href="https://vegasaceleradora.com.br{rel}"')
        html = html.replace('content="https://vegasaceleradora.com.br/"',
                            f'content="https://vegasaceleradora.com.br{rel}"')
        # O template referencia img/, fonts/ e os favicons por caminho relativo,
        # porque nasceu na raiz. Servido de um subdiretorio, tudo isso viraria
        # 404. <base> resolve os tres de uma vez e nao muda nada na raiz.
        if "<base " not in html:
            html = html.replace("<head>", '<head>\n<base href="/">', 1)
        destino.write_text(html, encoding="utf-8")
        print(f"  {rel} marcada como noindex, canonical propria")


def main() -> int:
    if "--so-template" in sys.argv:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(monta_template(SRC), encoding="utf-8")
        print(f"template escrito em {OUT} — SEM pre-renderizacao")
        return 0

    alvo = None
    for i, a in enumerate(sys.argv):
        if a == "--pagina" and i + 1 < len(sys.argv):
            alvo = sys.argv[i + 1]

    for origem, destino, script in PAGINAS:
        if alvo and alvo not in origem.name:
            continue
        print(f"--- {origem.name}")
        constroi(origem, destino, script)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
