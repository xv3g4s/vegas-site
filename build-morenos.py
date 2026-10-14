#!/usr/bin/env python3
"""Gera public/morenos/index.html a partir do design em src/morenos/.

Tres etapas:

1. Monta o template: troca a Poppins do Google por uma copia local e injeta
   `window.__resources`, o hook do runtime para pegar o React de vendor/ em vez
   de unpkg.com. Nenhuma requisicao a dominio de terceiro sai da pagina.
2. Pre-renderiza (prerender-morenos.mjs): abre esse template num Chromium
   headless em viewport de celular, deixa o runtime montar a pagina e guarda o
   resultado como HTML estatico.
3. Publica as duas camadas juntas: a copia estatica (primeiro quadro e SEO) e o
   template + runtime com `defer` (interacoes). Quando o React monta, a copia
   estatica sai da tela. Ver o cabecalho do prerender-morenos.mjs.

Diferenca para o build.py da Vegas: la o runtime fica so no build, porque aquela
pagina quase nao tem estado. Aqui ele e publicado (63 KB gzip), porque esta
pagina e cheia de estado e uma segunda implementacao em JavaScript comum
divergiria do design na primeira reexportacao.

Requer node com playwright disponivel. Sem isso, use --so-template para gerar
apenas a etapa 1 (a pagina fica dependente do runtime, sem copia estatica).
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src" / "morenos" / "Home.dc.html"
EXTRAS = ROOT / "src" / "morenos" / "extras-head.html"
DESTINO = ROOT / "public" / "morenos"
RUNTIME = ROOT / "runtime"
OUT = DESTINO / "index.html"

# A Poppins do Google vira copia local (public/morenos/fonts/).
FONTES_GOOGLE = """<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />"""

FONTES_LOCAIS = '<link rel="stylesheet" href="fonts/poppins.css" />'

# Correcao de layout no celular, aplicada no build.
#
# A moldura do carrossel de etapas usa `aspect-ratio:16/11` com
# `min-height:280px`. As duas coisas juntas criam uma largura minima de
# 280 * 16/11 = 407px, e o item flex que a segura nao pode encolher abaixo
# disso. Num aparelho de 390px o navegador ALARGA o viewport para 423px para
# caber: a pagina inteira diminui e todo elemento `position:fixed` (modal de
# unidades, lightbox, barra inferior) passa a medir 423px, ficando com a borda
# direita fora da tela — e o botao de fechar do modal sai junto.
#
# `min-width:0` devolve ao item flex o direito de encolher. A moldura entao fica
# 358x280 no celular, um pouco mais alta que a proporcao pedida, em vez de
# empurrar a pagina para fora.
#
# Se o design for reexportado com essa medida corrigida no proprio Claude
# Design, este trecho deixa de encontrar a agulha e o build avisa.
ETAPAS_ORIGINAL = '<div style="flex:1 1 420px;order:1"'
ETAPAS_CORRIGIDO = '<div style="flex:1 1 420px;min-width:0;order:1"'

SHIM = '''<script>
/* Runtime deps servidas localmente (vendor/) em vez de unpkg.com.
   `window.__resources` e o hook oficial do runtime (cdnScriptFor em support.js):
   quando a URL do CDN esta mapeada aqui, o runtime carrega o arquivo local. */
window.__resources = {
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js": "vendor/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js": "vendor/react-dom.production.min.js"
};
</script>
<script src="./support.js" defer></script>'''

AGULHA = '<script src="./support.js"></script>'


def monta_template() -> str:
    html = SRC.read_text(encoding="utf-8")
    for agulha, troca, nome in ((AGULHA, SHIM, "a tag do support.js"),
                                (FONTES_GOOGLE, FONTES_LOCAIS, "os links da Poppins do Google"),
                                (ETAPAS_ORIGINAL, ETAPAS_CORRIGIDO,
                                 "a moldura do carrossel de etapas")):
        if html.count(agulha) != 1:
            raise SystemExit(f"erro: esperava 1 ocorrencia de {nome}, achei {html.count(agulha)}")
        html = html.replace(agulha, troca)
    return html


def main() -> int:
    template = monta_template()

    # o runtime e publicado nesta pagina: entra junto em public/morenos/
    shutil.copy2(RUNTIME / "support.js", DESTINO / "support.js")
    shutil.copytree(RUNTIME / "vendor", DESTINO / "vendor", dirs_exist_ok=True)

    if "--so-template" in sys.argv:
        OUT.write_text(template, encoding="utf-8")
        print(f"template escrito em {OUT} ({OUT.stat().st_size} bytes) — SEM copia estatica")
        return 0

    with tempfile.TemporaryDirectory() as tmp:
        palco = pathlib.Path(tmp) / "palco"
        palco.mkdir()
        (palco / "index.html").write_text(template, encoding="utf-8")
        shutil.copy2(RUNTIME / "support.js", palco / "support.js")
        shutil.copytree(RUNTIME / "vendor", palco / "vendor")
        for nome in ("img", "fonts"):
            shutil.copytree(DESTINO / nome, palco / nome)

        r = subprocess.run(
            ["node", str(ROOT / "prerender-morenos.mjs"), str(palco), str(OUT), str(EXTRAS)],
            cwd=ROOT)
        if r.returncode != 0:
            raise SystemExit("erro: a pre-renderizacao falhou; public/morenos/index.html nao foi tocado")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
