/**
 * OS NOMES DOS SERVIÇOS NA ROTA DO ORÇAMENTO — 25-10-2026.
 *
 * Viviam dentro de /api/simulator/analyze e só conheciam as recolhas, os
 * esvaziamentos e as mudanças. Um pedido de manutenção da casa ia à pesquisa
 * de preços como «serviço de transporte», e chegava ao modelo com o código
 * cru («manutencao_casa»). Vivem aqui para se poderem testar: uma rota do
 * Next.js não pode exportar mais do que os métodos.
 *
 * Nenhum dos dois leva dados da pessoa — só o tipo de serviço.
 */

/** Como o serviço se diz na pesquisa externa de preços. */
const NA_PESQUISA: Record<string, string> = {
  recolha_moveis: "recolha de móveis",
  recolha_monos: "recolha de monos volumosos",
  recolha_entulho: "recolha de entulho",
  esvaziamento_casa: "esvaziamento de casa",
  esvaziamento_apartamento: "esvaziamento de apartamento",
  mudanca: "mudança de casa",
  manutencao_casa: "reparações e manutenção da casa",
  outro: "serviço de transporte",
};

/** Como o serviço se diz ao modelo, na linha «Tipo de Serviço». */
const PARA_O_MODELO: Record<string, string> = {
  recolha_moveis: "Recolha de móveis",
  recolha_monos: "Recolha de monos/volumosos",
  recolha_entulho: "Recolha de entulho",
  esvaziamento_casa: "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca: "Mudança",
  manutencao_casa: "Manutenção da casa (reparações e remodelações)",
  outro: "Outro serviço",
};

/** O serviço na pesquisa de preços; o que não se conhece fica «serviço de transporte», como antes. */
export function servicoNaPesquisa(serviceType?: string | null): string {
  return NA_PESQUISA[serviceType ?? ""] ?? "serviço de transporte";
}

/** O serviço para o modelo; o que não se conhece segue com o código, como antes. */
export function servicoParaOModelo(serviceType?: string | null): string {
  return serviceType ? PARA_O_MODELO[serviceType] || serviceType : "(não especificado)";
}
