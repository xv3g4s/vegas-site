"""Os componentes da Home, disponiveis para as outras 32 paginas.

Por que isto existe
-------------------
A Home foi escrita primeiro e ficou com o vocabulario visual inteiro: faixa de
frentes sob o heroi, lista editorial numerada, cards com chips, parede de
logos, FAQ e o bloco final com formulario. As paginas internas nasceram depois,
em marcacao propria, e ficaram mais pobres — e, pior, com os mesmos blocos
copiados a mao em dezenas de arquivos: a parede de logos existia identica em
tres paginas, e o CTA de fechamento em trinta.

Aqui cada bloco tem uma definicao so. A pagina chama por marcador:

    {{FAIXA|Aquisição|Conversão|Recorrência}}
    {{LOGOS}}
    {{FORM}}
    {{CTA|Título|Linha de apoio|Posição no rastreio}}
    {{CTA-FORM|Título|Linha de apoio|Posição no rastreio}}
    {{PROXIMOS|/url/|Título|Chamada|/url/|Título|Chamada|...}}
    {{SERVICOS}} {{SEGMENTOS}} {{ARTIGOS}} {{CATEGORIAS}}

O texto continua na pagina, porque texto e conteudo; o que e compartilhado e a
estrutura. Trocar o visual de um bloco em 33 paginas passa a ser editar uma
funcao aqui.

URLs cruas, de proposito
------------------------
Nenhum componente prefixa link. Quem resolve e prefixa e o reescritor de hrefs
do construtor, que roda depois da substituicao. Prefixar aqui faria o link
passar duas vezes e quebrar a previa.
"""
import re

import mapa


# ------------------------------------------------------- faixa de frentes ---
def faixa(*palavras):
    """A tira sob o heroi, com um ponto dourado entre as palavras.

    Na Home sao as tres frentes do metodo. Nas paginas internas sao os tres
    eixos daquele assunto — mesma forma, conteudo proprio.

    O separador NAO e um <li>: e `.faixa li + li::before` no CSS. Como item de
    flex independente ele sobrava sozinho no inicio da segunda linha quando a
    faixa quebrava no celular ("• RECORRENCIA"). Pertencendo ao item, quebra
    junto com a palavra.
    """
    itens = "".join(f"<li>{p}</li>" for p in palavras)
    return f'<section class="faixa superficie"><ul>{itens}</ul></section>'


# --------------------------------------------------------- parede de logos ---
def logos():
    """As marcas atendidas, a partir de mapa.CLIENTES.

    `object-fit:contain` e proposital: sao logotipos de proporcoes diferentes, e
    `cover` cortaria o nome de metade deles.
    """
    itens = "".join(
        f'<li><img src="/img/{arquivo}" alt="{nome}" width="756" height="426"'
        f' loading="lazy" decoding="async"'
        f' style="display:block;width:100%;height:auto;aspect-ratio:16/9;'
        f'object-fit:contain;border-radius:var(--r-peq)"></li>'
        for arquivo, nome in mapa.CLIENTES)
    return ('<ul class="grade grade-4" style="list-style:none;margin:0;padding:0;'
            f'gap:var(--e4)" data-reveal>{itens}</ul>')


# ------------------------------------------------------------- formulario ---
def form():
    """O formulario de diagnostico, identico ao da Home.

    Uma definicao so: os nomes dos campos sao contrato com o vegas.js (que
    valida e monta o payload) e com o f.js do painel (que classifica os campos
    pelo name). Duas copias divergindo quebrariam um dos dois em silencio.
    """
    tipos = ["Restaurante", "Pizzaria", "Hamburgueria", "Restaurante japonês",
             "Cafeteria", "Bar", "Dark kitchen", "Delivery", "Outro"]
    opcoes = "".join(f"<option>{t}</option>" for t in tipos)
    return f'''<form data-form-diagnostico novalidate>
<label class="campo"><span>Nome</span>
<input type="text" name="nome" autocomplete="name" placeholder="Seu nome" required></label>
<label class="campo"><span>WhatsApp</span>
<input type="tel" name="whatsapp" autocomplete="tel" placeholder="(DDD) 9 9999-9999" required></label>
<label class="campo"><span>E-mail</span>
<input type="email" name="email" autocomplete="email" placeholder="seu@email.com.br" required></label>
<label class="campo"><span>Nome do estabelecimento</span>
<input type="text" name="estabelecimento" autocomplete="organization" placeholder="Como o seu negócio se chama" required></label>
<label class="campo"><span>Tipo de estabelecimento</span>
<select name="tipo"><option value="">Selecione</option>{opcoes}</select></label>
<label class="campo"><span>Principal desafio <span style="font-weight:400;color:var(--tinta-escura-2)">(opcional)</span></span>
<textarea name="desafio" placeholder="O que mais te incomoda hoje no marketing da operação?"></textarea></label>
<p class="form-erro" data-form-erro role="alert"></p>
<button type="submit" class="btn btn-1" style="width:100%"
        data-track-id="form-diagnostico-enviar" data-track-pos="Diagnóstico">Solicitar diagnóstico gratuito</button>
<p class="form-ok" data-form-ok role="status" tabindex="-1" style="margin-top:var(--e3)"></p>
<p style="font-size:14px;color:var(--tinta-escura-2);text-align:center;margin:var(--e3) 0 0">
  Seus dados são usados apenas para o contato comercial.
</p>
</form>'''


def _caixa_form():
    return ('<div style="background:var(--claro);color:var(--tinta-escura);'
            'border-radius:var(--r-g);padding:clamp(24px,3vw,36px)">' + form() + "</div>")


# ------------------------------------------------------------------- CTAs ---
MARMORE = "/img/marmore-faixa-vegas.webp"
SELO = "/img/selo-vegas-aceleradora.webp"


def cta(titulo, apoio="", posicao="Rodapé da página", rotulo="Diagnóstico gratuito"):
    """Fechamento sobre a textura de marmore — o bloco de conversao da LP.

    Era a secao mais forte da pagina antiga e tinha virado, aqui, um retangulo
    preto com um titulo pequeno encostado na esquerda. Volta com a textura da
    marca, o selo, o rotulo em pilula e tudo no eixo central.

    O botao continua sendo um <a> de verdade para /diagnostico/. Quem tem
    JavaScript recebe o formulario em popup sobre a propria pagina (vegas.js);
    quem nao tem navega para a pagina do formulario. Os dois caminhos
    convertem.
    """
    linha = f'<p class="apoio">{apoio}</p>' if apoio else ""
    return (f'<section class="faixa-marmore escuro"'
            f' style="background-image:url({MARMORE})" aria-labelledby="t-cta">'
            f'<div class="wrap-estreito">'
            f'<img class="selo" src="{SELO}" alt="" width="128" height="128"'
            f' loading="lazy" decoding="async">'
            f'<span class="rotulo-pill">{rotulo}</span>'
            f'<h2 id="t-cta">{titulo}</h2>{linha}'
            f'<a href="/diagnostico/" class="btn btn-1" data-track-id="cta-diagnostico-fim"'
            f' data-track-pos="{posicao}">Solicitar diagnóstico gratuito</a>'
            f'</div></section>')


# ------------------------------------------------------ passos numerados ---
def passos(*args):
    """Sequencia 01/02/03 com o numero gigante em marca d'agua no card.

    Trincas titulo|texto. A numeracao sai da posicao, nao do texto: card novo
    no meio nao obriga a renumerar os outros a mao.
    """
    if len(args) % 2:
        raise SystemExit(f"erro: PASSOS espera pares titulo|texto, recebeu {len(args)}")
    cards = []
    for i in range(0, len(args), 2):
        n = f"{i // 2 + 1:02d}"
        cards.append(f'<article class="card passo" data-passo="{n}">'
                     f'<span class="passo-num">{n}</span>'
                     f'<h3>{args[i]}</h3><p>{args[i + 1]}</p></article>')
    return f'<div class="grade grade-3" data-reveal>{"".join(cards)}</div>'


# ---------------------------------------------------------- comparacao VS ---
def vs(*args):
    """Duas colunas, "sem" e "com", e o disco VS entre elas.

    Pares: para cada linha, o lado sem|o lado com. Cada lado e titulo;texto.
    O componente nao afirma resultado — contrasta pratica, que e o que da para
    sustentar sem numero de cliente.
    """
    if len(args) % 2:
        raise SystemExit(f"erro: VS espera pares sem|com, recebeu {len(args)}")

    def item(lado, texto):
        marca = "✕" if lado == "nao" else "✓"
        titulo, _, corpo = texto.partition(";")
        return (f'<article class="card vs-item vs-{lado}">'
                f'<span class="vs-marca" aria-hidden="true">{marca}</span>'
                f'<div><h3>{titulo.strip()}</h3><p>{corpo.strip()}</p></div></article>')

    # Os pares entram intercalados numa grade unica — sem|com, sem|com — e nao
    # em duas colunas empilhadas separadas. Em colunas separadas cada lado
    # crescia com a propria altura e as linhas saiam do lugar: o contraste, que
    # e todo o ponto do componente, dependia de ler duas pilhas desalinhadas.
    # Numa grade so, cada par e uma linha e as duas alturas se igualam.
    pares = "".join(item("nao", args[i]) + item("sim", args[i + 1])
                    for i in range(0, len(args), 2))
    return (f'<div class="vs" data-reveal>'
            f'<p class="vs-titulo vs-nao">Sem a Vegas</p>'
            f'<p class="vs-titulo vs-sim">Com a Vegas</p>'
            f'{pares}<span class="vs-disco" aria-hidden="true">VS</span></div>')


def cta_form(titulo, apoio="", posicao="Rodapé da página"):
    """Fechamento com o formulario ao lado — o bloco mais forte da Home.

    Vai nas paginas de intencao comercial (servicos, segmentos, metodo,
    resultados): ali o visitante ja leu sobre o proprio problema, e mandar ele
    para outra pagina para so entao ver um formulario perde gente no caminho.

    O vegas.js liga um formulario por pagina (`$('[data-form-diagnostico]')`),
    entao este bloco nao entra em pagina que ja tenha formulario.
    """
    linha = f'<p class="apoio">{apoio}</p>' if apoio else ""
    return (f'<section class="secao" style="background:#000" aria-labelledby="t-cta-form">'
            f'<div class="wrap grade" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));'
            f'gap:clamp(28px,4vw,56px);align-items:start">'
            f'<div><span class="rotulo">Diagnóstico gratuito</span>'
            f'<h2 id="t-cta-form">{titulo}</h2>{linha}'
            f'<p style="margin-top:var(--e5);font-size:var(--t-corpo)">Prefere conversar agora? '
            f'<a href="{mapa.whatsapp()}" target="_blank" rel="noopener"'
            f' data-track-id="cta-whatsapp-diagnostico" data-track-pos="{posicao}">'
            f'Fale com a Vegas no WhatsApp</a>.</p></div>'
            + _caixa_form() + "</div></section>")


# -------------------------------------------------------- proximos passos ---
_ROTULOS = [("/blog/", "Ler o artigo"), ("/servicos/", "Ver serviço")]


def _rotulo_de(url):
    """O texto do link sai da URL: /blog/ le, /servicos/ ve servico, o resto ve
    pagina. Evita decidir isso card a card e sair diferente em cada arquivo."""
    for prefixo, rotulo in _ROTULOS:
        if url.startswith(prefixo):
            return rotulo
    return "Ver página"


def proximos(*args):
    """Os tres cards de navegacao no fim das paginas, em trincas url/titulo/chamada.

    A chamada continua escrita na pagina porque e contextual: o mesmo artigo e
    apresentado de um jeito quando vem de uma pizzaria e de outro quando vem de
    uma dark kitchen. O que e compartilhado e a forma do card.
    """
    if len(args) % 3:
        raise SystemExit(f"erro: PROXIMOS espera trincas url|titulo|chamada, "
                         f"recebeu {len(args)} campos")
    cards = "".join(
        f'<a class="card" href="{args[i]}"><h3>{args[i + 1]}</h3>'
        f'<p>{args[i + 2]}</p><span class="btn btn-3">{_rotulo_de(args[i])}</span></a>'
        for i in range(0, len(args), 3))
    return f'<div class="grade grade-3" data-reveal>{cards}</div>'


def proximos_e_cta(*args):
    """Como as paginas de artigo fecham: tres caminhos de leitura e, logo
    abaixo, a faixa de conversao.

    Sao duas secoes, nao uma: a faixa de marmore precisa de fundo proprio, e
    encaixar os cards dentro dela empilharia textura sobre textura.
    """
    *cards, titulo, apoio, posicao = args
    continua = ('<section class="escuro secao" aria-labelledby="t-continua">'
                '<div class="wrap"><div class="cabeca-secao">'
                '<span class="rotulo">Continue por aqui</span>'
                '<h2 id="t-continua">O que ler depois</h2></div>'
                + proximos(*cards) + "</div></section>")
    return continua + cta(titulo, apoio, posicao)


# ------------------------------------------------------------- atalhos -----
def atalhos(conjunto="segmentos"):
    """So os nomes, em pilulas que linkam. Serve onde a pagina precisa APONTAR
    para um conjunto sem repetir o texto dele.

    Nasceu de uma duplicata real: /servicos/ trazia os sete cards de segmento
    inteiros, com o mesmo texto de /segmentos/ — 29% do conteudo da menor das
    duas repetido. Duas paginas dizendo a mesma coisa disputam o mesmo termo e
    nenhuma das duas sai mais forte.
    """
    fonte = {"segmentos": mapa.SEGMENTOS_FILHOS,
             "servicos": mapa.SERVICOS_FILHOS}[conjunto]
    itens = "".join(f'<li><a class="chip" href="{p.url}">{p.menu}</a></li>'
                    for p in fonte if p.publicada)
    return f'<ul class="chips chips-link">{itens}</ul>'


# --------------------------------------------------------------- despacho ---
# Os quatro primeiros ja existiam no construtor como replace simples; entraram
# aqui para que exista um registro so de marcadores.
def _indices(construtor):
    return {
        "SERVICOS": lambda: construtor.cards_de(mapa.SERVICOS_FILHOS, "Ver serviço"),
        "SEGMENTOS": lambda: construtor.cards_de(mapa.SEGMENTOS_FILHOS),
        "ARTIGOS": construtor.cards_de_artigos,
        "CATEGORIAS": construtor.lista_de_categorias,
        "FAIXA": faixa,
        "LOGOS": logos,
        "FORM": form,
        "CTA": cta,
        "CTA-FORM": cta_form,
        "ATALHOS": atalhos,
        "PROXIMOS": proximos,
        "PROXIMOS-CTA": proximos_e_cta,
        "PASSOS": passos,
        "VS": vs,
    }


# \s* depois do nome: marcador com muitos argumentos e escrito em varias linhas,
# e a quebra antes do primeiro "|" nao pode invalidar a captura.
_MARCADOR = re.compile(r"\{\{([A-Z-]+)\s*((?:\|[^{}]*?)*)\}\}", re.S)


def aplica(corpo, construtor):
    """Troca todo marcador pelo HTML do componente.

    Marcador desconhecido levanta erro em vez de ficar literal na pagina: um
    `{{CTAA|...}}` impresso no ar e pior do que um build que para.
    """
    tabela = _indices(construtor)

    def troca(m):
        nome = m.group(1)
        if nome not in tabela:
            raise SystemExit(f"erro: marcador desconhecido {{{{{nome}}}}} — "
                             f"conhecidos: {', '.join(sorted(tabela))}")
        # Argumentos: tudo depois do primeiro "|", separado por "|", sem as
        # quebras de linha que a pagina usa so para caber na coluna.
        bruto = m.group(2)
        args = [re.sub(r"\s+", " ", a).strip() for a in bruto.split("|")[1:]] if bruto else []
        return tabela[nome](*args)

    corpo = _MARCADOR.sub(troca, corpo)

    # Rede contra marcador que nao casou com a expressao — foi o que aconteceu
    # quando um {{VS}} de oito linhas tinha quebra entre o nome e o primeiro
    # "|": nenhum erro, e o marcador cru foi parar na pagina publicada. Agora o
    # build para.
    sobrou = re.search(r"\{\{[A-Z-]", corpo)
    if sobrou:
        trecho = corpo[sobrou.start():sobrou.start() + 90].replace("\n", " ")
        raise SystemExit(f"erro: marcador nao substituido: {trecho}...")
    return corpo
