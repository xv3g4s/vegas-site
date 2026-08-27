# Vegas Aceleradora — site

Site institucional da Vegas Aceleradora (marketing para restaurantes e delivery).
Publicado na HostGator via **cPanel > Git Version Control**, a partir deste repositorio.

- Producao: https://vegasaceleradora.com.br/
- Origem do design: projeto Claude Design (`Vegas Aceleradora v2.dc.html`)

---

## Como o site funciona

O `index.html` nao e um HTML estatico comum: e um **template** do runtime do Claude
Design. O `support.js` le esse template (`<x-dc>`, `<helmet>`, `{{ }}`, `<sc-for>`,
`<sc-if>`) e monta a pagina no navegador usando React.

Por padrao o runtime baixaria o React do `unpkg.com`. Isso foi removido: o React
esta versionado em `vendor/` e o `index.html` aponta o runtime para la, atraves do
hook oficial `window.__resources`. **O site nao depende de nenhum CDN de JS.**
Os arquivos em `vendor/` sao os builds UMD oficiais do npm (react 18.3.1),
conferidos byte a byte contra os hashes SRI que o proprio `support.js` declara.

A unica dependencia externa que sobra e a fonte Poppins (Google Fonts).

---

## Estrutura

    index.html      pagina (template do runtime) ....... PUBLICADO
    support.js      runtime do Claude Design ........... PUBLICADO
    vendor/         react + react-dom (UMD, 18.3.1) .... PUBLICADO
    img/            imagens do site (webp) ............. PUBLICADO
    robots.txt      SEO ................................ PUBLICADO
    sitemap.xml     SEO ................................ PUBLICADO
    .htaccess       HTTPS, cache, compressao ........... PUBLICADO

    src/            fontes do projeto .................. NAO publicado
      Vegas Aceleradora v2.dc.html    design atual (fonte de index.html)
      Vegas Aceleradora.dc.html       versao anterior
      apps-script-vegas-leads.gs      backend de leads (Google Apps Script)
      aether-flow.js                  componente nao usado hoje
      CLAUDE.md                       diretrizes de design do projeto
      seo/arquitetura-futura.md       plano de novas paginas
    export/         bundle de 1 arquivo do Claude Design  NAO publicado
    uploads/        midia bruta (ignorada pelo git) ..... NAO publicado

O `.cpanel.yml` e uma **allowlist**: so o que esta marcado como PUBLICADO vai para
`~/public_html`. `src/`, `export/`, `uploads/`, `node_modules/` e `.git/` nunca sobem.

---

## Alterando o site

1. Edite o design no projeto do Claude Design.
2. Exporte o `.dc.html` atualizado e substitua `src/Vegas Aceleradora v2.dc.html`.
3. Gere o `index.html` (o template + o trecho que aponta o React para `vendor/`):

       python3 build.py

4. Commit + push. Na cPanel, clique em **Update from Remote** e depois **Deploy HEAD Commit**.

Para mexer so em texto/estilo, editar `index.html` direto tambem funciona — mas o
design volta a divergir do projeto do Claude Design, entao prefira o passo 1.
