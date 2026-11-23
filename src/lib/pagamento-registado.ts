import { COMO_PAGAR_EM_PALAVRAS, comoPagarValido, type ComoPagarAoParceiro } from "./pagar-ao-parceiro";
import { diaMesEmLisboa } from "./hora-de-lisboa";

/**
 * O PAGAMENTO AO PARCEIRO FICA REGISTADO — d3 (CEO e dono, 23-11-2026).
 *
 * No modelo de 15-11 o cliente paga diretamente ao parceiro e a CLYON não toca
 * no dinheiro; mas tem de saber, e o cliente e o parceiro têm de ver o mesmo.
 * O registo é de duas vozes, sem recibo da CLYON:
 *
 *   · o cliente diz «Já paguei a {parceiro}» (com o total e a forma), e/ou
 *   · o parceiro diz «Sim, recebi» — ou marca ele primeiro «O cliente já me pagou».
 *
 * O «Pago» é só do parceiro (`parceiroConfirmouEm`). Com «Ainda não recebi»
 * (`parceiroNegouEm`) fica «Pagamento em dúvida» na Mesa. O dinheiro no local só
 * conta com o «Recebi». Nada disto muda a taxa nem a dívida do parceiro à CLYON.
 *
 * PURO: as colunas estão em `pagamento-registado-na-base.ts`; a app Pro e a app de
 * cliente importam este ficheiro e dizem as mesmas frases.
 */

export type EstadoDoRegisto = "por_pagar" | "cliente_disse" | "pago" | "em_duvida";

/** As colunas de `negociacoes` que dizem o registo (datas em UTC, como a base as lê). */
export type LinhaDoRegisto = {
  clienteDisseQuePagouEm?: unknown;
  formaDita?: unknown;
  parceiroConfirmouEm?: unknown;
  parceiroNegouEm?: unknown;
};

function instante(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v).includes("T") || String(v).endsWith("Z") ? String(v) : String(v).replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Onde está o registo. «Pago» ganha a tudo. «Em dúvida» é um «Ainda não recebi»
 * mais recente do que o «Já paguei» do cliente (se ele voltar a dizer que pagou,
 * volta a «o cliente disse»).
 */
export function estadoDoRegisto(l: LinhaDoRegisto): EstadoDoRegisto {
  if (instante(l.parceiroConfirmouEm)) return "pago";
  const negou = instante(l.parceiroNegouEm);
  const disse = instante(l.clienteDisseQuePagouEm);
  if (negou && (!disse || negou.getTime() >= disse.getTime())) return "em_duvida";
  if (disse) return "cliente_disse";
  return "por_pagar";
}

/** Só uma forma que o bloco «Pagar a …» conhece; o resto não se grava. */
export function lerFormaDita(v: unknown): ComoPagarAoParceiro | null {
  return comoPagarValido(v) ? v : null;
}

const emEuros = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2).replace(".", ",")} €`;

/** «transferência», «MB WAY» ou «dinheiro no local» — em minúsculas, para dentro de uma frase. */
export function formaPorExtenso(f: ComoPagarAoParceiro | null | undefined): string {
  if (f === "transferencia") return "transferência";
  if (f === "mbway") return "MB WAY";
  if (f === "dinheiro") return "dinheiro no local";
  return "";
}

/** O cliente confirma antes de gravar: o total e a forma, ditos. */
export function confirmacaoDoJaPaguei(parceiro: string, total: number | null, forma: ComoPagarAoParceiro): string {
  return `Confirma que pagou ${total != null ? `${emEuros(total)} ` : ""}a ${parceiro} por ${formaPorExtenso(forma)}?`;
}

/** O botão do cliente. */
export const JA_PAGUEI_BOTAO = (parceiro: string) => `Já paguei a ${parceiro}`;

/** A pergunta que o parceiro lê (app Pro, painel, push e email). */
export function perguntaAoParceiro(total: number | null, forma: ComoPagarAoParceiro | null): string {
  return `O cliente diz que lhe pagou ${total != null ? `${emEuros(total)} ` : ""}${forma ? `por ${formaPorExtenso(forma)}` : ""}`.trim() + ". Recebeu?";
}

export const SIM_RECEBI = "Sim, recebi";
export const AINDA_NAO_RECEBI = "Ainda não recebi";
export const O_CLIENTE_JA_ME_PAGOU = "O cliente já me pagou";

/** O selo da Mesa quando o parceiro diz que ainda não recebeu. */
export const SELO_PAGAMENTO_EM_DUVIDA = "Pagamento em dúvida";

/** «Pago a Fulano · 23/11» — o que o cliente e o parceiro leem depois do «Recebi». */
export function pagoA(parceiro: string, quando: unknown): string {
  const d = instante(quando);
  return d ? `Pago a ${parceiro} · ${diaMesEmLisboa(d)}` : `Pago a ${parceiro}`;
}

/** Pedido concluído sem registo: os dados de pagamento saem e fica isto. */
export function pagamentoCombinadoDiretamente(parceiro: string): string {
  return `Pagamento combinado diretamente com ${parceiro}`;
}

/** O que o cliente lê enquanto o parceiro não responde. */
export const A_ESPERA_DO_PARCEIRO = (parceiro: string) => `Disse que pagou a ${parceiro}. Estamos à espera de que ele confirme que recebeu.`;
/** O que o cliente lê quando o parceiro diz «Ainda não recebi». */
export const PARCEIRO_AINDA_NAO_RECEBEU = (parceiro: string) =>
  `${parceiro} diz que ainda não recebeu. Confirme os dados e a forma de pagamento; se já pagou, fale connosco.`;

/**
 * O registo visto de fora (cliente ou parceiro), numa forma só — as duas apps e
 * o site desenham-no como vem. `concluidoSemRegisto`: o pedido está concluído
 * (d76) e ninguém registou: os dados de pagamento saem do ecrã.
 */
export type RegistoDoPagamento = {
  estado: EstadoDoRegisto;
  /** O «Pago» — só o «Recebi» do parceiro. */
  pago: boolean;
  forma: ComoPagarAoParceiro | null;
  clienteDisseEm: string | null;
  parceiroConfirmouEm: string | null;
  parceiroNegouEm: string | null;
  concluidoSemRegisto: boolean;
};

const iso = (v: unknown) => instante(v)?.toISOString() ?? null;

export function registoDoPagamento(l: LinhaDoRegisto, concluido = false): RegistoDoPagamento {
  const estado = estadoDoRegisto(l);
  return {
    estado,
    pago: estado === "pago",
    forma: lerFormaDita(l.formaDita),
    clienteDisseEm: iso(l.clienteDisseQuePagouEm),
    parceiroConfirmouEm: iso(l.parceiroConfirmouEm),
    parceiroNegouEm: iso(l.parceiroNegouEm),
    concluidoSemRegisto: concluido && estado !== "pago",
  };
}

/** Os dados de pagamento (IBAN e MB WAY) saem do ecrã com o «Pago» ou com o pedido concluído. */
export function dadosDePagamentoSaem(r: Pick<RegistoDoPagamento, "pago" | "concluidoSemRegisto">): boolean {
  return r.pago || r.concluidoSemRegisto;
}

export { COMO_PAGAR_EM_PALAVRAS };
