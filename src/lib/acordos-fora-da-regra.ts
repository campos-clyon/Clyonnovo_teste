import { PRECOS, RECOLHA_MINIMA_DOS_MOVEIS } from "./precos-publicos";
import { aPassarAClyonDaConta, type ContaDoPagamento } from "./conta-do-pagamento";

/**
 * ACORDOS FORA DA REGRA PEDEM MOTIVO — d6 (CEO e dono, 22-11-2026). Não muda
 * nenhum preço nem taxa: só obriga a dizer porquê, e avisa onde o dinheiro
 * seria difícil de devolver.
 *
 *   (1) Um acordo abaixo do preço mínimo do serviço — a recolha de móveis e de
 *       monos 60 € + IVA, a mudança 3 horas à referência — pede ao
 *       administrador um motivo escrito, que fica no histórico do pedido. O #651
 *       fechou a 25 € sem IVA, e a mudança #630 a 60 €.
 *   (2) No valor único, quando a parte da CLYON (taxa e reserva, com o IVA
 *       dela) passa de metade do que o cliente pagou ao parceiro, o backoffice
 *       avisa e propõe «O cliente paga à CLYON» (d82), em vez de deixar o
 *       parceiro devolver o dinheiro: no #648 o parceiro recebe 174,09 € e tem
 *       de devolver 102,09 € (59 %).
 *
 * Puro; as rotas e o ecrã chamam-no.
 */

/** O preço mínimo do serviço, sem IVA, ou nulo onde não há mínimo público que valha como regra. */
export function minimoDoServico(servico: unknown): number | null {
  const s = String(servico ?? "");
  if (s === "recolha_moveis" || s === "recolha_monos") return RECOLHA_MINIMA_DOS_MOVEIS;
  if (s === "mudanca") return PRECOS.mudanca?.minimo ?? null;
  return null;
}

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** A recusa que pede o motivo: com o preço mínimo à vista. */
export function fraseDoAcordoAbaixoDoMinimo(servico: unknown, valor: number): string | null {
  const min = minimoDoServico(servico);
  if (min == null || !(valor < min)) return null;
  return `Este acordo (${euros(valor)} sem IVA) está abaixo do preço mínimo do serviço (${euros(min)} + IVA). Escreva o motivo — fica no pedido.`;
}

/** Um acordo abaixo do mínimo só se grava com um motivo escrito (3 caracteres, como nos outros). */
export function acordoPedeMotivo(servico: unknown, valor: number, motivo: unknown): { pede: false } | { pede: true; erro: string } {
  const erro = fraseDoAcordoAbaixoDoMinimo(servico, valor);
  if (!erro) return { pede: false };
  const m = typeof motivo === "string" ? motivo.trim() : "";
  return m.length >= 3 ? { pede: false } : { pede: true, erro };
}

/** Metade do que o cliente pagou: acima dela, o parceiro teria de devolver mais do que fica com ele. */
export const LIMITE_DA_PARTE_DA_CLYON = 0.5;

export type AvisoDaReserva = { aPassar: number; total: number; percentagem: number; texto: string };

/**
 * A conta do modelo de 15-11 com reserva (valor único): a parte da CLYON (o que
 * o parceiro lhe passa) passa de metade do que o cliente lhe pagou? Sem reserva,
 * ou fora do modelo novo, nada a avisar.
 */
export function avisoDaReserva(conta: ContaDoPagamento | null | undefined): AvisoDaReserva | null {
  if (!conta?.novoModelo) return null;
  const comReserva = conta.taxas.some((t) => /reserva/i.test(t.rotulo) && t.valor > 0);
  if (!comReserva) return null;
  const aPassar = aPassarAClyonDaConta(conta);
  if (aPassar == null || !(conta.total > 0) || !(aPassar > conta.total * LIMITE_DA_PARTE_DA_CLYON)) return null;
  const percentagem = Math.round((aPassar / conta.total) * 100);
  return {
    aPassar,
    total: conta.total,
    percentagem,
    texto:
      `A parte da CLYON (${euros(aPassar)}) é ${percentagem} % do que o cliente paga ao parceiro (${euros(conta.total)}): ` +
      `o parceiro teria de devolver mais de metade. Proponha «O cliente paga à CLYON» (abaixo), em vez de lhe pedir a devolução.`,
  };
}
