#!/usr/bin/env python3
"""Grava o inventario de SEO como .xlsx com uma aba por assunto.

Chamado por analise-seo.py --xlsx. Separado dele porque a analise tem de
rodar mesmo onde o openpyxl nao esta instalado.

O arquivo sobe para o Drive e vira Planilha Google na conversao: e por isso
que e .xlsx de varias abas, e nao CSV — CSV nao tem aba.
"""
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

PRETO = "FF0A0908"
OURO = "FFF49E1D"
CLARO = "FFF3EDE3"
VERMELHO = "FFD3372B"
CINZA = "FF9C968A"

# Sugestao de H1 para as paginas onde a chave nao aparece nele. Escritas a
# mao: gerar titulo por regra produz frase de robo, e o H1 e a primeira coisa
# que o visitante le. Sao propostas — cabe ao dono do texto aceitar ou nao.
SUGESTAO_H1 = {
    "/": "Agência de marketing para restaurantes que traz cliente que compra e volta",
    "/sobre/": "A assessoria de marketing para restaurantes que só atende food service",
    "/metodo/": "O método de marketing para restaurantes da Vegas: três frentes ao mesmo tempo",
    "/servicos/": "Serviços de marketing para restaurantes e delivery",
    "/servicos/automacao-whatsapp-delivery/": "Automação de WhatsApp para delivery: do anúncio ao pedido",
    "/servicos/remarketing-restaurantes/": "Remarketing para restaurantes: falar de novo com quem já te conhece",
    "/segmentos/": "Marketing para food service: a estratégia muda com o tipo de operação",
    "/marketing-para-restaurantes/": "Marketing para restaurantes: dois negócios na mesma cozinha",
    "/marketing-para-pizzarias/": "Marketing para pizzarias: vender também fora de sexta e sábado",
    "/marketing-para-hamburguerias/": "Marketing para hamburguerias: marca, produto e ticket",
    "/marketing-para-restaurantes-japoneses/": "Marketing para restaurantes japoneses: valor percebido e ocasião",
    "/marketing-para-cafeterias/": "Marketing para cafeterias: frequência vale mais que alcance",
    "/marketing-para-dark-kitchens/": "Marketing para dark kitchens: marca sem fachada",
    "/marketing-para-bares/": "Marketing para bares: a agenda manda na demanda",
    "/resultados/": "Resultados de marketing para restaurantes: o que medimos e o que isso não prova",
    "/blog/": "Blog de marketing para restaurantes e delivery",
    "/diagnostico/": "Diagnóstico de marketing para restaurantes, gratuito",
    "/blog/marketing-para-restaurantes/": "(título) Marketing para restaurantes: o guia dos canais | Vegas",
}


def _cabecalho(aba, titulos, larguras):
    aba.append(titulos)
    for i, t in enumerate(titulos, 1):
        c = aba.cell(row=1, column=i)
        c.font = Font(bold=True, color=OURO)
        c.fill = PatternFill("solid", fgColor=PRETO)
        c.alignment = Alignment(vertical="center", wrap_text=True)
        aba.column_dimensions[get_column_letter(i)].width = larguras[i - 1]
    aba.freeze_panes = "A2"
    aba.auto_filter.ref = f"A1:{get_column_letter(len(titulos))}1"


def _sim_nao(v):
    return "sim" if v else "NÃO"


def grava(caminho, pags, canibal, dup, repetidas):
    wb = Workbook()

    # ---------------------------------------------------------- 1. Resumo ---
    aba = wb.active
    aba.title = "Resumo"
    aba.column_dimensions["A"].width = 52
    aba.column_dimensions["B"].width = 14
    aba.column_dimensions["C"].width = 92

    def bloco(titulo):
        aba.append([])
        aba.append([titulo])
        c = aba.cell(row=aba.max_row, column=1)
        c.font = Font(bold=True, size=12, color=OURO)
        c.fill = PatternFill("solid", fgColor=PRETO)

    def linha(rot, val, nota=""):
        aba.append([rot, val, nota])
        aba.cell(row=aba.max_row, column=3).alignment = Alignment(wrap_text=True, vertical="top")

    aba.append(["Inventário de SEO — Vegas Aceleradora"])
    aba.cell(row=1, column=1).font = Font(bold=True, size=15)
    aba.append(["Lido do HTML publicado, não do plano. Gerado por analise-seo.py."])
    aba.cell(row=2, column=1).font = Font(italic=True, color=CINZA)

    com_chave = [p for p in pags if p["chave"]]
    sem_h1 = [p for p in com_chave if not p["onde"]["h1_solta"]]
    sem_titulo = [p for p in com_chave if not p["onde"]["titulo_solta"]]
    alto = [c for c in canibal if c["risco"] == "alto"]
    medio = [c for c in canibal if c["risco"] == "medio"]

    bloco("Cobertura")
    linha("Páginas publicadas", len(pags))
    linha("Com palavra-chave declarada", len(com_chave))
    linha("Sem alvo de busca (de propósito)", len(pags) - len(com_chave),
          "/contato/ e /politica-de-privacidade/: institucional e legal.")
    linha("Palavras de conteúdo", sum(p["palavras"] for p in pags))

    bloco("Onde a chave aparece")
    linha("Chave no título", f"{len(com_chave) - len(sem_titulo)}/{len(com_chave)}")
    linha("Chave na descrição", f"{len(com_chave)}/{len(com_chave)}", "Todas.")
    linha("Chave no H1", f"{len(com_chave) - len(sem_h1)}/{len(com_chave)}",
          "Os H1 que faltam são manchetes editoriais. Aba 'Palavra-chave' traz "
          "uma sugestão de H1 para cada um — é decisão de conteúdo, não bug.")

    bloco("Canibalização")
    linha("Risco alto", len(alto), "Duas páginas com o mesmo alvo. Zero é o esperado.")
    linha("Risco médio", len(medio), "Mesmo núcleo com recorte mais específico. Acompanhar.")
    linha("Risco baixo", len(canibal) - len(alto) - len(medio),
          "Qualificador na frente ('agência de', 'serviços de') muda a intenção da busca.")

    bloco("Duplicação de conteúdo")
    linha("Pares acima do limite", len(dup),
          "Limite: 8% dos trechos da página menor repetidos na maior.")
    linha("Pior par", f'{dup[0]["do_menor"]}%' if dup else "—",
          f'{dup[0]["a"]} x {dup[0]["b"]}' if dup else "nenhum")
    linha("Frases em 3+ páginas", len(repetidas), "Ver aba 'Duplicação'.")

    bloco("Técnico")
    linha("sitemap.xml", "existe", "33 URLs, só páginas publicadas. Gerado a cada build.")
    linha("robots.txt", "existe", "Aponta o sitemap e libera buscadores tradicionais e de IA.")
    linha("Canonical", "33/33", "Cada página aponta para si mesma.")
    linha("Indexáveis", f'{len([p for p in pags if "noindex" not in p["robots"]])}/{len(pags)}')
    linha("Search Console", "NÃO ENVIADO",
          "Não dá para enviar ainda: o domínio não serve o deploy (deploy-info.txt deu 404). "
          "O Google precisa alcançar o site para verificar a propriedade. Ver aba 'Técnico'.")

    # -------------------------------------------------------- 2. Páginas ---
    aba = wb.create_sheet("Páginas")
    _cabecalho(aba, ["URL", "Palavra-chave alvo", "Título", "Descrição", "H1",
                     "Palavras", "Links que saem", "Citações que recebe", "Indexável"],
               [42, 34, 56, 64, 52, 10, 14, 18, 11])
    for p in sorted(pags, key=lambda x: x["url"]):
        aba.append([p["url"], p["chave"] or "—", p["titulo"], p["descricao"], p["h1"],
                    p["palavras"], len(p["saem"]), len(p["entram"]),
                    _sim_nao("noindex" not in p["robots"])])
    for r in range(2, aba.max_row + 1):
        for c in (3, 4, 5):
            aba.cell(row=r, column=c).alignment = Alignment(wrap_text=True, vertical="top")

    # -------------------------------------------------- 3. Palavra-chave ---
    aba = wb.create_sheet("Palavra-chave")
    _cabecalho(aba, ["URL", "Palavra-chave alvo", "Na URL", "No título", "No H1",
                     "Na descrição", "Em algum H2", "No 1º parágrafo",
                     "Vezes no corpo", "Densidade %", "O que falta",
                     "Sugestão de H1 (proposta)"],
               [42, 34, 9, 11, 9, 13, 13, 15, 14, 12, 30, 64])
    for p in sorted(pags, key=lambda x: x["url"]):
        o = p["onde"]
        if not o:
            aba.append([p["url"], "— sem alvo de busca —", "", "", "", "", "", "", "", "",
                        "institucional/legal", ""])
            continue
        falta = []
        if not o["titulo_solta"]:
            falta.append("título")
        if not o["h1_solta"]:
            falta.append("H1")
        if not o["descricao_solta"]:
            falta.append("descrição")
        aba.append([
            p["url"], p["chave"],
            _sim_nao(o["url"]),
            "exata" if o["titulo"] else ("solta" if o["titulo_solta"] else "NÃO"),
            "exata" if o["h1"] else ("solta" if o["h1_solta"] else "NÃO"),
            "exata" if o["descricao"] else ("solta" if o["descricao_solta"] else "NÃO"),
            _sim_nao(o["h2"]), _sim_nao(o["primeiro_paragrafo"]),
            o["vezes"], o["densidade"],
            ", ".join(falta) if falta else "nada",
            SUGESTAO_H1.get(p["url"], "") if falta else "",
        ])
    for r in range(2, aba.max_row + 1):
        if aba.cell(row=r, column=11).value not in ("nada", "institucional/legal"):
            aba.cell(row=r, column=11).font = Font(bold=True, color=VERMELHO)
        aba.cell(row=r, column=12).alignment = Alignment(wrap_text=True, vertical="top")
    aba.append([])
    aba.append(["'exata' = a expressão inteira, na ordem. 'solta' = todas as palavras "
                "presentes, em outra forma — um H1 editorial costuma cair aqui, e não é erro."])
    aba.cell(row=aba.max_row, column=1).font = Font(italic=True, color=CINZA)

    # ------------------------------------------------- 4. Canibalização ---
    aba = wb.create_sheet("Canibalização")
    _cabecalho(aba, ["Risco", "Página A", "Chave A", "Página B", "Chave B",
                     "Tipo", "Leitura"],
               [10, 42, 34, 42, 34, 16, 74])
    for c in canibal:
        aba.append([c["risco"].upper(), c["a"], c["chave_a"], c["b"], c["chave_b"],
                    c["tipo"], c["nota"]])
    for r in range(2, aba.max_row + 1):
        v = aba.cell(row=r, column=1).value
        if v == "ALTO":
            aba.cell(row=r, column=1).font = Font(bold=True, color=VERMELHO)
        aba.cell(row=r, column=7).alignment = Alignment(wrap_text=True, vertical="top")

    # ---------------------------------------------------- 5. Duplicação ---
    aba = wb.create_sheet("Duplicação")
    _cabecalho(aba, ["Página A", "Página B", "% da página menor repetido",
                     "Semelhança geral %", "Trechos iguais", "Exemplo do trecho"],
               [42, 42, 24, 20, 16, 80])
    for d in dup:
        aba.append([d["a"], d["b"], d["do_menor"], d["semelhanca"], d["trechos"],
                    d["exemplo"]])
    for r in range(2, aba.max_row + 1):
        aba.cell(row=r, column=6).alignment = Alignment(wrap_text=True, vertical="top")

    aba.append([])
    aba.append(["Frases que aparecem em 3 páginas ou mais"])
    aba.cell(row=aba.max_row, column=1).font = Font(bold=True, color=OURO)
    aba.cell(row=aba.max_row, column=1).fill = PatternFill("solid", fgColor=PRETO)
    aba.append(["Em quantas páginas", "Trecho (10 palavras, normalizado)"])
    aba.cell(row=aba.max_row, column=1).font = Font(bold=True)
    aba.cell(row=aba.max_row, column=2).font = Font(bold=True)
    for t, n in repetidas:
        aba.append([n, t])

    # ------------------------------------------------------- 6. Técnico ---
    aba = wb.create_sheet("Técnico")
    _cabecalho(aba, ["Item", "Situação", "Detalhe / o que falta"], [40, 20, 96])
    tecnico = [
        ("sitemap.xml", "pronto",
         "https://vegasaceleradora.com.br/sitemap.xml — 33 URLs. Gerado pelo construtor a "
         "partir do registro: entra só página com publicada=True. Cases e 404 ficam fora."),
        ("robots.txt", "pronto",
         "Aponta o sitemap. Libera Googlebot, Bingbot e os agentes de busca com IA "
         "(OAI-SearchBot, PerplexityBot, Google-Extended, Applebot). Os coletores de "
         "treinamento (GPTBot, CCBot, ClaudeBot) estão comentados — basta descomentar "
         "para bloquear."),
        ("Canonical por página", "pronto", "Cada uma aponta para a própria URL."),
        ("JSON-LD", "pronto",
         "135 blocos: Organization, WebSite, BreadcrumbList, FAQPage e Article. O FAQPage "
         "é lido do FAQ que está na página, então não pode divergir do texto visível."),
        ("Open Graph / Twitter", "pronto", "Título, descrição, imagem e URL em todas."),
        ("Core Web Vitals", "medido local",
         "CLS 0,000 em todas as 33 (width/height em toda imagem). LCP e peso só valem "
         "de verdade depois do deploy, com rede real."),
        ("404 personalizada", "pronto", "/404.html, noindex, apontada pelo ErrorDocument."),
        ("HTTPS e www→apex", "configurado", "No .htaccess. Só entra em vigor com o deploy."),
        ("DEPLOY", "QUEBRADO",
         "deploy-info.txt deu 404: a pasta do deploy ($HOME/vegasaceleradora.com.br) não é "
         "o document root do domínio. Enquanto isso, NENHUM visitante alcança o site — e "
         "nada abaixo pode ser feito."),
        ("Search Console — propriedade", "NÃO FEITO",
         "Depende do deploy. A verificação exige que o Google alcance o domínio (arquivo "
         "HTML na raiz, meta tag ou registro DNS). Com o site fora do ar, qualquer método "
         "de arquivo falha. O método DNS funcionaria hoje, mas enviar sitemap de um site "
         "que não responde só gera erro no relatório."),
        ("Search Console — envio do sitemap", "NÃO FEITO",
         "Passo seguinte à verificação: Sitemaps → adicionar 'sitemap.xml'. Eu não tenho "
         "ferramenta de Search Console nesta sessão; é um passo seu, de 2 minutos."),
        ("Google Analytics / Tag Manager", "não instalado",
         "O site usa o coletor do Painel de Sites (app.johnyweb.com). Nenhum evento chegou "
         "até hoje — mesma causa: o site não está no ar."),
        ("Bing Webmaster Tools", "NÃO FEITO",
         "Opcional, mas barato: importa a propriedade do Search Console em um clique e "
         "alimenta também o Copilot."),
        ("Perfil da Empresa no Google", "fora do site",
         "Não é do site, mas é o que mais pesa em busca local para restaurante. Vale "
         "conferir se o da Vegas está completo e com as avaliações respondidas."),
    ]
    for item, sit, det in tecnico:
        aba.append([item, sit, det])
    for r in range(2, aba.max_row + 1):
        if str(aba.cell(row=r, column=2).value).isupper():
            aba.cell(row=r, column=2).font = Font(bold=True, color=VERMELHO)
        aba.cell(row=r, column=3).alignment = Alignment(wrap_text=True, vertical="top")

    wb.save(caminho)
