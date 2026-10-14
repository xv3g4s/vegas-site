# Vegas Aceleradora — site

Site institucional da Vegas Aceleradora (marketing para restaurantes e delivery)
e as landing pages de cliente publicadas no mesmo dominio.

- Producao: https://vegasaceleradora.com.br/
- Origem do design: projeto Claude Design (`Vegas Aceleradora v2.dc.html`)

| pagina | fonte | build | vai para |
| --- | --- | --- | --- |
| site da Vegas | `src/Vegas Aceleradora v2.dc.html` | `build.py` | `public/index.html` |
| LP do Salao Morenos | `src/morenos/Home.dc.html` | `build-morenos.py` | `public/morenos/` |

---

## Como o site funciona

O design vem do Claude Design como um **template** (`src/*.dc.html`) que o
`support.js` monta com React. Servir isso direto custaria 207 KB de runtime no
navegador de cada visitante, e nada pintaria antes do JavaScript rodar.

Entao a montagem acontece **uma vez, no build**: o `prerender.mjs` abre o
template num Chromium headless, deixa o runtime montar a pagina e salva o
resultado como HTML estatico. O visitante recebe a pagina pronta.

    src/*.dc.html  --build.py-->  template  --prerender.mjs-->  public/index.html
                                  (runtime/)                    (estatico)

O `runtime/` (support.js + React) nunca chega ao navegador do visitante: e
dependencia de build. A interatividade volta pelo `public/site.js`, ~4 KB de
JavaScript comum — popup de lead, chat, UTM e animacoes de rolagem.

A edicao visual continua igual: o design e editado no projeto do Claude Design e
reexportado para `src/`. O editor nunca abre a pagina publicada.

**O site nao faz nenhuma requisicao a dominio de terceiro.** React saiu do
unpkg, a Poppins e servida localmente e os avatares dos depoimentos deixaram de
vir do randomuser.me.

### Progressive enhancement

Os CTAs sao `<a href="https://api.whatsapp.com/...">` de verdade, com o link ja
resolvido no HTML. Se o `site.js` falhar, o clique leva direto ao WhatsApp — a
conversao acontece do mesmo jeito, so sem o popup.

---

## Estrutura

    public/         TUDO que vai para o ar — e so isto que qualquer host publica
      index.html    pagina (gerada por build.py a partir de src/)
      support.js    runtime do Claude Design
      vendor/       react + react-dom (UMD, 18.3.1)
      img/          imagens do site (webp)
      robots.txt    SEO
      sitemap.xml   SEO
      _headers      cache e seguranca no Cloudflare Pages
      .htaccess     cache, seguranca e HTTPS no Apache (HostGator)

      morenos/      landing page do Salao Morenos (ver secao abaixo)

    src/            fontes do projeto — nunca publicado
      Vegas Aceleradora v2.dc.html    design atual (fonte do index.html)
      Vegas Aceleradora.dc.html       versao anterior
      apps-script-vegas-leads.gs      backend antigo de leads (Google Sheets)
      aether-flow.js                  componente nao usado hoje
      CLAUDE.md                       diretrizes de design do projeto
      seo/arquitetura-futura.md       plano de novas paginas
      morenos/      design, prompt aprovado e pendencias do Salao Morenos
    export/         bundle de 1 arquivo do Claude Design — nunca publicado
    build.py        gera public/index.html a partir de src/
    build-morenos.py       gera public/morenos/ a partir de src/morenos/
    prerender-morenos.mjs  captura estatica da LP do Morenos
    checar-morenos.mjs     confere a LP do Morenos ja publicada
    .cpanel.yml     deploy HostGator (ver aviso dentro do arquivo)

Nada fora de `public/` chega ao servidor.

---

## Publicacao

**Cloudflare Pages (recomendado).** Build command vazio, output directory `public`.
Cada push publica sozinho. O repositorio pode ser privado.

**HostGator (cPanel > Git Version Control).** Ver `.cpanel.yml` — atencao ao
`DEPLOYPATH`: nesta conta `/public_html` pertence a outro dominio.

---

## Leads

O popup envia para um **Inbound Webhook do GoHighLevel**. A URL fica na
constante `GHL_WEBHOOK`, no topo de `public/site.js` (e tambem em `submitLead`,
em `src/Vegas Aceleradora v2.dc.html`, que so roda durante a pre-renderizacao). Com ela vazia o formulario continua
funcionando: o lead e guardado no localStorage e o WhatsApp abre igual.

O envio usa `sendBeacon` (sobrevive a navegacao, e logo apos o envio a
pagina abre o WhatsApp) com `text/plain`, que evita o preflight de CORS —
com `application/json` o navegador manda um OPTIONS antes, que o webhook
do GHL nao responde. `fetch` com `keepalive` fica como reserva.

O `src/apps-script-vegas-leads.gs` e a integracao anterior, com Google
Sheets. Fica no repositorio como historico; nao esta mais em uso.

## Alterando o site

1. Edite o design no projeto do Claude Design.
2. Exporte o `.dc.html` e substitua `src/Vegas Aceleradora v2.dc.html`.
3. Rode `python3 build.py` para regerar `public/index.html`. O build precisa de
   `node` com playwright disponivel; sem isso, `python3 build.py --so-template`
   gera so a etapa 1 (pagina dependente do runtime, como era antes).
4. Commit + push.

---

## Landing page do Salao Morenos (`/morenos/`)

Barbearia com tres unidades em Serra, ES. O design vem do projeto Claude Design
`Home.dc.html`; o prompt aprovado que originou a pagina esta em
`src/morenos/Prompt LP Morenos.dc.html`, e o que ainda falta do cliente esta em
`src/morenos/PENDENCIAS.md`.

    python3 build-morenos.py     # gera public/morenos/
    node checar-morenos.mjs      # confere o resultado (36 verificacoes)

### Duas camadas na mesma pagina

O site da Vegas joga o runtime fora depois da pre-renderizacao, porque aquela
pagina e quase toda estatica. **Aqui nao da**: esta pagina tem estado em todo
lugar — mega menu, menu do celular, modal de unidades, lightbox da galeria, abas
e sanfona do FAQ, carrossel de etapas, hover de servicos e dos mapas. Reescrever
tudo isso em JavaScript comum seria manter uma segunda implementacao do design,
que divergiria na primeira reexportacao.

Entao a pagina publicada leva as duas camadas:

1. **copia estatica** da pagina montada, capturada no build em viewport de
   celular. E o primeiro quadro do visitante e o que o robo de busca le: texto,
   imagens e links prontos, sem depender de JavaScript;
2. **template + runtime**, com `defer`. Quando o React monta, a copia estatica
   sai e a pagina viva entra no lugar — a troca acontece em um unico quadro,
   com a rolagem preservada.

Se o JavaScript falhar ou for bloqueado, a camada 1 continua na tela: a pagina
permanece legivel e as ancoras funcionam. Custo da camada 2: 207 KB de runtime
(~63 KB comprimido), carregados depois da pintura.

A pagina **nao faz nenhuma requisicao a dominio de terceiro**: React sai de
`vendor/` e a Poppins e servida de `fonts/` (o build troca o `<link>` do Google
por uma copia local). O `checar-morenos.mjs` reprova o build se alguma
requisicao externa aparecer.

### Correcoes aplicadas no build

O `build-morenos.py` aplica ao arquivo exportado, sempre conferindo se a agulha
existe (se nao existir, o build para e avisa):

- Poppins do Google -> `fonts/poppins.css` local;
- `window.__resources` apontando o React para `vendor/`;
- `min-width:0` na moldura do carrossel de etapas. `aspect-ratio:16/11` com
  `min-height:280px` cria uma largura minima de 407 px; num aparelho de 390 px o
  navegador alargava o viewport de layout para 423 px, encolhendo a pagina e
  jogando a borda direita de todo elemento `position:fixed` para fora da tela —
  inclusive o botao de fechar do modal de agendamento.

### Fora do indice, de proposito

Enquanto a LP mora em `vegasaceleradora.com.br/morenos` ela e ambiente de
revisao e carrega `<meta name="robots" content="noindex, nofollow">`, como pede
o bloco 05 do prompt aprovado. O passo a passo para publicar no dominio do
cliente esta no fim do `src/morenos/PENDENCIAS.md`.

### Alterando a LP

1. Edite o design no projeto do Claude Design.
2. Exporte o `.dc.html` e substitua `src/morenos/Home.dc.html`.
3. `python3 build-morenos.py && node checar-morenos.mjs`.
4. Commit + push.
