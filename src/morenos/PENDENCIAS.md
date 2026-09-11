# Salão Morenos — o que falta para publicar no domínio do cliente

A página já está montada e navegável. O que está listado aqui é conteúdo que o
cliente ainda não entregou: enquanto não chegar, a página diz na cara que é
provisório, em vez de inventar dado. Essa regra vem do prompt aprovado
(`Prompt LP Morenos.dc.html`, blocos 01 e 10).

## Do cliente

1. **Telefone e WhatsApp por unidade**, em formato internacional (+55…), para o
   deep link. Os contatos antigos com DDD 41 foram descartados e não voltam.
2. **Horários de funcionamento por unidade**, por dia da semana.
3. **Número do imóvel** da Av. Terceiro Mundo e da Av. Brasil. Hoje a página
   escreve “número do imóvel a confirmar” nos dois endereços.
4. **O Clube**: nome dos planos, valor, serviços inclusos, limite de uso,
   unidades participantes, fidelidade e cancelamento. Nada de plano aparece
   antes disso.
5. **Link da agenda do Cash Barber por unidade.** Hoje o botão “Agendar” abre o
   seletor das três unidades e, ao escolher, mostra: “Ação provisória. A
   integração com a agenda desta unidade entra quando o link for confirmado.”
   Com os links, é trocar a ação do seletor pelo endereço de cada agenda.
6. **Fotos em alta** de fachada, interior, equipe e trabalhos autorizados, por
   unidade — ver “Imagens” abaixo.
7. **Logo em vetor**, positiva e negativa.
8. **Quais unidades fazem visagismo e dia do noivo**, e o que está incluso em
   cada um.
9. **Unidade de origem de cada avaliação do Google** e autorização de uso dos
   textos. A seção de avaliações tem três depoimentos reais e três vagas
   marcadas como “a importar”.
10. **Oferta corporativa confirmada**: o que é vendido, como é contratado, onde
    é atendido.
11. **Domínio final, endpoint de captura, política de privacidade e CNPJ.**
12. **Perfis sociais ativos** — os quatro ícones do rodapé hoje apontam para o
    topo da própria página, não para perfil nenhum.

## Imagens

- **`img/interior-1.webp` não veio no pacote.** É a foto do card “Dia do Noivo”.
  Para a página não ficar com imagem quebrada, o arquivo hoje é uma **cópia de
  `atendimento-2.webp`** (interior de uma unidade, foto real da Morenos). Basta
  substituir o arquivo pela foto definitiva e rodar o build de novo — nenhum
  código muda.
- **`img/logo-morenos-2x.png` tem 179 KB** para aparecer com 64 px de altura no
  cabeçalho. É a maior imagem do carregamento inicial depois do hero. Uma versão
  de 128×128 resolveria o mesmo com ~20 KB. Não mexi porque é asset do design.
- Duas imagens entregues não são usadas pela página: `fachada-vitrine-2.webp` e
  `mockup-clube.webp`.

## Na hora de publicar no domínio do Morenos

1. Apagar a linha `<meta name="robots" content="noindex, nofollow" />` de
   `src/morenos/extras-head.html`. Enquanto a página mora em
   `vegasaceleradora.com.br/morenos`, ela fica fora do índice de propósito —
   é ambiente de revisão, e indexar aqui criaria conteúdo duplicado com o
   domínio do cliente depois.
2. Publicar `public/morenos/` na raiz do domínio novo (a página usa só caminhos
   relativos, então funciona em qualquer pasta).
3. Criar `robots.txt` e `sitemap.xml` do domínio novo, e um
   `<link rel="canonical">` apontando para a URL final.
4. Conferir os dados estruturados de `extras-head.html`: acrescentar telefone e
   horário de cada unidade quando forem confirmados. Nota de avaliação
   (`AggregateRating`) só entra se vier do perfil real — não se inventa.
