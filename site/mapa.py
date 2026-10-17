"""Mapa do site — a arquitetura de 36 paginas em um lugar so.

Por que isto existe
-------------------
O briefing pede a Home agora e as outras 35 depois, "sem refazer o projeto".
O que costuma obrigar a refazer nao e o visual: e a navegacao, o sitemap, os
breadcrumbs e a linkagem interna, que ficam espalhados por dezenas de arquivos
e precisam ser caçados um a um a cada pagina nova.

Aqui eles saem todos do mesmo registro. Publicar uma pagina e virar uma chave.

A chave `publicada`
-------------------
Menu que aponta para pagina inexistente e 404 — e 404 vindo de link interno o
Google interpreta como site mal cuidado. Entao:

  publicada=False  ->  o item do menu aponta para a ancora correspondente
                       DENTRO da Home, que existe e tem o conteudo.
  publicada=True   ->  o mesmo item passa a apontar para a URL propria, entra
                       no sitemap e ganha breadcrumb.

Nenhum arquivo alem deste precisa mudar quando uma pagina nasce. O conteudo da
Home ja foi escrito pensando nisso: cada secao e o embriao da pagina que vai
herdar aquele assunto.
"""

DOMINIO = "https://vegasaceleradora.com.br"

# ---------------------------------------------------------------- a marca ---
MARCA = {
    "nome": "Vegas Aceleradora",
    "descricao": "Assessoria de marketing especializada em restaurantes e delivery.",
    "email": "contato@vegasaceleradora.com.br",
    "telefone": "+5527992246343",
    "telefone_exibido": "+55 (27) 9 9224-6343",
    "logo": "/img/logo-vegas-aceleradora.webp",
    "whatsapp_texto": "Olá! Conheci a Vegas pelo site e gostaria de uma análise de marketing para o meu restaurante ou delivery.",
}


def whatsapp(texto=None):
    from urllib.parse import quote
    t = quote(texto or MARCA["whatsapp_texto"])
    return f"https://api.whatsapp.com/send?phone=5527992246343&text={t}"


# ------------------------------------------------------------- as paginas ---
# (url, titulo no menu, ancora na Home enquanto nao existe, publicada)
class Pag:
    def __init__(self, url, menu, ancora=None, publicada=False, prioridade="0.7",
                 resumo="", categoria=""):
        self.url, self.menu, self.ancora = url, menu, ancora
        self.publicada, self.prioridade = publicada, prioridade
        # usados pelo indice do blog; vazios nas demais paginas
        self.resumo, self.categoria = resumo, categoria

    @property
    def destino(self):
        """Para onde o menu aponta HOJE."""
        if self.publicada:
            return self.url
        return self.ancora or "/"


# Grupo A — institucional
HOME      = Pag("/", "Home", publicada=True, prioridade="1.0")
SOBRE     = Pag("/sobre/", "Sobre a Vegas", "/#sobre")
METODO    = Pag("/metodo/", "Método", "/#metodo")
CONTATO   = Pag("/contato/", "Contato", "/#diagnostico")

# Grupo B — servicos
SERVICOS  = Pag("/servicos/", "Serviços", "/#servicos")
SERVICOS_FILHOS = [
    Pag("/servicos/trafego-pago-restaurantes/",   "Tráfego pago para restaurantes", "/#servicos"),
    Pag("/servicos/marketing-para-delivery/",     "Marketing para delivery",        "/#servicos"),
    Pag("/servicos/google-ads-restaurantes/",     "Google Ads para restaurantes",   "/#servicos", publicada=True),
    Pag("/servicos/automacao-whatsapp-delivery/", "Automação no WhatsApp",          "/#servicos", publicada=True),
    Pag("/servicos/remarketing-restaurantes/",    "Remarketing e recompra",         "/#servicos", publicada=True),
]

# Grupo C — segmentos
SEGMENTOS = Pag("/segmentos/", "Para quem", "/#segmentos")
SEGMENTOS_FILHOS = [
    Pag("/marketing-para-restaurantes/",           "Restaurantes",         "/#segmentos"),
    Pag("/marketing-para-pizzarias/",              "Pizzarias",            "/#segmentos", publicada=True),
    Pag("/marketing-para-hamburguerias/",          "Hamburguerias",        "/#segmentos", publicada=True),
    Pag("/marketing-para-restaurantes-japoneses/", "Restaurantes japoneses", "/#segmentos", publicada=True),
    Pag("/marketing-para-cafeterias/",             "Cafeterias",           "/#segmentos", publicada=True),
    Pag("/marketing-para-dark-kitchens/",          "Dark kitchens",        "/#segmentos", publicada=True),
    Pag("/marketing-para-bares/",                  "Bares",                "/#segmentos", publicada=True),
]

# Grupo D — resultados. As paginas de case dependem de material real; ficam
# declaradas, mas nao nascem vazias.
RESULTADOS = Pag("/resultados/", "Resultados", "/#resultados")
CASES = [
    Pag("/cases/pizzaria/",      "Case — pizzaria",      "/#resultados"),
    Pag("/cases/hamburgueria/",  "Case — hamburgueria",  "/#resultados"),
    Pag("/cases/delivery/",      "Case — delivery",      "/#resultados"),
]

# Grupo E — conteudo
BLOG = Pag("/blog/", "Blog", "/#conteudo", publicada=True, prioridade="0.8")
ARTIGOS = [
    Pag("/blog/como-aumentar-vendas-delivery/", "Como aumentar vendas no delivery",
        publicada=True, categoria="Delivery",
        resumo="O caminho completo, de quem ainda não te conhece até quem pede toda semana — e os indicadores que dizem onde está o gargalo."),
    Pag("/blog/marketing-para-restaurantes/", "Marketing para restaurantes: o guia",
        publicada=True, categoria="Marketing gastronômico",
        resumo="Os canais que existem, o que cada um resolve e em que ordem faz sentido montar a operação de marketing de um restaurante."),
    Pag("/blog/trafego-pago-delivery/", "Tráfego pago para delivery: como planejar campanhas",
        publicada=True, categoria="Tráfego pago",
        resumo="Estrutura de campanha, orçamento pela capacidade da cozinha, criativo que dá fome e o que otimizar — sem achismo."),
    Pag("/blog/como-vender-mais-ifood/", "Como vender mais no iFood",
        publicada=True, categoria="Delivery",
        resumo="Cardápio, foto, reputação e operação: o que está sob o seu controle dentro do aplicativo, e o que não está."),
    Pag("/blog/como-atrair-clientes-restaurante/",     "Como atrair clientes para restaurante", categoria="Estratégias de vendas"),
    Pag("/blog/quanto-investir-anuncios-restaurante/", "Quanto investir em anúncios", categoria="Gestão de marketing"),
    Pag("/blog/como-aumentar-ticket-medio/",           "Como aumentar o ticket médio", categoria="Estratégias de vendas"),
    Pag("/blog/como-fidelizar-clientes-delivery/",     "Como fidelizar clientes de delivery", categoria="Fidelização"),
    Pag("/blog/ifood-ou-delivery-proprio/",            "iFood ou delivery próprio?", categoria="Delivery"),
    Pag("/blog/como-calcular-roas-restaurante/",       "Como calcular o ROAS", categoria="Gestão de marketing"),
    Pag("/blog/whatsapp-para-restaurantes/",           "WhatsApp para restaurantes", categoria="Fidelização"),
]

# Grupo F — conversao e transparencia
DIAGNOSTICO = Pag("/diagnostico/", "Diagnóstico gratuito", "/#diagnostico", prioridade="0.9")
PRIVACIDADE = Pag("/politica-de-privacidade/", "Política de privacidade")

TODAS = ([HOME, SOBRE, METODO, CONTATO, SERVICOS] + SERVICOS_FILHOS +
         [SEGMENTOS] + SEGMENTOS_FILHOS + [RESULTADOS] + CASES +
         [BLOG] + ARTIGOS + [DIAGNOSTICO, PRIVACIDADE])

# ------------------------------------------------------------------ menu ---
# (item, filhos). Filhos viram submenu no desktop e lista recuada no mobile.
MENU = [
    (SERVICOS,   SERVICOS_FILHOS),
    (SEGMENTOS,  SEGMENTOS_FILHOS),
    (METODO,     []),
    (RESULTADOS, []),
    (BLOG,       []),
    (SOBRE,      []),
]

RODAPE = [
    ("Soluções",   [SERVICOS] + SERVICOS_FILHOS),
    ("Para quem",  SEGMENTOS_FILHOS),
    ("A Vegas",    [SOBRE, METODO, RESULTADOS, BLOG, CONTATO]),
]
