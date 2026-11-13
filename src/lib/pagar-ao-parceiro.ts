import { MAXIMO_EM_NUMERARIO } from "./forma-de-pagamento";

/**
 * COMO O CLIENTE PAGA AO PARCEIRO — d10, desde 15-11-2026 (dono, 12-11-2026).
 *
 * No modelo novo o cliente paga o trabalho diretamente ao parceiro que contratou
 * e escolhe como: transferência para o IBAN dele, MB WAY para o número dele, ou
 * dinheiro no local. A referência Multibanco não é uma destas: serve só ao
 * parceiro para passar à CLYON a taxa da plataforma.
 *
 * Grava-se em `negociacoes.pagarAoParceiroPor` (coluna nova, nula = ainda não
 * escolheu). O dinheiro tem o tecto legal de sempre (`MAXIMO_EM_NUMERARIO`).
 *
 * Puro: o cliente e o parceiro lêem isto.
 */

export type ComoPagarAoParceiro = "transferencia" | "mbway" | "dinheiro";

export const COMO_PAGAR_AO_PARCEIRO: ComoPagarAoParceiro[] = ["transferencia", "mbway", "dinheiro"];

export function comoPagarValido(v: unknown): v is ComoPagarAoParceiro {
  return typeof v === "string" && (COMO_PAGAR_AO_PARCEIRO as string[]).includes(v);
}

/** O que vier (base, corpo, ecrã) → uma forma, ou `null` (ainda não escolheu). */
export function lerComoPagar(v: unknown): ComoPagarAoParceiro | null {
  return comoPagarValido(v) ? v : null;
}

export const COMO_PAGAR_EM_PALAVRAS: Record<ComoPagarAoParceiro, { curta: string; cliente: string; parceiro: string }> = {
  transferencia: {
    curta: "Transferência bancária",
    cliente: "Paga por transferência para o IBAN do parceiro, que aparece no pedido depois de o contratar.",
    parceiro: "O cliente paga-lhe por transferência para o seu IBAN.",
  },
  mbway: {
    curta: "MB WAY",
    cliente: "Paga por MB WAY para o número do parceiro, que aparece no pedido depois de o contratar.",
    parceiro: "O cliente paga-lhe por MB WAY para o seu número.",
  },
  dinheiro: {
    curta: "Dinheiro no local",
    cliente: "Paga ao parceiro em dinheiro, no local.",
    parceiro: "O cliente paga-lhe em dinheiro, no local.",
  },
};

/** Os dados que o parceiro tem para receber — só se lê se estão preenchidos. */
export type DadosDoParceiroParaPagar = { iban?: string | null; mbway?: string | null } | null | undefined;

/**
 * As que se oferecem ao cliente para este total (com IVA): sem dinheiro a partir
 * do tecto legal; e, com os dados do parceiro (d17, 13-11-2026), só as que ele
 * pode receber — sem IBAN não há «Transferência», sem número não há «MB WAY».
 * Sem os dados (`undefined`), não se filtra por eles.
 */
export function comoPagarDisponiveis(
  totalComIva: number | null | undefined,
  dados?: DadosDoParceiroParaPagar,
): ComoPagarAoParceiro[] {
  const tem = (v: unknown) => typeof v === "string" && v.trim() !== "";
  return COMO_PAGAR_AO_PARCEIRO.filter((c) => {
    if (c === "dinheiro") return !(typeof totalComIva === "number" && totalComIva >= MAXIMO_EM_NUMERARIO);
    if (dados === undefined) return true;
    if (c === "transferencia") return tem(dados?.iban);
    return tem(dados?.mbway);
  });
}

/**
 * O PARCEIRO AINDA SEM IBAN NEM MB WAY — d17 (texto F das Vendas, 13-11-2026).
 * Possível na transição de 15 a 22-11: o cliente vê isto no bloco «Pagar a …».
 */
export const PARCEIRO_SEM_DADOS_PARA_PAGAR =
  "O parceiro ainda não pôs os dados para transferência ou MB WAY. Pode pagar-lhe em dinheiro no local, ou esperar: avisamo-lo aqui assim que os dados estiverem no pedido.";

/** A frase que o cliente lê sobre o pagamento, no modelo novo. */
export const PAGA_DIRETAMENTE_AO_PARCEIRO =
  "Paga diretamente ao parceiro que contratar — por transferência, MB WAY ou dinheiro no local. O preço já inclui a taxa da plataforma e o IVA.";

/** As duas faturas de cada trabalho, ditas ao cliente. */
export const AS_DUAS_FATURAS =
  "Recebe duas faturas, as duas juntas ao pedido: a do trabalho, emitida pelo parceiro, e a da taxa da plataforma.";

/**
 * SÓ PARA OS DADOS DO PEDIDO — d16 (13-11-2026, texto A das Vendas). No modelo
 * novo o cliente transfere para o IBAN de quem contratou: diz-se onde estão os
 * dados e que não se paga para outros. Sem «quando» se paga — o momento ainda
 * não está confirmado.
 */
export const SO_PARA_OS_DADOS_DO_PEDIDO =
  "Os dados para pagar aparecem no seu pedido depois de contratar o parceiro: pague só para esses. Se alguém lhe pedir que pague para outros dados, não pague e fale connosco.";
