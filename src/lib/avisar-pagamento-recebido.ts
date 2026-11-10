import { avisarOClienteDoPedido } from "./avisos-ao-cliente";
import { avisarProfissionalClientePagouPorPush } from "./avisar-por-push";

/**
 * O PAGAMENTO ENTROU: O CLIENTE E O PARCEIRO FICAM A SABER — um aviso só, para
 * todas as portas por onde um pagamento do euPago se dá por pago.
 *
 * 10-11-2026 (d26). O aviso vivia dentro da rota do webhook. A conferência de
 * hora a hora (`/api/cron/conferir-pagamentos`), que apanha o que o webhook
 * não trouxe, dava o pagamento por pago e não dizia nada a ninguém: o cliente
 * tinha pago e o parceiro não sabia que podia avançar. Agora as duas chamam
 * isto.
 *
 * UMA VEZ POR PAGAMENTO, e quem o garante é a base: só se chama depois de
 * `darPorPago` devolver `feito`, e `darPorPago` só passa uma vez por linha
 * (`WHERE estado IN (ainda por pagar)`). Se a conferência chegar primeiro, o
 * webhook que vier depois já não encontra a linha por pagar e não avisa; e ao
 * contrário também.
 *
 * As regras são as que o webhook já tinha:
 *   · o cliente (S10) — só se o pagamento for dele, não a dívida do parceiro
 *     num pago em mão (04-11-2026, d9);
 *   · o parceiro (02-11-2026) — só quando é o cliente a pagar o trabalho.
 *
 * NUNCA LANÇA: o dinheiro já está registado, e um aviso que falhe não o desfaz.
 */
export async function avisarQueOPagamentoEntrou(p: {
  parte: string;
  pedidoId: number;
  negociacaoId: number;
  providerId: number;
}): Promise<void> {
  try {
    if (p.parte !== "divida") await avisarOClienteDoPedido(p.pedidoId, "pago", { negociacaoId: p.negociacaoId });
  } catch (e) {
    console.error("[pagamento recebido] o aviso ao cliente não saiu:", p.pedidoId, e);
  }
  try {
    if (p.parte === "trabalho" && !(await eDividaDoProfissional(p.negociacaoId))) {
      await avisarProfissionalClientePagouPorPush({
        providerId: p.providerId,
        pedidoId: p.pedidoId,
        negociacaoId: p.negociacaoId,
      });
    }
  } catch (e) {
    console.error("[pagamento recebido] o aviso ao parceiro não saiu:", p.pedidoId, e);
  }
}

/**
 * Em dinheiro com IVA incluído, o «pago» é a dívida do parceiro à CLYON, e não
 * o cliente a pagar: aí não se lhe diz «o cliente pagou». Na dúvida, não avisa.
 */
async function eDividaDoProfissional(negociacaoId: number): Promise<boolean> {
  try {
    const [{ getPool }, { temDividaDoProfissional }, { lerForma }, { modeloDaLinha }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/divida-do-profissional"),
      import("@/lib/forma-de-pagamento"),
      import("@/lib/sem-factura"),
    ]);
    const pool = await getPool();
    if (!pool) return true;
    const [linhas] = (await pool.execute(
      "SELECT formaDePagamento, semFactura, createdAt FROM negociacoes WHERE id = ? LIMIT 1",
      [negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const n = linhas[0];
    if (!n) return true;
    return temDividaDoProfissional(lerForma(n.formaDePagamento), modeloDaLinha(n as never, n.createdAt as Date));
  } catch {
    return true;
  }
}
