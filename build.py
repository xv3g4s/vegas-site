#!/usr/bin/env python3
"""Gera public/index.html a partir do template do Claude Design em src/.

Unica transformacao: injeta `window.__resources` antes do support.js, para o
runtime carregar o React de vendor/ (local) em vez de unpkg.com.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src" / "Vegas Aceleradora v2.dc.html"
OUT = ROOT / "public" / "index.html"

SHIM = '''<script>
/* Runtime deps servidas localmente (vendor/) em vez de unpkg.com.
   `window.__resources` e o hook oficial do runtime (cdnScriptFor em support.js):
   quando a URL do CDN esta mapeada aqui, o runtime carrega o arquivo local.
   Mantem o site 100% self-contained na HostGator, sem depender de CDN externo. */
window.__resources = {
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js": "vendor/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js": "vendor/react-dom.production.min.js"
};
</script>
<script src="./support.js"></script>'''

NEEDLE = '<script src="./support.js"></script>'


def main() -> int:
    html = SRC.read_text(encoding="utf-8")
    if html.count(NEEDLE) != 1:
        print(f"erro: esperava 1 ocorrencia de {NEEDLE!r}, achei {html.count(NEEDLE)}",
              file=sys.stderr)
        return 1
    OUT.write_text(html.replace(NEEDLE, SHIM), encoding="utf-8")
    print(f"public/index.html gerado ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
