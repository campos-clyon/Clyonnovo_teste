/**
 * O QUE SE CONFERE ANTES DE DAR UM PAGAMENTO POR PAGO — 27-10-2026 (d16).
 *
 * Puro, sem base nem rede: quem chama (o webhook, a consulta à mão e a rotina
 * de hora a hora) lê as linhas e pergunta aqui. Três regras, as três do lado
 * seguro — na dúvida, não se fecha o pedido e fica à vista de quem gere:
 *
 *   · `pagamentoForaDeVigor` — uma referência antiga, de um valor que já não é
 *     o que se pede, não fecha o pedido: fica para devolver;
 *   · `consultaDaPago` — a consulta ao euPago só dá por pago com o valor dito
 *     e a bater; sem valor, fica por confirmar;
 *   · `fechaPorCaducar` — uma Multibanco que passou o prazo (com folga) e que
 *     o euPago diz não estar paga fecha-se como expirada.
 */

/** Um cêntimo de folga: o valor viaja em vírgula flutuante. */
const CENTIMO = 0.011;

type Linha = { id: number; valor: number; estado: string; metodo: string };

/** Só as referências do euPago contam para saber o que se pede agora. */
const DO_EUPAGO = new Set(["mbway", "multibanco"]);

/**
 * O PAGAMENTO QUE ESTÁ EM VIGOR — a referência mais recente do trabalho que
 * chegou a existir (as `falhado` nunca existiram do lado do euPago).
 */
export function pagamentoEmVigor<T extends Linha>(todos: T[]): T | null {
  let melhor: T | null = null;
  for (const l of todos) {
    if (!DO_EUPAGO.has(l.metodo) || l.estado === "falhado") continue;
    if (!melhor || l.id > melhor.id) melhor = l;
  }
  return melhor;
}

/**
 * `null` quando este pagamento pode fechar o pedido; senão, o porquê.
 *
 * Uma referência antiga paga DEPOIS de se ter gerado outra de valor diferente
 * não é o pagamento do trabalho: é dinheiro do cliente que se devolve. O
 * pedido continua por pagar pelo valor que se pede hoje.
 */
export function pagamentoForaDeVigor(pago: Linha, todos: Linha[]): string | null {
  const vigor = pagamentoEmVigor(todos);
  if (!vigor || vigor.id === pago.id) return null;
  if (Math.abs(vigor.valor - pago.valor) <= CENTIMO) return null;
  return (
    `Paga uma referência anterior de ${pago.valor.toFixed(2)} € depois de gerada outra de ` +
    `${vigor.valor.toFixed(2)} €. O pedido não fecha por este pagamento — valor a devolver ao cliente.`
  );
}

export type DecisaoDaConsulta =
  | { aplicar: true; valor: number }
  | { aplicar: false; porConfirmar: boolean; porque: string };

/**
 * A CONSULTA AO euPAGO SÓ DÁ POR PAGO COM O VALOR A BATER.
 *
 * Antes (até 27-10-2026) uma resposta «paga» sem valor creditava o valor que
 * nós tínhamos pedido. Agora fica por confirmar, à vista: quem olha vê o
 * comprovativo e decide.
 */
export function consultaDaPago(
  r: { pago: boolean; valor: number | null },
  esperado: number,
): DecisaoDaConsulta {
  if (!r.pago) return { aplicar: false, porConfirmar: false, porque: "O euPago não diz que está paga." };
  if (r.valor == null) {
    return {
      aplicar: false,
      porConfirmar: true,
      porque: "O euPago diz que está paga mas não diz o valor — por confirmar.",
    };
  }
  if (Math.abs(r.valor - esperado) > CENTIMO) {
    return {
      aplicar: false,
      porConfirmar: true,
      porque: `O euPago diz ${r.valor.toFixed(2)} € e o pedido era de ${esperado.toFixed(2)} €.`,
    };
  }
  return { aplicar: true, valor: r.valor };
}

/** Dias de folga depois do prazo da referência, antes de a dar por caducada. */
export const DIAS_DE_FOLGA_DEPOIS_DO_PRAZO = 2;

/** Uma Multibanco que passou o prazo, com folga, e não está paga, fecha-se. */
export function fechaPorCaducar(
  p: { metodo: string; expiraEm: Date | string | null },
  agora: number = Date.now(),
): boolean {
  if (p.metodo !== "multibanco" || !p.expiraEm) return false;
  const fim = new Date(p.expiraEm).getTime();
  if (!Number.isFinite(fim)) return false;
  return fim + DIAS_DE_FOLGA_DEPOIS_DO_PRAZO * 86_400_000 < agora;
}
