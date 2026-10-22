#!/usr/bin/env python3
"""Inventario de SEO das paginas publicadas, lido do HTML construido.

Responde tres perguntas que nao da para responder olhando o site:

  1. Que palavra-chave cada pagina persegue, e ela aparece onde deveria
     (titulo, H1, descricao, primeiro paragrafo, corpo)?
  2. Duas paginas estao disputando o mesmo termo? (canibalizacao)
  3. Ha conteudo repetido entre paginas?

Le o resultado do build, nao a intencao: o que esta aqui e o que o buscador
vai encontrar. A chave alvo vem do bloco <!--dados--> de cada pagina, que o
construtor imprime no HTML como comentario.

Uso:  python3 analise-seo.py [--xlsx saida.xlsx]
"""
import argparse
import json
import pathlib
import re
import sys
import unicodedata
from collections import Counter
from itertools import combinations

RAIZ = pathlib.Path(__file__).parent
PUBLIC = RAIZ / "public"
sys.path.insert(0, str(RAIZ / "site"))
import mapa  # noqa: E402

ROTAS = [p for p in mapa.TODAS if p.publicada]
POR_URL = {p.url: p for p in ROTAS}


# ------------------------------------------------------------- utilidades ---
def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower())
                   if unicodedata.category(c) != "Mn")


def normaliza(s):
    """Minusculas, sem acento, so letras e numeros separados por espaco.

    Comparar 'Marketing para Pizzarias' com 'marketing para pizzaria' exige
    isso; sem normalizar, metade das ocorrencias passaria batido.
    """
    return re.sub(r"[^a-z0-9]+", " ", sem_acento(s)).strip()


def texto_de(html):
    """So o conteudo: fora <head>, <script>, cabecalho e rodape.

    Cabecalho e rodape repetem em 33 paginas. Incluidos na comparacao, toda
    pagina pareceria 40% igual a todas as outras e a deteccao de duplicata
    nao serviria para nada.
    """
    m = re.search(r'<main id="conteudo">(.*?)</main>', html, re.S)
    corpo = m.group(1) if m else html
    corpo = re.sub(r"<(script|style)\b.*?</\1>", " ", corpo, flags=re.S)
    corpo = re.sub(r"<!--.*?-->", " ", corpo, flags=re.S)
    corpo = re.sub(r"<[^>]+>", " ", corpo)
    corpo = corpo.replace("&nbsp;", " ").replace("&amp;", "&")
    corpo = corpo.replace("&quot;", '"').replace("&#39;", "'")
    corpo = corpo.replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\s+", " ", corpo).strip()


def trechos(texto, n=8):
    """Janelas de n palavras. Duas paginas que compartilham muitas janelas
    repetem texto, ainda que em ordem diferente."""
    p = normaliza(texto).split()
    return {" ".join(p[i:i + n]) for i in range(max(0, len(p) - n + 1))}


# ----------------------------------------------------------------- leitura ---
def le(url):
    arq = PUBLIC / (url.strip("/") + "/index.html").lstrip("/")
    html = arq.read_text(encoding="utf-8")
    pega = lambda p, d="": (re.search(p, html, re.S).group(1).strip()
                            if re.search(p, html, re.S) else d)

    corpo = texto_de(html)
    chave = pega(r"<!-- chave-alvo: (.*?) -->")
    if chave == "(sem alvo de busca)":
        chave = ""

    ligacoes = []
    m = re.search(r'<main id="conteudo">(.*?)</main>', html, re.S)
    if m:
        for href in re.findall(r'href="(/[^"#]*)"', m.group(1)):
            if href in POR_URL and href != url and href not in ligacoes:
                ligacoes.append(href)

    return {
        "url": url,
        "chave": chave,
        "titulo": pega(r"<title>(.*?)</title>"),
        "descricao": pega(r'<meta name="description" content="(.*?)"'),
        "h1": re.sub(r"<[^>]+>", "", pega(r"<h1[^>]*>(.*?)</h1>")).strip(),
        "h2": [re.sub(r"<[^>]+>", "", t).strip()
               for t in re.findall(r"<h2[^>]*>(.*?)</h2>", html, re.S)],
        "robots": pega(r'<meta name="robots" content="(.*?)"'),
        "canonical": pega(r'<link rel="canonical" href="(.*?)"'),
        "texto": corpo,
        "palavras": len(corpo.split()),
        "saem": ligacoes,
    }


def onde_aparece(pag):
    """Em quais lugares a chave aparece, e quantas vezes no corpo.

    Duas medidas, porque elas dizem coisas diferentes:

      exata   a expressao inteira, na ordem. E o que casa com a busca literal.
      solta   todas as palavras da chave presentes, em qualquer ordem. Um H1
              como "Pizzaria que so lota no fim de semana" nao tem a expressao
              "marketing para pizzarias", mas trata do assunto. Cobrar so a
              forma exata transformaria todo titulo editorial em erro.
    """
    if not pag["chave"]:
        return {}
    c = normaliza(pag["chave"])
    partes = [p for p in c.split() if p not in ("para", "de", "do", "da", "o", "a", "em", "no", "na")]
    corpo = normaliza(pag["texto"])
    primeiro = " ".join(corpo.split()[:60])

    def exata(t):
        return c in normaliza(t)

    def solta(t):
        n = normaliza(t)
        return all(p in n for p in partes)

    return {
        "titulo": exata(pag["titulo"]),
        "titulo_solta": solta(pag["titulo"]),
        "h1": exata(pag["h1"]),
        "h1_solta": solta(pag["h1"]),
        "descricao": exata(pag["descricao"]),
        "descricao_solta": solta(pag["descricao"]),
        "primeiro_paragrafo": c in primeiro,
        "url": c.replace(" ", "-") in sem_acento(pag["url"]),
        "h2": any(exata(h) for h in pag["h2"]),
        "vezes": corpo.count(c),
        "densidade": round(100 * corpo.count(c) * len(c.split()) / max(1, len(corpo.split())), 2),
    }


# ------------------------------------------------------------------ analise ---
def analisa():
    pags = [le(p.url) for p in ROTAS]
    por_url = {p["url"]: p for p in pags}

    entram = {p["url"]: [] for p in pags}
    for p in pags:
        for d in p["saem"]:
            entram[d].append(p["url"])

    for p in pags:
        p["onde"] = onde_aparece(p)
        p["entram"] = entram[p["url"]]
        p["menu"] = POR_URL[p["url"]].menu

    # --- canibalizacao -------------------------------------------------------
    # Uma chave dentro da outra nem sempre e disputa. "agencia de marketing
    # para restaurantes" contem "marketing para restaurantes", mas quem busca
    # os dois termos quer coisas diferentes: um quer contratar, o outro quer
    # entender. Essas palavras na frente MUDAM A INTENCAO, e por isso sao
    # tratadas como qualificador, nao como disputa.
    QUALIFICADORES = ("agencia", "assessoria", "metodo", "servicos", "servico",
                      "diagnostico", "resultados", "blog", "guia", "consultoria")

    def familia(url):
        if url.startswith("/blog/") and url != "/blog/":
            return "artigo"
        if url.startswith("/servicos/") and url != "/servicos/":
            return "servico"
        if url.startswith("/marketing-para-"):
            return "segmento"
        return "institucional"

    def contida(curta, longa):
        """Sequencia de PALAVRAS contida, nao pedaco de texto.

        Por substring, 'remarketing para restaurantes' contem 'marketing para
        restaurantes' — e remarketing nao e marketing. Comparando palavra a
        palavra, nao contem.
        """
        c, l = curta.split(), longa.split()
        return any(l[i:i + len(c)] == c for i in range(len(l) - len(c) + 1))

    canibal = []
    for a, b in combinations([p for p in pags if p["chave"]], 2):
        ca, cb = normaliza(a["chave"]), normaliza(b["chave"])
        if ca == cb:
            tipo, risco = "mesma chave", "alto"
            nota = "As duas perseguem o termo identico. Uma precisa mudar de alvo."
        elif contida(ca, cb) or contida(cb, ca):
            curta, longa = (ca, cb) if len(ca.split()) < len(cb.split()) else (cb, ca)
            pc, pl = curta.split(), longa.split()
            inicio = pl.index(pc[0])
            antes, depois = pl[:inicio], pl[inicio + len(pc):]
            tipo = "chave contida"
            if any(q in antes for q in QUALIFICADORES):
                risco = "baixo"
                nota = ("'" + " ".join(antes) + "' na frente muda a intencao "
                        "da busca. Convivem bem.")
            elif depois:
                risco = "medio"
                nota = ("'" + " ".join(depois) + "' no fim e um recorte mais "
                        "especifico (cauda longa). Normal, mas confira qual "
                        "das duas o Google escolhe para o termo curto.")
            else:
                risco = "alto"
                nota = ("Mesmo nucleo sem qualificador que separe a intencao ("
                        + familia(a["url"]) + " x " + familia(b["url"]) + ").")
        else:
            continue
        canibal.append({"a": a["url"], "chave_a": a["chave"],
                        "b": b["url"], "chave_b": b["chave"],
                        "tipo": tipo, "risco": risco, "nota": nota})
    ordem = {"alto": 0, "medio": 1, "baixo": 2}
    canibal.sort(key=lambda c: ordem[c["risco"]])

    # --- duplicacao de conteudo
    assinaturas = {p["url"]: trechos(p["texto"]) for p in pags}
    dup = []
    for a, b in combinations(pags, 2):
        sa, sb = assinaturas[a["url"]], assinaturas[b["url"]]
        if not sa or not sb:
            continue
        comuns = sa & sb
        # Jaccard mede semelhanca geral; a fracao do menor mostra quanto da
        # pagina MENOR esta repetido na maior, que e o que realmente importa.
        jac = len(comuns) / len(sa | sb)
        menor = len(comuns) / min(len(sa), len(sb))
        if menor >= 0.08 or jac >= 0.06:
            exemplo = max(comuns, key=len) if comuns else ""
            dup.append({"a": a["url"], "b": b["url"],
                        "semelhanca": round(100 * jac, 1),
                        "do_menor": round(100 * menor, 1),
                        "trechos": len(comuns), "exemplo": exemplo})
    dup.sort(key=lambda d: -d["do_menor"])

    # --- frases repetidas em 3 paginas ou mais
    contagem = Counter()
    for p in pags:
        for t in trechos(p["texto"], 10):
            contagem[t] += 1
    repetidas = [(t, n) for t, n in contagem.most_common(40) if n >= 3]

    return pags, canibal, dup, repetidas


# ------------------------------------------------------------------ saida ----
def imprime(pags, canibal, dup, repetidas):
    print(f"{len(pags)} paginas publicadas\n")

    sem_chave = [p for p in pags if not p["chave"]]
    print(f"--- palavra-chave ---")
    print(f"  com alvo declarado: {len(pags) - len(sem_chave)}")
    for p in sem_chave:
        print(f"  sem alvo (de proposito): {p['url']}")

    print("\n--- chave nem solta aparece (titulo / H1 / descricao) ---")
    falhas = 0
    for p in pags:
        o = p["onde"]
        if not o:
            continue
        faltando = [k for k in ("titulo", "h1", "descricao") if not o[k + "_solta"]]
        if faltando:
            falhas += 1
            print(f"  {p['url']}  '{p['chave']}' ausente de: {', '.join(faltando)}")
    if not falhas:
        print("  nenhuma: as palavras da chave aparecem nos tres, em alguma forma")

    print(f"\n--- canibalizacao ({len(canibal)}) ---")
    for nivel in ("alto", "medio"):
        for c in [x for x in canibal if x["risco"] == nivel]:
            print(f"  [{nivel}] {c['a']} ({c['chave_a']})")
            print(f"        x {c['b']} ({c['chave_b']})")
            print(f"          {c['nota']}")
    baixos = len([c for c in canibal if c["risco"] == "baixo"])
    print(f"  (+{baixos} par(es) de risco baixo: qualificador muda a intencao)")

    print(f"\n--- conteudo repetido entre paginas ({len(dup)}) ---")
    for d in dup[:12]:
        print(f"  {d['do_menor']:5.1f}% da menor | {d['a']} x {d['b']}")
        print(f"         ex.: \"{d['exemplo'][:70]}...\"")
    if not dup:
        print("  nenhum par acima do limite")

    print(f"\n--- frases em 3+ paginas ({len(repetidas)}) ---")
    for t, n in repetidas[:8]:
        print(f"  {n}x  \"{t[:68]}...\"")
    if not repetidas:
        print("  nenhuma")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", help="grava a planilha neste caminho")
    ap.add_argument("--json", help="grava os dados crus neste caminho")
    args = ap.parse_args()

    pags, canibal, dup, repetidas = analisa()
    imprime(pags, canibal, dup, repetidas)

    if args.json:
        pathlib.Path(args.json).write_text(json.dumps(
            {"paginas": [{k: v for k, v in p.items() if k != "texto"} for p in pags],
             "canibalizacao": canibal, "duplicacao": dup,
             "repetidas": repetidas}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\ndados em {args.json}")

    if args.xlsx:
        import planilha_seo
        planilha_seo.grava(args.xlsx, pags, canibal, dup, repetidas)
        print(f"planilha em {args.xlsx}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
