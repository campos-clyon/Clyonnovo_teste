import { contaDoValorAcordado, type ContaDoPagamentoDirecto, type RegimeDoProfissional } from "./pagamento-directo";

/**
 * AS MUDANÇAS PELA LISTA NO MODELO DE 15-11-2026 — d3 (CEO e dono, 18-11-2026).
 *
 * A folha da mudança, a lista de parceiros e o «Confirmo» faziam a conta antiga
 * (o total sem IVA × 1,23), enquanto a folha final e o valor final do trabalho
 * já faziam a do pagamento directo (`pagamento-directo.ts`: duas faturas, o IVA
 * por fatura, e nenhum IVA na do parceiro isento). Com um parceiro isento, 4 h a
 * 55 €/h e a taxa a 10 %, a folha dizia 270,60 € e o valor final 225,06 €.
 *
 * Aqui fica a ponte única: de uma conta da mudança (o que o cliente paga sem
 * IVA e o que fica ao parceiro sem IVA) para a conta do modelo de 15-11, pela
 * MESMA porta que o valor final usa depois de o cliente confirmar — o valor
 * acordado é o total sem IVA e a taxa do parceiro é a efectiva
 * (`dinheiroDaFolha`). Assim a folha, a folha final e o valor final dizem o
 * mesmo número, nos dois regimes. Nenhum preço nem taxa muda: só o IVA.
 *
 * Pura e sem base: o servidor, o painel, a Mesa, a app Pro e a app de cliente
 * importam isto.
 */

export type ModeloDaMudanca = { novoModelo: boolean; regime: RegimeDoProfissional };

/**
 * O modelo como viaja no `contexto` da folha (texto e números soltos). `null`
 * fora do modelo de 15-11. No modelo novo sem regime conhecido, conta como com
 * IVA (a regra de `perfil-fiscal.ts`: nunca um preço abaixo do que se paga).
 */
export function lerModeloDaMudanca(novoModelo: unknown, regime: unknown): ModeloDaMudanca | null {
  if (novoModelo !== true) return null;
  return { novoModelo: true, regime: regime === "isento" ? "isento" : "normal" };
}

/**
 * A taxa EFECTIVA de uma conta da mudança: a taxa das horas e dos km a dividir
 * pelo total sem IVA (o material não leva taxa). Oito casas — a coluna
 * `taxaProfissional` é DECIMAL(10,8). É a que a confirmação da folha grava.
 */
export function taxaEfectivaDaMudanca(semIvaCent: number, profissionalCent: number): number {
  return semIvaCent > 0 ? Math.round(((semIvaCent - profissionalCent) / semIvaCent) * 1e8) / 1e8 : 0;
}

/**
 * A conta do modelo de 15-11 de uma conta da mudança: a mesma do valor final
 * (`contaDoValorAcordado` sobre o valor sem IVA e a taxa efectiva, com a taxa
 * do cliente a zero). `null` quando o valor não serve.
 */
export function contaDaMudancaNoNovoModelo(
  c: { semIvaCent: number; profissionalCent: number },
  regime: RegimeDoProfissional,
): ContaDoPagamentoDirecto | null {
  if (!(c.semIvaCent > 0)) return null;
  return contaDoValorAcordado(c.semIvaCent / 100, { cliente: 0, profissional: taxaEfectivaDaMudanca(c.semIvaCent, c.profissionalCent) }, regime);
}

/**
 * O que o cliente paga, com e sem IVA, de uma conta da mudança: no modelo de
 * 15-11 a conta do pagamento directo; fora dele, o de sempre.
 */
export function aoClienteNoModelo(
  c: { semIvaCent: number; profissionalCent: number; totalCent: number },
  modelo: ModeloDaMudanca | null | undefined,
): { semIvaCent: number; comIvaCent: number } {
  if (modelo?.novoModelo) {
    const n = contaDaMudancaNoNovoModelo(c, modelo.regime);
    if (n) return { semIvaCent: c.semIvaCent, comIvaCent: n.totalAoClienteCent };
  }
  return { semIvaCent: c.semIvaCent, comIvaCent: c.totalCent };
}

/** «isento de IVA» — o que se diz de um valor de um parceiro isento, no lugar do «+ IVA». */
export const ISENTO_DE_IVA = "isento de IVA";
