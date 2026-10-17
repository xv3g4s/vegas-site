#!/usr/bin/env python3
"""Gera site/MAPA-DE-LINKS.md a partir do HTML ja construido em public/.

Uso: python3 site/mapa_de_links.py  (depois de rodar o construtor.py)

Le o resultado, nao a intencao: o que esta aqui e o que o visitante encontra.
Cabecalho e rodape aparecem em todas as paginas, entao os links de navegacao
sao contados a parte — senao toda pagina teria 30 entradas iguais e o mapa nao
diria nada.
"""
import pathlib
import re
import sys
from collections import defaultdict

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = RAIZ / "public"
sys.path.insert(0, str(RAIZ / "site"))
import mapa  # noqa: E402

ROTAS = [p for p in mapa.TODAS if p.publicada]
POR_URL = {p.url: p for p in ROTAS}


def corpo_de(url: str) -> str:
    arq = PUBLIC / (url.strip("/") + "/index.html").lstrip("/")
    html = arq.read_text(encoding="utf-8")
    m = re.search(r'<main id="conteudo">(.*?)</main>', html, re.S)
    return m.group(1) if m else ""


# url -> links de conteudo que saem dela (sem cabecalho/rodape, sem repeticao)
saem = {}
for p in ROTAS:
    vistos = []
    for href in re.findall(r'href="(/[^"#]*)"', corpo_de(p.url)):
        if href in POR_URL and href != p.url and href not in vistos:
            vistos.append(href)
    saem[p.url] = vistos

entram = defaultdict(list)
for origem, destinos in saem.items():
    for d in destinos:
        entram[d].append(origem)

linhas = [
    "# Mapa de links internos",
    "",
    "Gerado a partir do HTML construido em `public/`, nao do plano: o que esta",
    "aqui e o que o visitante encontra depois do build.",
    "",
    "**Links de navegacao nao entram nesta contagem.** Cabecalho e rodape levam",
    "a arquitetura inteira em todas as 33 paginas — se contassem, cada pagina",
    "teria as mesmas 30 entradas e o mapa nao diria nada. O que esta abaixo sao",
    "os links escritos dentro do conteudo, que e o que distribui relevancia e o",
    "que o leitor realmente segue.",
    "",
    f"- Paginas publicadas: **{len(ROTAS)}**",
    f"- Ligacoes de conteudo: **{sum(len(v) for v in saem.values())}**",
    f"- Media por pagina: **{sum(len(v) for v in saem.values()) / len(ROTAS):.1f}**",
    "",
    "## Paginas que ninguem cita no conteudo",
    "",
]

orfas = [p for p in ROTAS if not entram[p.url] and p.url != "/"]
if orfas:
    linhas += [
        "Alcancaveis pelo menu e pelo rodape (nao sao orfas de verdade), mas sem",
        "nenhuma mencao dentro de texto. Vale observar se alguma merece ser citada:",
        "",
    ]
    linhas += [f"- `{p.url}` — {p.menu}" for p in orfas]
else:
    linhas.append("Nenhuma: toda pagina publicada e citada no conteudo de outra.")
linhas.append("")

linhas += ["## Mais citadas", "", "| Pagina | Citacoes | De onde |", "|---|---:|---|"]
ranking = sorted(ROTAS, key=lambda p: -len(entram[p.url]))
for p in ranking[:12]:
    de = ", ".join(f"`{u}`" for u in entram[p.url][:6])
    if len(entram[p.url]) > 6:
        de += f" (+{len(entram[p.url]) - 6})"
    linhas.append(f"| `{p.url}` | {len(entram[p.url])} | {de or '—'} |")
linhas.append("")

linhas += ["## Saidas de cada pagina", ""]
for p in ROTAS:
    linhas.append(f"### `{p.url}` — {p.menu}")
    if saem[p.url]:
        for d in saem[p.url]:
            linhas.append(f"- → `{d}` ({POR_URL[d].menu})")
    else:
        linhas.append("- (sem links de conteudo; so navegacao)")
    recebe = entram[p.url]
    linhas.append(f"- recebe {len(recebe)} citacao(oes)"
                  + (": " + ", ".join(f"`{u}`" for u in recebe) if recebe else ""))
    linhas.append("")

(RAIZ / "site" / "MAPA-DE-LINKS.md").write_text("\n".join(linhas), encoding="utf-8")
print(f"site/MAPA-DE-LINKS.md — {len(ROTAS)} paginas, "
      f"{sum(len(v) for v in saem.values())} ligacoes de conteudo, "
      f"{len(orfas)} sem citacao em texto")
