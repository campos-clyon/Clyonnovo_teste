/**
 * QUANDO O CONTEÚDO DE CADA PÁGINA MUDOU — escrito à mão. (28-10-2026, d1.)
 *
 * É o `lastmod` do sitemap. Até aqui vinha do histórico do git, por GRUPOS de
 * páginas (conteudo-datas.generated.ts): mexer no modelo das páginas de cidade
 * — um botão, uma importação — punha 145 endereços com a mesma data, e uma
 * análise de fora leu isso como o que é: um carimbo, e não uma data. Um
 * `lastmod` que não é verdade ensina o Google a ignorá-lo em todo o sitemap.
 *
 * A regra agora:
 *   · os artigos do blog levam a data deles (`publishDate`/`updatedDate`);
 *   · os perfis dos profissionais, a última mudança na base;
 *   · as páginas desta lista, a data em que o TEXTO delas mudou (não um
 *     botão, não o menu, não o rodapé);
 *   · as outras — as de cidade, as de mudanças por cidade, as regiões e as
 *     que não estão aqui — não levam `lastmod`. Sem data verdadeira, nenhuma.
 *
 * Nunca a data do build nem a do git: a Vercel clona sem o histórico, e a do
 * build muda a cada envio. QUEM MUDAR O TEXTO DE UMA PÁGINA, MUDA A DATA DELA
 * AQUI (AAAA-MM-DD, hora de Lisboa).
 */
export const ACTUALIZADO_EM: Record<string, string> = {
  // 26-11-2026 (d4): as páginas públicas passam a tratar por «você» (Descreva, Receba, Escolha, Peça); o texto de cada uma mudou.
  // 23-11-2026 (d96): /mudancas com o parágrafo das cidades e uma linha própria em cada cartão.
  // 23-11-2026 (d7): o cartão do guia «Quanto custa uma mudança» em /mudancas lê a lista de parceiros, como o resto da página.
  // 17-11-2026 (d62/d63, acertos): o cartão das mudanças em /contactos com o com IVA da mesma etiqueta (49,20 €/h).
  // 17-11-2026 (d63): os monos desde 60 € + IVA (a recolha mínima), o esvaziamento de casa desde 260 € + IVA
  // (o T0/T1) e o mínimo da mudança dito com as pessoas (120 € com 2, 165 € com 3) — nas páginas que os mostram.
  // 16-11-2026 (d60): os preços que pagam a saída — a 1.ª peça grande a 65 €, a recolha mínima de 60 €, os
  // andares por peça grande, o esvaziamento T2–T4 e a moradia, e as mudanças na referência (40 €/h com 2
  // pessoas, 55 €/h com 3, 15 km incluídos) — nas páginas que os mostram.
  // 16-11-2026 (d51): o IVA pelo regime do parceiro (NA_PROPOSTA_COM_IVA) na inicial, nos contactos,
  // no «Como funciona» e na ajuda dos parceiros; as mudanças com o preço por hora combinado antes; a
  // versão do esvaziamento da página do anúncio; saíram os testemunhos que não estão no Google.
  // 15-11-2026 (d39): «o parceiro escolhido» em vez de «o parceiro que escolher» — o parceiro é
  // escolhido pelo cliente ou, num orçamento em valor único, pela CLYON.
  // 15-11-2026 (d30): as duas faturas de cada trabalho e «a proposta já é o total a pagar» em vez de
  // «há fatura em todas as vendas» e «o preço já vem com IVA»; /orcamento-recolha-lisboa sem entulho.
  // 04-11-2026 (d7): a recolha mínima dos móveis (40 € + IVA), os exemplos por peça pela tabela
  // (o sofá é uma peça grande) e o entulho a granel ao preço dos sacos (1 m³ = 40 sacos).
  // 03-11-2026 (d6 v2): a recolha de móveis por peça — pequena 15 €, média 30 €, grande 50 € + IVA —
  // em vez de «40 – 120 €», nas páginas que a mostram (os cartões, as frases, as tabelas).
  // As três páginas legais dizem a data no próprio texto («Última atualização»).
  "/termos": "2026-11-15",
  "/privacidade": "2026-11-24",
  "/cookies": "2026-10-29",

  // 29-10-2026: «parceiro» em vez de «profissional» em tudo o que o cliente lê
  // (dono). Antes, 28-10-2026 (d1): as avaliações por fonte, a promessa do prazo e os
  // botões do orçamento mudaram o texto destas páginas.
  "/": "2026-11-26",
  // 10-11-2026 (d29): os dados estruturados de /avaliacoes, /trabalhos, /precos e /blog
  // (o que a página diz ao Google sobre si: o caminho, as perguntas, a lista dos artigos).
  "/avaliacoes": "2026-11-16",
  "/faq": "2026-11-26",
  "/sobre-nos": "2026-11-26",
  "/trabalhos": "2026-11-10",
  // 18-11-2026 (d8): o guia novo para quem tem carrinha entra na lista dos artigos.
  "/blog": "2026-11-18",
  "/servicos": "2026-11-26",
  "/recolha-de-moveis": "2026-11-26",
  "/recolha-de-sofas": "2026-11-26",
  "/recolha-de-camas": "2026-11-26",
  "/recolha-de-armarios": "2026-11-26",
  // 02-11-2026: liga às secções «recolha gratuita» de Lisboa e de Setúbal.
  "/recolha-gratuita-de-moveis-usados": "2026-11-19",
  "/recolha-de-eletrodomesticos": "2026-11-26",
  "/recolha-de-moveis-urgente": "2026-11-15",
  "/retirar-moveis-velhos": "2026-11-16",
  "/orcamento-recolha-lisboa": "2026-11-19",
  "/como-funciona": "2026-11-26",
  // 31-10-2026 (d1): «Pedidos no mesmo dia custam mais?» passou a responder com NO_MESMO_DIA.
  "/precos": "2026-11-17",
  "/empresas": "2026-11-26",
  // d43: a página nova dos armazéns, escritórios e lojas.
  "/esvaziamento-de-armazens-e-escritorios": "2026-11-15",
  // 31-10-2026: o sem IVA nunca sozinho — cada preço com o com IVA ao lado (antes,
  // 29-10-2026: «parceiro»; e a garagem, o sótão e a cave na tabela do esvaziamento).
  "/precos/esvaziamento-de-casas": "2026-11-17",
  "/precos/mudancas": "2026-11-17",
  "/contactos": "2026-11-26",
  "/servicos/esvaziamento-apartamento": "2026-11-26",
  "/servicos/manutencao-casa": "2026-11-26",
  "/recolha-de-monos": "2026-11-17",
  // 03-11-2026 (d1 v2): os andares sem elevador por m³ na calculadora e nos factores do preço.
  // E no mesmo dia (d4): o saco a 4,00–4,80 € (10 sacos 40–48 €) e os andares por trabalho.
  "/recolha-de-entulho": "2026-11-26",
  "/precos/recolha-de-entulho": "2026-11-15",
  // 04-11-2026 (d7): os móveis com a recolha mínima e o sofá, a cama e o armário como peças grandes.
  // 18-11-2026 (d5): a descrição com o máximo da tabela, 15 a 65 € + IVA, e o com IVA ao lado.
  "/precos/recolha-de-monos-e-moveis": "2026-11-18",
  "/esvaziamento-de-casas": "2026-11-26",
  "/esvaziamento-de-casas-amadora": "2026-11-17",
  // 11-11-2026: as mudanças ao preço de cada parceiro (o «desde» dos parceiros da lista, ou a referência).
  "/mudancas": "2026-11-26",
  "/transporte-de-moveis": "2026-11-16",
  "/pequenas-mudancas": "2026-11-16",
  "/mudancas-de-escritorio": "2026-11-16",
  // 31-10-2026 (d6 de 28-10): o primeiro ecrã, o número da semana, a app CLYON Pro.
  // 04-11-2026: as fotografias da carrinha no formulário (d17) e sem entulho na frase de abertura (d18).
  // 11-11-2026 (d7): a taxa das mudanças pela lista de parceiros, dita ao lado do exemplo.
  // 18-11-2026 (d5): o menu «Soluções» sem a limpeza (serviço futuro).
  // 18-11-2026 (d8): o título e a descrição («Trabalho com carrinha…»), o bloco de Lisboa, Loures e
  // a Linha de Sintra com as ligações por zona, e a linha das mudanças escolhidas (3 horas).
  "/quero-ser-parceiro": "2026-11-19",
  // 17-11-2026 (d68): a Amora no título, na descrição e no H1 (a página para onde /recolha-moveis-amora vai).
  "/recolha-moveis-seixal": "2026-11-17",
  // 23-11-2026 (d5): o título de Lisboa (móveis) e o do Seixal (monos).
  "/recolha-moveis-lisboa": "2026-11-24",
  "/recolha-monos-seixal": "2026-11-23",
  // 23-11-2026 (d96): as 15 páginas de cidade que o Google pôs de lado, com texto, título e descrição próprios.
  "/recolha-monos-odivelas": "2026-11-23",
  "/recolha-monos-sesimbra": "2026-11-23",
  "/recolha-monos-montijo": "2026-11-23",
  "/recolha-monos-carnaxide": "2026-11-23",
  "/recolha-monos-olivais": "2026-11-23",
  "/esvaziamento-casas-almada": "2026-11-23",
  "/esvaziamento-casas-seixal": "2026-11-23",
  "/esvaziamento-casas-oeiras": "2026-11-23",
  "/esvaziamento-casas-barreiro": "2026-11-23",
  "/esvaziamento-casas-queluz": "2026-11-23",
  "/esvaziamento-casas-monte-abraao": "2026-11-23",
  "/esvaziamento-casas-alcochete": "2026-11-23",
  "/esvaziamento-casas-carnaxide": "2026-11-23",
  "/esvaziamento-casas-olivais": "2026-11-23",
  "/recolha-entulho-loures": "2026-11-23",
  // d96: o título e a descrição dos monos em Lisboa e em Cascais (o de móveis em Lisboa já está em cima).
  "/recolha-monos-lisboa": "2026-11-23",
  "/recolha-monos-cascais": "2026-11-23",
  // d96: factos corrigidos que estas páginas mostram — o ecocentro de Loures e de Odivelas (é o do Lumiar),
  // os monos de Odivelas pelas juntas, Oeiras grátis até 1 m³, Moscavide fora dos Olivais, o Alto da Loba fora de Carnaxide.
  "/recolha-moveis-loures": "2026-11-23",
  "/recolha-monos-loures": "2026-11-23",
  "/esvaziamento-casas-loures": "2026-11-23",
  "/recolha-moveis-odivelas": "2026-11-23",
  "/esvaziamento-casas-odivelas": "2026-11-23",
  "/recolha-moveis-olivais": "2026-11-23",
  "/recolha-entulho-olivais": "2026-11-23",
  "/recolha-monos-oeiras": "2026-11-23",
  "/recolha-moveis-oeiras": "2026-11-23",
  "/recolha-moveis-carnaxide": "2026-11-23",
  "/recolha-entulho-carnaxide": "2026-11-23",
  // d96: as mudanças com texto próprio (Seixal, Amadora, Almada) e os Olivais sem Moscavide nas zonas.
  "/mudancas/seixal": "2026-11-23",
  "/mudancas/amadora": "2026-11-23",
  "/mudancas/almada": "2026-11-23",
  "/mudancas/olivais": "2026-11-23",
};

/**
 * A data de uma página da lista — ou `undefined` (sem `lastmod`). Ao meio-dia
 * UTC, que é o mesmo dia em Lisboa no Inverno e no Verão.
 */
export function actualizadoEm(caminho: string): Date | undefined {
  const dia = ACTUALIZADO_EM[caminho || "/"];
  if (!dia) return undefined;
  const d = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  // No dia da mudança, antes do meio-dia UTC, o meio-dia ainda não chegou: nunca uma data no futuro.
  return d.getTime() > Date.now() ? new Date() : d;
}
