# Arquitetura futura — Vegas Aceleradora

A Home já está preparada como página-entidade ("assessoria de marketing para
restaurantes e delivery"). As páginas abaixo **não foram criadas** — cada uma só
deve existir quando houver intenção de busca distinta e conteúdo próprio o
suficiente para justificar a URL. Nenhuma página vazia, nenhuma variação
por cidade em massa.

## Âncoras já existentes na Home (linkagem interna atual)

| Âncora | Conteúdo | Vira futura página |
|---|---|---|
| `#sistema` | Aquisição → conversão → recorrência, tráfego pago | `/trafego-pago-para-restaurantes/` |
| `#marketing-para-restaurantes` | O que é / como funciona / o que medir / comparações | `/marketing-para-restaurantes/` |
| `#resultados` | Painéis de clientes atendidos | `/cases/` |
| `#metodo` | Método em 3 blocos | — |
| `#quem-somos` | Entidade, time, desde 2019 | `/sobre/` |
| `#faq` | 11 perguntas com resposta objetiva | alimenta os FAQs das páginas de serviço |

## Páginas de serviço (prioridade 1)

- `/marketing-para-restaurantes/` — pergunta central: como funciona o marketing de um restaurante?
- `/marketing-para-delivery/` — como aumentar pedidos no delivery?
- `/trafego-pago-para-restaurantes/` — tráfego pago funciona? quanto investir?
- `/google-ads-para-restaurantes/` — como aparecer para quem pesquisa comida na região?
- `/meta-ads-para-restaurantes/` — como provocar desejo e vender em dia fraco?

## Páginas de serviço (prioridade 2 — só se a Vegas executar o serviço)

- `/gestao-de-ifood/`
- `/seo-local-para-restaurantes/`
- `/crm-para-restaurantes/`

## Páginas por segmento (só com case real do segmento)

- `/marketing-para-hamburguerias/`
- `/marketing-para-pizzarias/`
- `/marketing-para-restaurante-japones/`

## Conteúdo educacional

- `/blog/como-aumentar-vendas-restaurante/`
- `/blog/como-vender-mais-ifood/`
- `/blog/quanto-investir-marketing-restaurante/`
- `/blog/google-ads-ou-meta-ads-restaurante/`
- `/blog/como-aumentar-recorrencia-restaurante/`

## Regras de linkagem

1. Âncoras descritivos ("resultados de restaurantes atendidos"), nunca "clique aqui".
2. Cada página de serviço linka para a Home (entidade) e para as páginas irmãs
   do mesmo cluster.
3. Cada post de blog linka para a página de serviço correspondente.
4. Ao publicar, acrescentar a URL em `seo/sitemap.xml`.

## Pendências de conteúdo (dependem de dados reais do cliente)

- Números próprios para E-E-A-T: restaurantes atendidos, investimento gerido,
  ROAS médio, período. Sempre com contexto, nunca "+127%" solto.
- Cases estruturados: tipo de operação → problema → estratégia → canais →
  período → resultado → aprendizado.
- Autoria (nome, cargo, bio) para os conteúdos educacionais.
- Confirmação de quais serviços a Vegas realmente executa em iFood, SEO local /
  Google Meu Negócio e CRM, antes de criar esses clusters.
