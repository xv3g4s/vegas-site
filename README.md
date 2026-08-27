# Vegas Aceleradora — site

Site institucional da Vegas Aceleradora (marketing para restaurantes e delivery).

- Producao: https://vegasaceleradora.com.br/
- Origem do design: projeto Claude Design (`Vegas Aceleradora v2.dc.html`)

---

## Como o site funciona

O `public/index.html` nao e um HTML estatico comum: e um **template** do runtime do
Claude Design. O `support.js` le esse template (`<x-dc>`, `<helmet>`, `{{ }}`,
`<sc-for>`, `<sc-if>`) e monta a pagina no navegador usando React.

Por padrao o runtime baixaria o React do `unpkg.com`. Isso foi removido: o React
esta versionado em `public/vendor/` e o `index.html` aponta o runtime para la pelo
hook oficial `window.__resources`. **O site nao depende de nenhum CDN de JS.**
Os arquivos em `vendor/` sao os builds UMD oficiais do npm (react 18.3.1),
conferidos byte a byte contra os hashes SRI que o proprio `support.js` declara.

A unica dependencia externa que sobra e a fonte Poppins (Google Fonts).

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

    src/            fontes do projeto — nunca publicado
      Vegas Aceleradora v2.dc.html    design atual (fonte do index.html)
      Vegas Aceleradora.dc.html       versao anterior
      apps-script-vegas-leads.gs      backend de leads (Google Apps Script)
      aether-flow.js                  componente nao usado hoje
      CLAUDE.md                       diretrizes de design do projeto
      seo/arquitetura-futura.md       plano de novas paginas
    export/         bundle de 1 arquivo do Claude Design — nunca publicado
    build.py        gera public/index.html a partir de src/
    .cpanel.yml     deploy HostGator (ver aviso dentro do arquivo)

Nada fora de `public/` chega ao servidor.

---

## Publicacao

**Cloudflare Pages (recomendado).** Build command vazio, output directory `public`.
Cada push publica sozinho. O repositorio pode ser privado.

**HostGator (cPanel > Git Version Control).** Ver `.cpanel.yml` — atencao ao
`DEPLOYPATH`: nesta conta `/public_html` pertence a outro dominio.

---

## Alterando o site

1. Edite o design no projeto do Claude Design.
2. Exporte o `.dc.html` e substitua `src/Vegas Aceleradora v2.dc.html`.
3. Rode `python3 build.py` para regerar `public/index.html`.
4. Commit + push.
