#!/usr/bin/env python3
"""Construtor das paginas institucionais da Vegas.

Diferente do build.py
---------------------
O build.py pre-renderiza os templates exportados do Claude Design, que trazem
um runtime React junto. Serve para a LP que esta no ar.

Este construtor e para o site institucional: HTML semantico escrito a mao,
montado a partir de partes compartilhadas. Nao ha runtime, nao ha hidratacao,
nao ha framework. Para 36 paginas de conteudo isso e melhor em tudo que
importa aqui — peso, Core Web Vitals, indexacao e tempo de build.

O que ele monta sozinho, a partir de site/mapa.py
-------------------------------------------------
  <head> completo, canonical, Open Graph, JSON-LD
  cabecalho com menu (submenu no desktop, sanduiche no mobile)
  breadcrumbs
  rodape com a arquitetura inteira
  sitemap.xml so com as paginas que existem de verdade

Formato de uma pagina em site/paginas/*.html
--------------------------------------------
Um bloco JSON em comentario no topo, depois o HTML do conteudo:

    <!--dados
    { "url": "/", "titulo": "...", "descricao": "...", "h1": "..." }
    -->
    <section>...</section>

Uso:  python3 construtor.py [--pagina home]
"""
import json
import pathlib
import re
import sys
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).parent / "site"))
import mapa  # noqa: E402

RAIZ = pathlib.Path(__file__).parent
PAGINAS = RAIZ / "site" / "paginas"
PUBLIC = RAIZ / "public"

# Enquanto a Home nova esta em revisao ela sai em /v3/. Trocar para "" publica
# na raiz, e nenhum outro arquivo precisa mudar.
PREFIXO_PREVIA = "/v3"


# Indice url -> Pag, para resolver link interno pelo registro.
_POR_URL = {pg.url: pg for pg in mapa.TODAS}


# Links internos que o conteudo pode usar sem estar no registro de paginas.
_FORA_DO_REGISTRO = {"/"}

_desconhecidos = set()


def resolve(destino: str) -> str:
    """Troca link para pagina ainda nao publicada pela ancora equivalente.

    O conteudo das paginas escreve sempre a URL final (/servicos/x/). Enquanto
    aquela pagina nao existe, mandar o visitante para la e 404 — e 404 vindo de
    link interno o Google le como site mal cuidado.

    Entao o link e resolvido no build: pagina publicada vira link de verdade,
    pagina ainda nao publicada vira a ancora correspondente na Home, que tem o
    conteudo. Quando a pagina nascer, o mesmo link passa a apontar para ela sem
    que nenhum arquivo de conteudo mude.
    """
    pg = _POR_URL.get(destino)
    if pg:
        return pg.destino if not pg.publicada else destino
    # URL que nao esta no mapa: quase sempre erro de digitacao no conteudo, e
    # viraria 404 silencioso. Em 36 paginas isso nao se acha na mao.
    if destino not in _FORA_DO_REGISTRO and not destino.startswith(("/img/", "/fonts/")):
        _desconhecidos.add(destino)
    return destino


def link(destino: str) -> str:
    """Prefixa links internos enquanto o site esta em previa.

    Sem isto a previa nasce quebrada: o menu aponta para /servicos/..., que so
    existe na raiz. Com o prefixo, /v3/ e um site inteiro navegavel, e publicar
    continua sendo trocar PREFIXO_PREVIA por "".

    Ancora pura (#x), link externo e mailto passam intactos.
    """
    if not PREFIXO_PREVIA or not destino.startswith("/"):
        return destino
    return PREFIXO_PREVIA + destino


# ============================================================== cabecalho ===
def menu_desktop():
    itens = []
    for pag, filhos in mapa.MENU:
        if filhos:
            sub = "".join(
                f'<li><a href="{link(f.destino)}">{f.menu}</a></li>' for f in filhos
            )
            itens.append(
                f'<li class="tem-sub"><button type="button" aria-expanded="false">{pag.menu}</button>'
                f'<ul class="sub">'
                f'<li><a href="{link(pag.destino)}"><strong>Ver {pag.menu.lower()}</strong></a></li>'
                f'{sub}</ul></li>'
            )
        else:
            itens.append(f'<li><a href="{link(pag.destino)}">{pag.menu}</a></li>')
    return "".join(itens)


def menu_mobile():
    linhas = []
    for pag, filhos in mapa.MENU:
        linhas.append(f'<li><a href="{link(pag.destino)}">{pag.menu}</a></li>')
        if filhos:
            dentro = "".join(f'<li><a href="{link(f.destino)}">{f.menu}</a></li>' for f in filhos)
            linhas.append(f'<li><ul class="sub-mobile">{dentro}</ul></li>')
    return "".join(linhas)


def cabecalho():
    return f'''<header class="topo">
  <a class="topo-logo" href="{link("/")}" aria-label="Vegas Aceleradora — página inicial">
    <img src="{mapa.MARCA['logo']}" alt="Vegas Aceleradora" width="371" height="148" fetchpriority="high">
  </a>
  <nav class="topo-nav" aria-label="Navegação principal">
    <ul>{menu_desktop()}</ul>
    <a href="{link(mapa.DIAGNOSTICO.destino)}" class="btn btn-1" data-track-id="cta-diagnostico-topo" data-track-pos="Topo"><span class="so-largo">Solicitar&nbsp;</span>diagnóstico</a>
  </nav>
  <details class="sanduiche">
    <summary aria-label="Menu"><span class="barras" aria-hidden="true"></span></summary>
    <nav class="sanduiche-painel" aria-label="Navegação do menu">
      <ul>{menu_mobile()}</ul>
      <a href="{link(mapa.DIAGNOSTICO.destino)}" class="btn btn-1" data-track-id="cta-diagnostico-menu" data-track-pos="Menu">Solicitar diagnóstico</a>
    </nav>
  </details>
</header>'''


# ================================================================= rodape ===
def rodape():
    colunas = []
    for titulo, pags in mapa.RODAPE:
        itens = "".join(f'<li><a href="{link(p.destino)}">{p.menu}</a></li>' for p in pags)
        colunas.append(f'<div><h2>{titulo}</h2><ul>{itens}</ul></div>')
    m = mapa.MARCA
    return f'''<footer class="rodape">
  <div class="wrap">
    <div class="grade grade-4">
      <div>
        <img src="{m['logo']}" alt="Vegas Aceleradora" width="371" height="148" loading="lazy" style="height:38px;width:auto;display:block;margin-bottom:var(--e4)">
        <p style="font-size:var(--t-peq);max-width:34ch">{m['descricao']}</p>
      </div>
      {''.join(colunas)}
      <div>
        <h2>Contato</h2>
        <ul>
          <li><a href="mailto:{m['email']}" data-track-id="contato-email-rodape" data-track-pos="Rodapé">{m['email']}</a></li>
          <li><a href="{mapa.whatsapp()}" target="_blank" rel="noopener" data-track-id="cta-whatsapp-rodape" data-track-pos="Rodapé">{m['telefone_exibido']}</a></li>
        </ul>
      </div>
    </div>
    <div class="rodape-fim">
      <span>© {date.today().year} {m['nome']} — marketing para restaurantes e delivery.</span>
      <a href="{link(mapa.PRIVACIDADE.destino)}">Política de privacidade</a>
    </div>
  </div>
</footer>
<a class="zap" href="{mapa.whatsapp()}" target="_blank" rel="noopener"
   aria-label="Falar com a Vegas no WhatsApp"
   data-track-id="cta-whatsapp-flutuante" data-track-pos="Flutuante">
  <img src="/img/atendente-vegas-b.webp" alt="" width="136" height="136" loading="lazy" decoding="async">
</a>'''


# ============================================================ breadcrumbs ===
def trilha(d):
    """Breadcrumb visivel + o JSON-LD correspondente.

    So existe quando a pagina nao e a Home: trilha de um item so e ruido.
    O JSON-LD espelha exatamente o que esta na tela, nunca mais do que isso.
    """
    partes = d.get("trilha") or []
    if not partes:
        return "", ""
    itens, ld = [], []
    for i, (nome, url) in enumerate(partes, start=1):
        if url:
            itens.append(f'<li><a href="{link(resolve(url))}">{nome}</a></li>')
            destino = mapa.DOMINIO + url
        else:
            itens.append(f'<li><span aria-current="page">{nome}</span></li>')
            destino = mapa.DOMINIO + d["url"]
        ld.append({"@type": "ListItem", "position": i, "name": nome, "item": destino})
    html = f'<nav class="trilha" aria-label="Você está em"><div class="wrap"><ol>{"".join(itens)}</ol></div></nav>'
    bloco = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": ld}
    return html, json.dumps(bloco, ensure_ascii=False)


# =============================================================== JSON-LD ====
def organizacao():
    """So o que e verificavel no proprio site.

    Deliberadamente SEM foundingDate, numero de clientes ou qualquer metrica:
    dado estruturado e lido por maquina e citado por mecanismo de IA, entao uma
    afirmacao nao confirmada ali pesa mais do que no texto. Ver o registro de
    riscos em site/INVENTARIO.md.
    """
    m = mapa.MARCA
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": mapa.DOMINIO + "/#organizacao",
        "name": m["nome"],
        "url": mapa.DOMINIO + "/",
        "logo": mapa.DOMINIO + m["logo"],
        "email": m["email"],
        "telephone": m["telefone"],
        "description": m["descricao"],
        "areaServed": {"@type": "Country", "name": "Brasil"},
    }


def site_web():
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": mapa.DOMINIO + "/#site",
        "name": mapa.MARCA["nome"],
        "url": mapa.DOMINIO + "/",
        "inLanguage": "pt-BR",
        "publisher": {"@id": mapa.DOMINIO + "/#organizacao"},
    }


def faq_ld(html):
    """Monta FAQPage a partir do FAQ que ESTA na pagina.

    Lendo do HTML renderizado em vez de uma lista paralela: assim o dado
    estruturado nao pode divergir do texto visivel — se a pergunta sair da
    pagina, sai do schema junto. O briefing proibe FAQ artificial para
    manipular buscador, e um schema que nao bate com a tela e exatamente isso.
    """
    pares = re.findall(
        r'<details>\s*<summary>(.*?)</summary>\s*<div>(.*?)</div>\s*</details>',
        html, re.S)
    if not pares:
        return None
    limpa = lambda t: re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', t)).strip()
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": limpa(p),
             "acceptedAnswer": {"@type": "Answer", "text": limpa(r)}}
            for p, r in pares
        ],
    }


# ================================================================== pagina ===
def monta(arquivo: pathlib.Path) -> pathlib.Path:
    bruto = arquivo.read_text(encoding="utf-8")
    m = re.match(r'\s*<!--dados\s*(\{.*?\})\s*-->\s*(.*)', bruto, re.S)
    if not m:
        raise SystemExit(f"erro: {arquivo.name} nao tem o bloco <!--dados ... -->")
    d = json.loads(m.group(1))
    corpo = m.group(2)

    # O conteudo das paginas escreve as URLs reais (/servicos/..., /blog/...).
    # Na previa elas precisam do prefixo, senao cada link interno cai em 404.
    # Reescrever aqui, uma vez, evita ter de lembrar disso em 36 arquivos.
    corpo = re.sub(r'href="(/(?!/)[^"#][^"]*|/)"',
                   lambda m: f'href="{link(resolve(m.group(1)))}"', corpo)

    url = d["url"]
    canonical = mapa.DOMINIO + url
    trilha_html, trilha_ld = trilha(d)

    blocos = [organizacao(), site_web()]
    if trilha_ld:
        blocos.append(json.loads(trilha_ld))
    faq = faq_ld(corpo)
    if faq:
        blocos.append(faq)
    ld = "\n".join(
        f'<script type="application/ld+json">{json.dumps(b, ensure_ascii=False)}</script>'
        for b in blocos)

    og = d.get("og", "/img/hero-fundador-vegas-hd.webp")
    # Previa nao pode ser indexada: o canonical dela aponta para a URL real, e
    # sem noindex o Google trataria as duas como conteudo duplicado.
    robots = ("noindex, nofollow" if PREFIXO_PREVIA
              else "index, follow, max-image-preview:large")

    html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{d["titulo"]}</title>
<meta name="description" content="{d["descricao"]}">
<link rel="canonical" href="{canonical}">
<meta name="robots" content="{robots}">

<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0A0908">

<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="{mapa.MARCA['nome']}">
<meta property="og:title" content="{d["titulo"]}">
<meta property="og:description" content="{d["descricao"]}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{mapa.DOMINIO}{og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{d["titulo"]}">
<meta name="twitter:description" content="{d["descricao"]}">
<meta name="twitter:image" content="{mapa.DOMINIO}{og}">

<link rel="stylesheet" href="/fonts/poppins.css">
<link rel="preload" as="font" type="font/woff2" href="/fonts/poppins-400-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fonts/poppins-800-latin.woff2" crossorigin>
<link rel="stylesheet" href="/vegas.css">
{d.get("head", "")}
{ld}

<script async src="https://app.johnyweb.com/t.js" data-site="sit_6c66a1f9deba"></script>
<script async src="https://app.johnyweb.com/f.js" data-site="sit_6c66a1f9deba"></script>
</head>
<body>
<a class="pular" href="#conteudo">Ir para o conteúdo</a>
{cabecalho()}
{trilha_html}
<main id="conteudo">
{corpo}
</main>
{rodape()}
<script src="/vegas.js" defer></script>
</body>
</html>
'''

    destino = PUBLIC / (PREFIXO_PREVIA.strip("/") if PREFIXO_PREVIA else "")
    destino = destino / url.strip("/") / "index.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")
    return destino


# ================================================================= sitemap ===
def sitemap():
    """So as paginas que existem. Sitemap com URL inexistente e erro no Search
    Console; sitemap com previa noindex e pedido contraditorio."""
    if PREFIXO_PREVIA:
        print("  sitemap nao reescrito (modo previa)")
        return
    hoje = date.today().isoformat()
    urls = "".join(
        f'\n  <url>\n    <loc>{mapa.DOMINIO}{p.url}</loc>'
        f'\n    <lastmod>{hoje}</lastmod>'
        f'\n    <priority>{p.prioridade}</priority>\n  </url>'
        for p in mapa.TODAS if p.publicada)
    (PUBLIC / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!-- Gerado por construtor.py a partir de site/mapa.py.\n'
        '     Entra aqui somente pagina com publicada=True. -->\n'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}\n</urlset>\n',
        encoding="utf-8")
    print(f"  sitemap.xml com {sum(1 for p in mapa.TODAS if p.publicada)} URL(s)")


def main():
    alvo = None
    for i, a in enumerate(sys.argv):
        if a == "--pagina" and i + 1 < len(sys.argv):
            alvo = sys.argv[i + 1]

    arquivos = sorted(PAGINAS.glob("*.html"))
    if not arquivos:
        raise SystemExit("erro: nenhuma pagina em site/paginas/")
    for f in arquivos:
        if alvo and alvo not in f.stem:
            continue
        destino = monta(f)
        kb = destino.stat().st_size // 1024
        print(f"  {f.name} -> {destino.relative_to(RAIZ)} ({kb} KB)")
    if _desconhecidos:
        print("\n  ERRO: link interno fora do mapa de paginas:")
        for u in sorted(_desconhecidos):
            print(f"    {u}")
        raise SystemExit("corrija o link ou acrescente a pagina em site/mapa.py")
    sitemap()
    if PREFIXO_PREVIA:
        print(f"\n  previa em {PREFIXO_PREVIA}/ — marcada noindex.")
        print("  Para publicar na raiz: PREFIXO_PREVIA = \"\" em construtor.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
