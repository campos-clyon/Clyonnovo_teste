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
  // As três páginas legais dizem a data no próprio texto («Última atualização»).
  "/termos": "2026-10-30",
  "/privacidade": "2026-10-29",
  "/cookies": "2026-10-29",

  // 29-10-2026: «parceiro» em vez de «profissional» em tudo o que o cliente lê
  // (dono). Antes, 28-10-2026 (d1): as avaliações por fonte, a promessa do prazo e os
  // botões do orçamento mudaram o texto destas páginas.
  "/": "2026-10-29",
  "/avaliacoes": "2026-10-29",
  "/contactos": "2026-10-29",
  "/faq": "2026-10-29",
  "/sobre-nos": "2026-10-29",
  "/trabalhos": "2026-10-29",
  "/servicos": "2026-10-29",
  "/servicos/esvaziamento-apartamento": "2026-10-29",
  "/servicos/manutencao-casa": "2026-10-29",
  "/recolha-de-moveis": "2026-10-29",
  "/recolha-de-sofas": "2026-10-29",
  "/recolha-de-camas": "2026-10-29",
  "/recolha-de-armarios": "2026-10-29",
  "/recolha-de-eletrodomesticos": "2026-10-29",
  "/recolha-de-moveis-urgente": "2026-10-29",
  "/retirar-moveis-velhos": "2026-10-29",
  "/recolha-de-monos": "2026-10-29",
  "/recolha-de-entulho": "2026-10-29",
  "/esvaziamento-de-casas": "2026-10-29",
  "/esvaziamento-de-casas-amadora": "2026-10-29",
  "/transporte-de-moveis": "2026-10-29",
  "/pequenas-mudancas": "2026-10-29",
  "/mudancas-de-escritorio": "2026-10-29",
  "/orcamento-recolha-lisboa": "2026-10-29",
  "/mudancas": "2026-10-29",
  "/como-funciona": "2026-10-29",
  "/precos": "2026-10-29",
  // 29-10-2026: a garagem, o sótão e a cave entraram na tabela do esvaziamento.
  "/precos/esvaziamento-de-casas": "2026-10-29",
  "/empresas": "2026-10-29",
};

/**
 * A data de uma página da lista — ou `undefined` (sem `lastmod`). Ao meio-dia
 * UTC, que é o mesmo dia em Lisboa no Inverno e no Verão.
 */
export function actualizadoEm(caminho: string): Date | undefined {
  const dia = ACTUALIZADO_EM[caminho || "/"];
  if (!dia) return undefined;
  const d = new Date(`${dia}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
