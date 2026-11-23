import { ensureNegociacoesTable, getPool } from "./db";
import { lerFormaDita, type LinhaDoRegisto } from "./pagamento-registado";
import type { ComoPagarAoParceiro } from "./pagar-ao-parceiro";

/**
 * O REGISTO DO PAGAMENTO AO PARCEIRO, NA BASE — d3 (23-11-2026). As regras e as
 * frases estão em `pagamento-registado.ts`; aqui só se lê e se grava.
 *
 * Cada escrita é UM `UPDATE` com as guardas no `WHERE` (d27): só uma negociação
 * contratada (`acordada`), de um pedido que não está cancelado nem arquivado, e
 * sem «Recebi» já dado. O MySQL diz quantas linhas mudou; zero = não era o
 * momento (outro toque, outra aba, o pedido já fechado). As datas são UTC.
 */

const PEDIDO_ABERTO =
  "pedidoId IN (SELECT id FROM simulatorOrders WHERE status NOT IN ('cancelado','arquivado'))";

export type RegistoNaBase = LinhaDoRegisto & { estado: string; providerId: number; pedidoId: number };

/** As quatro colunas, por negociação (para a Mesa, as apps e o site). Ausentes ficam de fora. */
export async function registosDoPagamento(ids: ReadonlyArray<number>): Promise<Map<number, RegistoNaBase>> {
  const saida = new Map<number, RegistoNaBase>();
  const validos = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (validos.length === 0) return saida;
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return saida;
  const [linhas] = (await pool.execute(
    `SELECT id, pedidoId, providerId, estado, clienteDisseQuePagouEm, formaDita, parceiroConfirmouEm, parceiroNegouEm
       FROM negociacoes WHERE id IN (${validos.map(() => "?").join(",")})`,
    validos,
  )) as unknown as [Array<Record<string, unknown>>, unknown];
  for (const l of Array.isArray(linhas) ? linhas : []) {
    saida.set(Number(l.id), {
      pedidoId: Number(l.pedidoId),
      providerId: Number(l.providerId),
      estado: String(l.estado),
      clienteDisseQuePagouEm: l.clienteDisseQuePagouEm,
      formaDita: l.formaDita,
      parceiroConfirmouEm: l.parceiroConfirmouEm,
      parceiroNegouEm: l.parceiroNegouEm,
    });
  }
  return saida;
}

export async function registoDoPagamentoDe(negociacaoId: number): Promise<RegistoNaBase | null> {
  return (await registosDoPagamento([negociacaoId])).get(negociacaoId) ?? null;
}

async function mudou(sql: string, params: unknown[]): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(sql, params as never[])) as unknown as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}

/** O cliente diz «Já paguei». Volta a abrir a pergunta se o parceiro tinha dito «Ainda não recebi». */
export async function gravarJaPaguei(negociacaoId: number, forma: ComoPagarAoParceiro): Promise<boolean> {
  const f = lerFormaDita(forma);
  if (!f) return false;
  return mudou(
    `UPDATE negociacoes
        SET clienteDisseQuePagouEm = UTC_TIMESTAMP(), formaDita = ?, parceiroNegouEm = NULL
      WHERE id = ? AND estado = 'acordada' AND parceiroConfirmouEm IS NULL AND ${PEDIDO_ABERTO}`,
    [f, negociacaoId],
  );
}

/**
 * O parceiro diz «Sim, recebi» (ou marca ele primeiro «O cliente já me pagou»).
 * `providerId` é o dele quando vem da conta; `null` quando é a equipa (nunca é).
 */
export async function gravarRecebi(negociacaoId: number, providerId: number): Promise<boolean> {
  return mudou(
    `UPDATE negociacoes
        SET parceiroConfirmouEm = UTC_TIMESTAMP(), parceiroNegouEm = NULL
      WHERE id = ? AND providerId = ? AND estado = 'acordada' AND parceiroConfirmouEm IS NULL AND ${PEDIDO_ABERTO}`,
    [negociacaoId, providerId],
  );
}

/** O parceiro diz «Ainda não recebi» — só depois de o cliente dizer que pagou. */
export async function gravarAindaNaoRecebi(negociacaoId: number, providerId: number): Promise<boolean> {
  return mudou(
    `UPDATE negociacoes
        SET parceiroNegouEm = UTC_TIMESTAMP()
      WHERE id = ? AND providerId = ? AND estado = 'acordada' AND parceiroConfirmouEm IS NULL
        AND clienteDisseQuePagouEm IS NOT NULL AND ${PEDIDO_ABERTO}`,
    [negociacaoId, providerId],
  );
}

/** As negociações com «Ainda não recebi» por resolver — o selo «Pagamento em dúvida» da Mesa. */
export async function negociacoesComPagamentoEmDuvida(ids: ReadonlyArray<number>): Promise<Set<number>> {
  const mapa = await registosDoPagamento(ids);
  const { estadoDoRegisto } = await import("./pagamento-registado");
  const saida = new Set<number>();
  for (const [id, l] of mapa) if (l.estado === "acordada" && estadoDoRegisto(l) === "em_duvida") saida.add(id);
  return saida;
}
