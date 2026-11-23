import { PECAS_EM_TEXTO, PRECO_POR_SACO } from "./precos-publicos";
import { type BaseDoPreco } from "./base-do-preco";

/**
 * O VALOR, O QUE COBRE E O EXTRA NO LOCAL — 15-11-2026 (decisão d47).
 *
 * As três primeiras partes da mensagem curta (`mensagem-do-orcamento.ts`),
 * à parte e sem dependências pesadas: a nota do preço que o cliente lê no
 * site, na app e nas mensagens da Vitória (`itens-a-mais.ts`) sai daqui, e a
 * app importa essa. Os números saem das fontes únicas (`precos-publicos.ts`).
 */

/** «105 €», «129,15 €», «1 230 €» — sem «,00» quando é redondo. */
export function eurosCurtos(v: number): string {
  const c = Math.round(v * 100) / 100;
  const [inteiro, cent] = c.toFixed(2).split(".");
  const grupos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return cent === "00" ? `${grupos} €` : `${grupos},${cent} €`;
}

/** (a) «105 € + IVA = 129,15 €» — e sem fatura, só o total. */
export function valorComIva(semIva: number, total: number): string {
  if (Math.abs(total - semIva) < 0.005) return eurosCurtos(total);
  return `${eurosCurtos(semIva)} + IVA = ${eurosCurtos(total)}`;
}

/** d63: o que o cliente lê sobre as cargas — igual em todo o lado (`frase-da-base.ts`). */
export const AS_CARGAS_CONFIRMAM_SE_NO_LOCAL =
  "O número de cargas é confirmado consigo no local, pelo parceiro, antes de começar.";

/** d63: o que o cliente lê sobre as horas — igual em todo o lado (`frase-da-base.ts`). */
export const AS_HORAS_CONTAM_SE_NO_DIA = "As horas contam-se no dia e o total fica na folha que valida no fim.";

/** (b) O que o valor cobre. */
export const INCLUI = "Inclui o que está nas fotografias e na descrição.";

const virgula = (n: number) => n.toFixed(2).replace(".", ",");

/**
 * A tabela das peças: «peça pequena 15 €, média 30 €, grande 65 € a primeira e 50 €
 * as seguintes, + IVA». Sai de `PECAS_EM_TEXTO` desde 17-11-2026 (d62): dizia a
 * grande a 50 €, sem a primeira a 65 € da d60.
 */
export const TABELA_DAS_PECAS_CURTA = `peça ${PECAS_EM_TEXTO}, + IVA`;

/**
 * O QUE O CLIENTE GANHA — 17-11-2026 (d66, textos do Vendas). Uma frase por
 * serviço, só nas mensagens do orçamento (`linhasDoOrcamento`): o que o
 * parceiro faz por ele. Vazia nos serviços sem frase. Sem «verificado» aqui:
 * esse só sai onde o código confirma as três confirmações.
 */
export function oQueGanha(servico: string | null | undefined): string {
  switch (servico) {
    case "recolha_moveis":
    case "recolha_monos":
      return "O parceiro carrega e leva tudo: não tem de mexer em nada.";
    case "recolha_entulho":
      return "O parceiro carrega e leva o entulho ao destino certo: não tem de mexer em nada.";
    case "esvaziamento_casa":
    case "esvaziamento_apartamento":
      return "O parceiro tira tudo e a casa fica vazia: não tem de tratar de nada.";
    case "esvaziamento_garagem":
      return "O parceiro tira tudo e a garagem fica vazia: não tem de tratar de nada.";
    case "esvaziamento_sotao":
      return "O parceiro tira tudo e o sótão fica vazio: não tem de tratar de nada.";
    case "esvaziamento_cave":
      return "O parceiro tira tudo e a cave fica vazia: não tem de tratar de nada.";
    case "esvaziamento_empresa":
      return "O parceiro tira tudo e o espaço fica vazio: não tem de tratar de nada.";
    case "mudanca":
      return "A equipa do parceiro desmonta, carrega e monta no destino: não tem de pegar em nada.";
    case "manutencao_casa":
      return "O parceiro vem com as ferramentas e faz o que está descrito.";
    default:
      return "";
  }
}

/**
 * (c) O extra no local — com o preço da regra de cada serviço, e sempre
 * combinado antes (texto do Vendas desde 17-11-2026, d66).
 */
export function extraNoLocal(servico: string | null | undefined, base: BaseDoPreco | null | undefined = "total"): string {
  // d63 (18-11-2026): por carga ou por hora, a regra da base (`frase-da-base.ts`) — nunca «o volume a mais».
  if (base === "hora") return AS_HORAS_CONTAM_SE_NO_DIA;
  if (base === "carga") return AS_CARGAS_CONFIRMAM_SE_NO_LOCAL;
  if (servico === "recolha_entulho") {
    return (
      `Se no dia houver mais entulho, combina-se consigo antes de carregar, por saco ` +
      `(${virgula(PRECO_POR_SACO.minimo)} a ${virgula(PRECO_POR_SACO.maximo)} € + IVA cada).`
    );
  }
  if (servico === "mudanca") {
    // O preço por hora é o do parceiro da lista (d7), não o da referência.
    return "Se no dia houver mais a levar, as horas a mais pagam-se ao preço por hora do parceiro, combinadas consigo antes.";
  }
  if (servico && servico.startsWith("esvaziamento")) {
    // A regra do esvaziamento é o espaço e o volume, não a peça (d20, e d47).
    return "Se no dia houver mais coisas, o volume a mais combina-se consigo antes de carregar.";
  }
  if (!servico || servico === "manutencao_casa" || servico === "outro") {
    return "Se houver mais a fazer, orça-se à parte e combina-se consigo antes.";
  }
  // A recolha de móveis e de monos: pela tabela das peças (d20; os monos desde a d47).
  return `O que aparecer a mais combina-se consigo antes de carregar, pela tabela (${TABELA_DAS_PECAS_CURTA}).`;
}

/** O extra tem preço? (A manutenção orça-se e o esvaziamento conta o volume: não têm tabela.) */
export function extraComPreco(texto: string): boolean {
  // Um número, ou o preço já dito (o mesmo por hora/carga, ou o preço por hora do parceiro).
  return /\d/.test(texto) || /mesmo preço|preço por hora|número de cargas|as horas contam-se/.test(texto);
}
