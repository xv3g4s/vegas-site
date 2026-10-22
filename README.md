# Vegas Aceleradora — site

Site institucional da Vegas Aceleradora (marketing para restaurantes e delivery).

- Producao: https://vegasaceleradora.com.br/
- 33 paginas publicadas, geradas por `construtor.py` a partir de `site/`

---

## Como o site funciona

O site e **HTML estatico escrito a mao**, montado a partir de partes
compartilhadas. Nao ha framework, nao ha runtime, nao ha hidratacao: o
visitante recebe a pagina pronta e o unico JavaScript e o `public/vegas.js`
(menu, validacao de formulario, UTM), que e enhancement — sem ele a navegacao
e o formulario continuam funcionando.

    site/mapa.py       registro das paginas (URL, menu, prioridade, resumo)
    site/paginas/*.html  conteudo de cada pagina + bloco <!--dados-->
           |
           +-- construtor.py --> public/  (33 x index.html, 404.html,
                                           sitemap.xml, _headers)

O `construtor.py` monta sozinho, a partir do registro: `<head>` completo,
canonical, Open Graph, JSON-LD, cabecalho com menu (submenu no desktop,
sanduiche no mobile), breadcrumbs, rodape com a arquitetura inteira, sitemap e
`_headers`.

### O registro e a fonte da verdade

Uma pagina existe quando esta em `site/mapa.py`. De la saem o menu, o rodape, o
sitemap e o `_headers`. Duas consequencias praticas:

- **`publicada=False`** faz o item de menu apontar para a ancora
  correspondente na Home, em vez de uma URL que ainda nao existe. E assim que
  as paginas de case (`/cases/...`) esperam ter dado real sem gerar 404.
- **Link interno fora do registro quebra o build**, em vez de virar 404
  silencioso em producao.

E ha dois atributos no bloco `<!--dados-->` de cada pagina:

- `"rascunho": true` — o arquivo fica no repositorio mas nao vira URL
  (`site/paginas/case-MODELO.html`).
- `"arquivo"` + `"indexavel": false` — grava num caminho literal, com noindex.
  E o que a pagina de erro usa (`site/paginas/erro-404.html` -> `public/404.html`).

### Previa sem publicar

`PREFIXO_PREVIA` no topo do `construtor.py`. Com `"/v3"`, o site inteiro e
gerado dentro de `public/v3/`, com todos os links internos prefixados e todas
as paginas marcadas `noindex` — da para navegar a versao nova inteira sem
tocar no que esta no ar. Com `""` (o valor de hoje), publica na raiz e
regenera `sitemap.xml` e `_headers`.

---

## A LP anterior

A landing page antiga continua sendo gerada, agora em `/lp-antiga/` e com
`noindex`. Ela vem do Claude Design como um **template** (`src/*.dc.html`) que
o `support.js` monta com React; servir isso direto custaria 207 KB de runtime
no navegador. Por isso a montagem acontece uma vez, no build:

    src/*.dc.html --build.py--> template --prerender.mjs--> public/lp-antiga/index.html
                                (runtime/)                  (estatico)

O `runtime/` nunca chega ao navegador do visitante. A interatividade da LP vem
do `public/site.js`.

**Nenhuma das duas faz requisicao a dominio de terceiro para renderizar.** React
saiu do unpkg, a Poppins e servida localmente e os avatares vem do proprio site.
As unicas chamadas externas sao o coletor do Painel de Sites (`t.js` e `f.js`).

---

## Estrutura

    public/           TUDO que vai para o ar — e so isto que qualquer host publica
      index.html      Home (construtor.py)
      <rota>/index.html  as outras 32 paginas
      404.html        pagina de erro (ErrorDocument do .htaccess)
      lp-antiga/      LP anterior, noindex (build.py)
      vegas.css       design system do site institucional
      vegas.js        menu, formulario, UTM
      site.js         interatividade da LP anterior
      img/ fonts/     imagens (webp) e Poppins local
      robots.txt      SEO
      sitemap.xml     GERADO — so paginas publicada=True
      _headers        GERADO — cache e seguranca na Cloudflare Pages
      .htaccess       cache, seguranca, HTTPS e ErrorDocument no Apache

    site/
      mapa.py             registro das 36 paginas
      paginas/*.html      conteudo
      mapa_de_links.py    gera MAPA-DE-LINKS.md a partir do HTML construido
      MAPA-DE-LINKS.md    GERADO — ligacoes de conteudo, orfas, mais citadas
      INVENTARIO.md       o que e verificavel da marca e o que precisa validacao

    src/              fontes do Claude Design — nunca publicado
    export/           bundle de 1 arquivo do Claude Design — nunca publicado
    construtor.py     gera o site institucional
    build.py          gera public/lp-antiga/
    auditoria.mjs     SEO, semantica, acessibilidade e mobile — sai 1 se achar erro
    vitais.mjs        LCP, CLS, FCP e peso por pagina
    .cpanel.yml       deploy HostGator (ver aviso dentro do arquivo)

Nada fora de `public/` chega ao servidor.

---

## Alterando o site

1. Edite `site/paginas/<pagina>.html` (ou acrescente a pagina em `site/mapa.py`).
2. `python3 construtor.py`
3. Confira:

       cd public && python3 -m http.server 8099 &
       node auditoria.mjs http://127.0.0.1:8099
       node vitais.mjs http://127.0.0.1:8099
       python3 site/mapa_de_links.py

4. Commit + push.

A auditoria cobre title e description unicos e dentro do limite do SERP,
canonical, H1 unico, hierarquia de titulos sem salto, `alt` e dimensoes em
imagem, JSON-LD valido, id duplicado, ancora quebrada, link interno quebrado,
texto placeholder, erro de JavaScript — e, em mobile, alvo de toque, tamanho de
fonte, sanduiche e rolagem horizontal.

Para alterar a LP anterior: exporte o `.dc.html` do Claude Design por cima de
`src/Vegas Aceleradora v2.dc.html` e rode `python3 build.py` (precisa de `node`
com playwright; sem isso, `--so-template` gera so a etapa 1).

---

## Publicacao

**Cloudflare Pages.** Build command vazio, output directory `public`. Cada push
publica sozinho. O repositorio pode ser privado.

**HostGator (cPanel > Git Version Control).** Ver `.cpanel.yml` — atencao ao
`DEPLOYPATH`: nesta conta `/public_html` pertence a outro dominio. O deploy
escreve um `deploy-info.txt` na pasta de destino justamente para responder, do
navegador, se aquela pasta e mesmo o document root do dominio.

---

## Leads

O formulario de `/diagnostico/` — e o mesmo formulario no popup que os CTAs
abrem — valida no navegador, guarda uma copia no `localStorage` e abre o
WhatsApp com a mensagem pronta. O coletor do Painel de Sites (`f.js`) captura
o envio pela fase de captura do evento `submit`, antes do `preventDefault()`.

### A planilha

Tudo cai em **uma planilha so**: `Lista de Leads - SITE VEGAS`, nas abas
`Leads` e `Resumo`. Quem recebe e um App da Web do Apps Script; o codigo e o
passo a passo de implantacao estao em `integracoes/planilha-de-leads.gs`.

O script grava procurando o TITULO de cada coluna no cabecalho real, em vez de
contar posicoes. A aba ja tinha 12 colunas e linhas gravadas pela integracao
anterior: as colunas novas entram a direita e o historico fica onde esta.

A URL `/exec` da implantacao vai na constante `PLANILHA`, no topo de
`public/vegas.js` e de `public/site.js`. **Enquanto ela estiver vazia nada e
gravado** — o lead so chega pelo WhatsApp e pelo painel.

O script aceita os dois formatos de envio (JSON no corpo, do site novo; e
parametros soltos, da LP antiga) e descarta repetido pelo campo `id`, porque o
`sendBeacon` pode entregar duas vezes.

### As tres colunas de pagina

Respondem perguntas diferentes, e e por isso que sao tres:

    Pagina             onde o formulario foi enviado   -> o que CONVERTE
    Pagina de entrada  a primeira pagina da visita     -> o que ATRAI
    Veio de            o site anterior ao nosso        -> de ONDE veio

Antes havia uma coluna so, alimentada por um `landing_page` que mudava de
significado: a visita inteira so era guardada quando a URL trazia
utm/gclid/fbclid. Sem esses parametros a coluna virava a pagina do formulario;
com eles, a de entrada. Agora a entrada e guardada sempre, na primeira pagina
da sessao (`sessionStorage`, chave `vegas-origem`), e a do formulario e lida no
envio.

### GoHighLevel

A constante `GHL_WEBHOOK`, nos mesmos dois arquivos, e um destino adicional e
independente da planilha. Tambem esta vazia. Ao preencher, acrescentar o
GoHighLevel ao item 4 da politica de privacidade no mesmo commit — a pagina
lista os destinos que existem de fato.

### Por que `sendBeacon` com `text/plain`

Evita o preflight de CORS: com `application/json` o navegador manda um OPTIONS
antes, que nem o Apps Script nem o webhook do GHL respondem. E o envio
sobrevive a navegacao, que acontece logo em seguida quando o WhatsApp abre.
`fetch` com `keepalive` fica como reserva.
