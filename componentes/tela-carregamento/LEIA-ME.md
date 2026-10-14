# Tela de carregamento

A logo do cliente aparece enquanto a página carrega, com um brilho correndo por
cima dela. Quando a página fica **pronta de verdade**, a logo acende em branco e
a tela sai. Da segunda carga em diante — navegação interna, voltar, abrir outra
página — a mesma tela aparece em **modo curto**: a logo entra na hora e a tela
sai assim que a página está pronta, sem espera mínima.

Feita no site do Salão Morenos e extraída daqui para instalar em qualquer
cliente. Um arquivo, sem dependência, sem build: **14,7 KB (5,5 KB comprimido)**.

```
tela-carregamento.js    o componente (é só isso que vai para o site do cliente)
preparar-logo.mjs       reduz a logo e converte para WebP de máscara
teste.mjs               21 verificações no Chromium — roda contra o site do cliente
exemplo/                página de demonstração, abra para ver funcionando
```

---

## Instalação em 3 linhas

No `<head>`, **o mais cedo possível** (antes de qualquer folha de estilo pesada):

```html
<style>html,body{background:#080908;margin:0}</style>
<link rel="preload" as="image" href="/img/logo-mascara.webp">
<script src="/tela-carregamento.js"
        data-logo="/img/logo-mascara.webp"
        data-logo-w="720" data-logo-h="673"
        data-cor="#B79A6A"
        data-texto="Carregando o site da Barbearia X"></script>
```

- A **primeira linha** é o que impede o flash branco antes do script rodar.
  Use a mesma cor do `data-fundo-solido`.
- A **segunda** faz a logo chegar junto com o HTML. Sem ela, a tela aparece
  vazia por um instante.
- O script **não pode ter `defer` nem `async`**: ele precisa rodar antes do
  primeiro quadro. São 5,5 KB — não é isso que vai atrasar a página.

Sem JavaScript, nada disso existe e o site aparece normalmente.

## A logo

A imagem entra como **máscara CSS**: só a forma (o canal alfa) aparece, a cor
vem do componente. Então:

- fundo **transparente** (PNG, WebP ou SVG);
- a forma em **branco sólido** — se o arquivo for colorido, a cor é ignorada;
- ~400 px de largura bastam (na tela ela nunca passa de 200 px);
- `data-logo-w` e `data-logo-h` são as proporções do arquivo. Erraram? A logo
  estica.

Para preparar:

```bash
node preparar-logo.mjs logo-cliente.png logo-mascara.webp 400 0.8 --mascara
```

`--mascara` pinta o RGB de branco antes de salvar: como só o alfa é usado, isso
derruba o peso sem mudar nada do que se vê (na logo do Morenos, 121 KB → 27 KB).
Precisa de `playwright` instalado; com ferramenta própria, o equivalente é
`cwebp -q 80 -resize 400 0`.

**Logo que não é um símbolo** (uma assinatura horizontal comprida, por exemplo)
fica pequena no celular. Nesse caso, aumente `data-tamanho-celular`.

## Opções

Todas valem como atributo `data-` no `<script>` (em `kebab-case`) ou como
`window.TELA_CARREGAMENTO = { ... }` declarado **antes** do script. O atributo
ganha, por estar mais perto da página.

| atributo | padrão | o que faz |
| --- | --- | --- |
| `data-logo` | — | **obrigatório**. Sem ele o componente não faz nada |
| `data-logo-w` / `data-logo-h` | `1` / `1` | proporção do arquivo da logo |
| `data-cor` | `#B79A6A` | cor do brilho que corre pela logo |
| `data-cor-base` | `rgba(255,255,255,.24)` | logo apagada, antes de acender |
| `data-cor-acesa` | `#FFFFFF` | logo acesa, no fim |
| `data-fundo-solido` | `#080908` | cor chapada do fundo |
| `data-fundo` | degradê a partir da cor acima | qualquer valor de `background` |
| `data-texto` | `Carregando` | lido por leitor de tela, não aparece |
| `data-tamanho` | `clamp(140px,12vw,200px)` | tamanho da logo no desktop |
| `data-tamanho-celular` | `clamp(120px,38vw,160px)` | tamanho até 599 px |
| `data-tempo-minimo` | `1200` | ms de tela na primeira carga, mesmo se a página já estiver pronta |
| `data-tempo-maximo` | `6000` | rede de segurança: nunca prender o site |
| `data-duracao-saida` | `560` | ms do fade de saída |
| `data-repeticao` | `curto` | `curto`, `fade`, `completo` ou `nada` (ver abaixo) |
| `data-chave-sessao` | `tela_carregamento_vista` | chave no `sessionStorage` |
| `data-seletor-hero` | `img[fetchpriority="high"]` | a imagem que precisa estar pronta |
| `data-aguardar-classe` | — | espera essa classe no `<html>` (ver abaixo) |
| `data-evento` | `tela-carregamento:fim` | nome do evento disparado no fim |

### `data-repeticao`

| valor | da segunda carga em diante |
| --- | --- |
| `curto` (padrão) | mesma tela, logo entra na hora, sai assim que a página fica pronta (~0,5 s) |
| `fade` | sem tela: só um fade de 0,22 s na página |
| `completo` | a intro inteira toda vez — cansa, só para apresentação |
| `nada` | nada |

"Sessão" é a aba: `sessionStorage`. Aba nova vê a intro de novo; voltar para a
aba não dispara nada (o navegador restaura a página do cache).

## O que a tela espera antes de sair

Esta é a parte que diferencia de um "loader de 2 segundos":

1. **DOM pronto** (`DOMContentLoaded`);
2. **a logo da própria tela** — senão ela apareceria vazia;
3. **as fontes** (`document.fonts.ready`), senão o texto trocaria de letra na cara do visitante;
4. **a imagem principal** (`data-seletor-hero`), procurada por até 2 s — ela pode ser montada por JavaScript depois do script;
5. **`window.load`**: folhas de estilo, scripts e as imagens que a página realmente busca;
6. **a classe de `data-aguardar-classe`**, se houver.

Imagem com `loading="lazy"` fora da primeira dobra **não** entra na conta — o
navegador só a busca na rolagem, e a tela ficaria presa esperando. Acima de
tudo isso vale `data-tempo-maximo`: se algo travar, a tela sai assim mesmo.

## Casos especiais

**Site que troca a página estática pela versão montada em JavaScript** (React,
Vue, o runtime do Claude Design): a troca acontecia depois da tela sair, na cara
do visitante. Faça o seu código marcar o `<html>` quando montar e avise o
componente:

```html
<script src="/tela-carregamento.js" data-logo="..." data-aguardar-classe="app-pronto"></script>
```

```js
document.documentElement.classList.add('app-pronto');   // no fim da montagem
```

Se a classe nunca chegar, a tela sai em 6 s assim mesmo.

**WordPress**: cole as três linhas num plugin de cabeçalho (Insert Headers and
Scripts, WPCode) ou no `header.php` do tema filho, logo depois de `<head>`.
Suba o `.js` e a logo pela Mídia ou por FTP e use as URLs completas.

**GoHighLevel**: Sites → a página → Settings → **Custom Code → Header**. Suba o
`.js` e a logo em Media Storage e use a URL que o GHL devolve. Em funil com
várias etapas, cole no header do funil inteiro para o modo curto valer entre as
etapas.

**Loja (Shopify, Nuvemshop)**: no `theme.liquid`/cabeçalho do tema, dentro do
`<head>`. Em loja, considere `data-repeticao="fade"`: quem navega por catálogo
abre muitas páginas seguidas.

**Saber quando a tela saiu** (para começar uma animação de entrada, por exemplo):

```js
window.addEventListener('tela-carregamento:fim', (e) => {
  e.detail.modo;   // 'completo' na primeira carga, 'curto' nas seguintes
});
```

## Testar

```bash
node teste.mjs                       # na página de exemplo
node teste.mjs https://cliente.com/  # no site do cliente, depois de instalar
```

21 verificações no Chromium: a tela aparece antes do DOM pronto, trava a
rolagem, **só sai com `readyState === "complete"`**, devolve a rolagem, acerta o
`aria-busy`, dispara o evento, usa o modo curto na segunda carga da mesma aba,
volta para a intro completa com `?intro`, respeita "reduzir movimento", não
prende a página, **a logo carrega mesmo** (o erro de instalação mais comum — a
tela "funciona" e fica vazia) e, sem JavaScript, o site aparece normal.

Precisa de `playwright` (`npm i -D playwright`). Para olhar com o olho:
`exemplo/index.html` — recarregue para ver o modo curto, `?intro` para a intro
completa de novo.

## Acessibilidade

A tela é `role="status"` com um texto só para leitor de tela; o conteúdo fica
`aria-busy="true"` enquanto ela cobre a página. Com `prefers-reduced-motion:
reduce` não há brilho, crescimento nem fade longo: a logo aparece acesa e a tela
sai em ~0,25 s, sem espera mínima. A rolagem é travada sem `overflow:hidden`, o
que evita o salto de layout de quando a barra some.

## Decisões que parecem detalhe e não são

- **`z-index: 2147483000`**: acima de header fixo, modal e widget de terceiro
  (chat, cookie banner), sem chegar no teto do inteiro de 32 bits.
- **A tela sai, o `<style>` fica**: remover a folha forçaria um recálculo de
  estilo da página inteira no pior momento possível.
- **A logo continua de onde a animação de crescimento parou** (`--tc-escala`):
  sem isso ela dá um solavanco ao começar a sair.
- **Duas redes de segurança**: o `tempo-maximo` na corrida de promessas e um
  `setTimeout` independente, para o caso de uma promessa nunca resolver.
