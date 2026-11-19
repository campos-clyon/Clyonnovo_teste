import { mudaramDepoisDeContratar, titularBateComONome } from "./dados-de-pagamento-mudados";
import { ibanEncurtado } from "./iban";

/**
 * O DADO DE PAGAMENTO ENCURTADO, PARA O REGISTO — d5, 19-11-2026. Nunca o IBAN
 * inteiro: o IBAN com os 4 primeiros e os 4 últimos, o MB WAY com os 3
 * últimos, o titular só com as iniciais. `null` quando não há valor.
 */
export function dadoDePagamentoEncurtado(campo: string, v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return null;
  if (campo === "iban") return ibanEncurtado(t) || "····";
  if (campo === "mbway") return `···${t.slice(-3)}`;
  return t
    .split(/\s+/)
    .map((p) => `${p[0] ?? ""}.`)
    .join(" ");
}

/**
 * OS DADOS DE PAGAMENTO DO PARCEIRO POR CONFIRMAR — d5, 19-11-2026.
 *
 * Até aqui, quando o IBAN, o titular ou o MB WAY mudavam depois de o cliente
 * contratar (d28), o cliente via os dados NOVOS com um aviso. Quem entrasse na
 * conta de um parceiro desviava o pagamento de um cliente que não lesse o
 * aviso. Agora, nesses casos — e quando o titular do IBAN não bate com o nome
 * do parceiro nem do responsável da empresa — o cliente não recebe o IBAN nem
 * o MB WAY: lê `DADOS_DE_PAGAMENTO_A_CONFIRMAR` até o administrador confirmar
 * por telefone com o parceiro («Confirmei com o parceiro», na Mesa). Pagar em
 * dinheiro no local continua possível.
 *
 * A confirmação é por negociação e vale para os dados como estavam: se mudarem
 * outra vez depois dela, volta a ficar por confirmar.
 *
 * Pura: a base vive em `dados-de-pagamento-por-confirmar-na-base.ts`.
 */

export const DADOS_DE_PAGAMENTO_A_CONFIRMAR =
  "A CLYON está a confirmar os dados de pagamento do parceiro; avisamo-lo aqui.";

/** O selo da Mesa quando o titular não bate (o dos dados mudados é `SELO_DOS_DADOS_MUDADOS`). */
export const SELO_DO_TITULAR_QUE_NAO_BATE = "titular do IBAN não bate";

/** O botão da Mesa, só do administrador. */
export const CONFIRMEI_COM_O_PARCEIRO = "Confirmei com o parceiro";

export type PorqueEstaoPorConfirmar = "mudaram" | "titular";

export type LinhaDosDadosDePagamento = {
  ibanMudadoEm?: unknown;
  contratadaEm?: unknown;
  createdAt?: unknown;
  dadosPagamentoConfirmadosEm?: unknown;
  iban?: unknown;
  ibanTitular?: unknown;
  name?: unknown;
  responsavel?: unknown;
};

const comoData = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const texto = (v: unknown) => (typeof v === "string" ? v : null);

/**
 * A confirmação do administrador ainda vale? Só se foi feita depois da última
 * mudança dos dados (ou se nunca houve data de mudança).
 */
export function confirmacaoAindaVale(confirmadosEm: unknown, ibanMudadoEm: unknown): boolean {
  const c = comoData(confirmadosEm);
  if (!c) return false;
  const m = comoData(ibanMudadoEm);
  return !m || c.getTime() >= m.getTime();
}

/**
 * Porque é que o cliente não vê os dados de pagamento desta negociação — ou
 * `null` quando os pode ver. Os dados mudados depois de contratar ganham ao
 * titular (é o mais grave). O titular só conta quando há IBAN: o MB WAY não tem
 * titular, e um parceiro só com MB WAY não fica preso por isso.
 */
export function porqueOsDadosEstaoPorConfirmar(l: LinhaDosDadosDePagamento): PorqueEstaoPorConfirmar | null {
  if (confirmacaoAindaVale(l.dadosPagamentoConfirmadosEm, l.ibanMudadoEm)) return null;
  if (mudaramDepoisDeContratar(l.ibanMudadoEm, l.contratadaEm, l.createdAt)) return "mudaram";
  const iban = (texto(l.iban) ?? "").trim();
  if (iban !== "" && titularBateComONome(texto(l.ibanTitular), texto(l.name), texto(l.responsavel)) === false) {
    return "titular";
  }
  return null;
}

/** Os dados que o cliente recebe: sem IBAN, titular nem MB WAY quando estão por confirmar. */
export function dadosQueOClienteRecebe<T extends { iban: string | null; titular: string | null; mbway: string | null }>(
  paraPagar: T | null | undefined,
  porConfirmar: boolean,
): T | null {
  if (!paraPagar) return null;
  return porConfirmar ? { ...paraPagar, iban: null, titular: null, mbway: null } : paraPagar;
}
