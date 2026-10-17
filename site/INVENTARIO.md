# Inventário da marca e registro de riscos — Vegas Aceleradora

Levantado a partir do repositório, que **é** o site no ar (`public/index.html`
sai de `src/Vegas Aceleradora v2.dc.html`). Não foi raspado do domínio: o
ambiente desta sessão bloqueia `vegasaceleradora.com.br` por política de rede,
e o repositório é fonte melhor de qualquer forma — traz o original, não o
renderizado.

---

## 1. Identidade visual — extraída, não escolhida

Contagem de ocorrências no código do site atual:

| Cor | Ocorrências | Papel |
|---|---:|---|
| `#F49E1D` | 80 | âmbar da marca — **é o "dourado" do briefing** |
| `#D3372B` | 43 | vermelho da marca |
| `#F04E23` | 40 | laranja intermediário do degradê |
| `#F3EDE3` | 37 | off-white do texto |
| `#9C968A` | 33 | cinza de apoio |
| `#141210` | 26 | superfície elevada |
| `#0A0908` | 24 | preto Vegas (fundo) |

**Contradição resolvida.** O briefing pede "tons dourados" e, no mesmo
documento, proíbe trocar os elementos oficiais por identidade genérica. As duas
coisas se encontram no `#F49E1D`: ele já é o dourado da Vegas — o extremo âmbar
do degradê da marca. Não inventei um dourado novo; usei o que existe.

**Mudança de uso, não de cor.** A LP atual aplica o degradê em tudo. O briefing
pede dourado como acento pontual e proíbe excesso de gradiente. Na Fase 1 o
degradê ficou restrito a **um lugar: o botão primário**. O resto do dourado é
acento sólido.

**Contraste.** `#F49E1D` sobre preto passa folgado e **reprova** sobre o
off-white. Por isso o sistema tem dois acentos — `--ouro` para fundo escuro,
`--acento-claro` (`#B4482B`) para fundo claro. Trocar um pelo outro quebra WCAG.

- **Tipografia:** Poppins, servida localmente em `public/fonts/` (300/400/600/700/800).
  Nenhuma chamada ao Google Fonts.
- **Logo:** `img/logo-vegas-aceleradora.webp` + `img/selo-vegas-aceleradora.webp`
  + `img/logo-v-outline-mask.webp`.

## 2. Mídia reaproveitável

| Arquivo | Uso |
|---|---|
| `hero-fundador-vegas-hd.webp` (2560×1440) | origem do recorte retrato; OG image |
| `hero-fundador-vegas-retrato.webp` (1152×1440) | hero desktop — recortado nesta sessão do HD |
| `hero-fundador-vegas-mobile-opt.webp` (826×1147) | hero mobile |
| `equipe-vegas-aceleradora-escritorio-opt.webp` | seção solução |
| `metodo-01/02/03-*.webp` | seção equipe e futuras páginas |
| `case-*.webp` (8 arquivos) | marcas atendidas |
| `atendente-vegas-b.webp` | botão flutuante de WhatsApp |
| `marmore-preto-laranja-vegas-opt.webp` | textura de fundo, não usada na Fase 1 |

`avatar-1..9.webp` são **ilustrações genéricas**, não fotos de clientes. Ver §4.

## 3. Conteúdo confirmado (está publicado hoje pela própria Vegas)

- Assessoria de marketing especializada em restaurantes e delivery.
- Atende: restaurantes, pizzarias, hamburguerias, japoneses, cafeterias, bares,
  dark kitchens, delivery.
- Canais: Meta Ads (Instagram/Facebook) e Google Ads.
- Frentes: aquisição, conversão, recorrência.
- Contrato **sem fidelidade**.
- Contato: `contato@vegasaceleradora.com.br` · `+55 (27) 9 9224-6343`.
- 8 marcas de clientes com logotipo publicado.

## 4. Registro de riscos — confirmar antes de reafirmar

Nada disto foi inventado por mim: **tudo já está no ar hoje**. O registro existe
porque reafirmar em página nova é reassumir a promessa, e algumas delas são
compromissos comerciais que eu não tenho como verificar.

| Afirmação | Onde está hoje | Entrou na Home nova? | Por quê |
|---|---|---|---|
| "Resultado ou seu dinheiro de volta" | seção Garantia | **Não** | Garantia de reembolso é obrigação contratual. O briefing diz "não invente garantias"; reafirmar sem confirmar o contrato é assumir por você. |
| "Investimos no seu anúncio" | hero e garantia | **Não** | Promessa financeira. Mesmo motivo. |
| "Desde 2019" / "anos de mercado" | Quem somos | **Não** | Não verificável daqui. Fora também do JSON-LD — ver §5. |
| "Atuando em todo o Brasil" | Quem somos | Sim, como "trabalho remoto" | Reformulado para o que é verificável. |
| 6 depoimentos nominais | Depoimentos | **Não** | Nomes abreviados + avatar ilustrativo. Precisam de autorização do cliente e, idealmente, foto real. |
| Logotipos dos 8 clientes | Resultados | **Sim** | Ativo já publicado pela Vegas. |

**Para reativar qualquer linha acima:** confirme e eu reponho — é texto, não
arquitetura.

## 5. Decisão sobre dados estruturados

O JSON-LD da Home traz `Organization`, `WebSite` e `FAQPage`, e **só com dado
verificável**: nome, URL, logo, e-mail, telefone, descrição, país.

Ficou de fora de propósito: `foundingDate`, número de clientes, métricas e
qualquer agregado de avaliação. Dado estruturado é lido por máquina e citado por
mecanismo de IA — uma afirmação não confirmada ali pesa mais do que no texto
corrido, e é mais difícil de desfazer depois.

O `FAQPage` é gerado **lendo o FAQ renderizado da própria página**, não de uma
lista paralela. Assim o schema não tem como divergir do que está na tela: se a
pergunta sair da página, sai do schema junto. O briefing proíbe FAQ artificial
para manipular buscador, e schema que não bate com a tela é exatamente isso.

## 6. Achados técnicos

1. **Comentário com telefone fictício no HTML publicado.** `public/index.html`
   carrega um bloco de script morto (resto do runtime) com o comentário
   `27999999999 -> +5527999999999`. Não é link nem dado exibido, mas é código
   que vai para o visitante sem servir a nada.
2. **Nenhuma CSP servida** — decisão anterior documentada no `.htaccess`
   (a LP tem estilo inline em quase todo elemento).
3. **`sitemap.xml` tinha só a Home** e agora é gerado a partir de
   `site/mapa.py`, contando apenas páginas com `publicada=True`.

## 7. Pendência que bloqueia tudo

**O deploy não chega ao document root do domínio.** O carimbo
`deploy-info.txt`, gravado em `$HOME/vegasaceleradora.com.br`, deu 404 no
navegador. Isso significa que o site servido vem de outra pasta — provavelmente
a cópia antiga em `public_html`, do primeiro deploy errado.

Enquanto isso não for resolvido, **nada publicado aqui chega a visitante
nenhum**, e é também por isso que o coletor de analytics nunca registrou um
evento. O `.cpanel.yml` já lista os candidatos no log do deploy e grava uma
sonda em cada um. Ver `sonda-vegas.txt`.
