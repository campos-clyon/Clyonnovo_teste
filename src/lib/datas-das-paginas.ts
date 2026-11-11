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
  // 04-11-2026 (d7): a recolha mínima dos móveis (40 € + IVA), os exemplos por peça pela tabela
  // (o sofá é uma peça grande) e o entulho a granel ao preço dos sacos (1 m³ = 40 sacos).
  // 03-11-2026 (d6 v2): a recolha de móveis por peça — pequena 15 €, média 30 €, grande 50 € + IVA —
  // em vez de «40 – 120 €», nas páginas que a mostram (os cartões, as frases, as tabelas).
  // As três páginas legais dizem a data no próprio texto («Última atualização»).
  "/termos": "2026-11-01",
  "/privacidade": "2026-11-01",
  "/cookies": "2026-10-29",

  // 29-10-2026: «parceiro» em vez de «profissional» em tudo o que o cliente lê
  // (dono). Antes, 28-10-2026 (d1): as avaliações por fonte, a promessa do prazo e os
  // botões do orçamento mudaram o texto destas páginas.
  "/": "2026-11-04",
  // 10-11-2026 (d29): os dados estruturados de /avaliacoes, /trabalhos, /precos e /blog
  // (o que a página diz ao Google sobre si: o caminho, as perguntas, a lista dos artigos).
  "/avaliacoes": "2026-11-10",
  "/faq": "2026-11-11",
  "/sobre-nos": "2026-11-04",
  "/trabalhos": "2026-11-10",
  "/blog": "2026-11-10",
  "/servicos": "2026-11-04",
  "/recolha-de-moveis": "2026-11-04",
  "/recolha-de-sofas": "2026-11-04",
  "/recolha-de-camas": "2026-11-04",
  "/recolha-de-armarios": "2026-11-04",
  // 02-11-2026: liga às secções «recolha gratuita» de Lisboa e de Setúbal.
  "/recolha-gratuita-de-moveis-usados": "2026-11-02",
  "/recolha-de-eletrodomesticos": "2026-11-04",
  "/recolha-de-moveis-urgente": "2026-10-29",
  "/retirar-moveis-velhos": "2026-11-04",
  "/orcamento-recolha-lisboa": "2026-11-04",
  "/como-funciona": "2026-11-01",
  // 31-10-2026 (d1): «Pedidos no mesmo dia custam mais?» passou a responder com NO_MESMO_DIA.
  "/precos": "2026-11-10",
  "/empresas": "2026-11-04",
  // 31-10-2026: o sem IVA nunca sozinho — cada preço com o com IVA ao lado (antes,
  // 29-10-2026: «parceiro»; e a garagem, o sótão e a cave na tabela do esvaziamento).
  "/precos/esvaziamento-de-casas": "2026-11-04",
  "/precos/mudancas": "2026-11-11",
  "/contactos": "2026-11-04",
  "/servicos/esvaziamento-apartamento": "2026-11-01",
  "/servicos/manutencao-casa": "2026-11-01",
  "/recolha-de-monos": "2026-10-31",
  // 03-11-2026 (d1 v2): os andares sem elevador por m³ na calculadora e nos factores do preço.
  // E no mesmo dia (d4): o saco a 4,00–4,80 € (10 sacos 40–48 €) e os andares por trabalho.
  "/recolha-de-entulho": "2026-11-04",
  "/precos/recolha-de-entulho": "2026-11-04",
  // 04-11-2026 (d7): os móveis com a recolha mínima e o sofá, a cama e o armário como peças grandes.
  "/precos/recolha-de-monos-e-moveis": "2026-11-04",
  "/esvaziamento-de-casas": "2026-11-01",
  "/esvaziamento-de-casas-amadora": "2026-11-01",
  // 11-11-2026: as mudanças ao preço de cada parceiro (o «desde» dos parceiros da lista, ou a referência).
  "/mudancas": "2026-11-11",
  "/transporte-de-moveis": "2026-11-11",
  "/pequenas-mudancas": "2026-11-11",
  "/mudancas-de-escritorio": "2026-11-11",
  // 31-10-2026 (d6 de 28-10): o primeiro ecrã, o número da semana, a app CLYON Pro.
  // 04-11-2026: as fotografias da carrinha no formulário (d17) e sem entulho na frase de abertura (d18).
  "/quero-ser-parceiro": "2026-11-04",
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
