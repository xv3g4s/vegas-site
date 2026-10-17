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

O formulario de `/diagnostico/` valida no navegador, guarda uma copia no
`localStorage` e abre o WhatsApp com a mensagem pronta. O coletor do Painel de
Sites (`f.js`) captura o envio pela fase de captura do evento `submit`, antes
do `preventDefault()`.

Existe tambem um envio para um **Inbound Webhook do GoHighLevel**, na constante
`GHL_WEBHOOK` no topo de `public/vegas.js` (e de `public/site.js`, para a LP).
**Hoje ela esta vazia**, entao nada e enviado ao CRM — o lead so chega pelo
WhatsApp e pelo painel. Preencher a URL ativa o envio; nesse dia, acrescentar o
GoHighLevel ao item 4 da politica de privacidade, no mesmo commit.

O envio usa `sendBeacon` com `text/plain`, que evita o preflight de CORS — com
`application/json` o navegador manda um OPTIONS antes, que o webhook do GHL nao
responde. `fetch` com `keepalive` fica como reserva.

O `src/apps-script-vegas-leads.gs` e a integracao anterior, com Google Sheets.
Fica no repositorio como historico; nao esta mais em uso.
