import { ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";

/**
 * OS PEDIDOS COM VALOR ÚNICO POR DECIDIR — 15-11-2026 (d39, a parte da
 * Vitória). Dos pedidos dados (os deste número), os que têm o valor único
 * enviado (`valorUnicoCliente`), estão abertos e ainda não têm parceiro
 * escolhido (nenhuma negociação «acordada»). Na dúvida — a base a falhar —
 * devolve vazio, e a conversa segue como antes.
 */
export async function pedidosComValorUnicoPorDecidir(pedidos: readonly number[]): Promise<number[]> {
  const ids = pedidos.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return [];
  try {
    await ensureSimulatorOrdersTable();
    await ensureNegociacoesTable();
    const pool = await getPool();
    if (!pool) return [];
    const [rows] = (await pool.execute(
      `SELECT o.id FROM simulatorOrders o
        WHERE o.id IN (${ids.map(() => "?").join(",")})
          AND o.valorUnicoCliente IS NOT NULL
          AND o.valorFixoClyon IS NULL
          AND (o.status IS NULL OR o.status NOT IN ('cancelado', 'rejeitado', 'arquivado', 'concluido'))
          AND NOT EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id AND n.estado = 'acordada')
        ORDER BY o.id DESC`,
      ids,
    )) as [Array<{ id: number }>, unknown];
    return rows.map((r) => Number(r.id));
  } catch (e) {
    console.error("[pedidosComValorUnicoPorDecidir]", e instanceof Error ? e.message : e);
    return [];
  }
}

/*
 * O VALOR ÚNICO ACEITE — 15-11-2026 (d39). O cliente disse que sim (a Vitória
 * leu o «SIM, aceito» no WhatsApp, ou a equipa marcou-o: aceitou por
 * telefone). Fica no pedido com estado próprio — `valorUnicoAceiteEm` e quem
 * o registou — para a Mesa mostrar «Valor único aceite pelo cliente —
 * escolher o parceiro». Colunas novas, só a acrescentar, criadas aqui.
 *
 * Um aceite só vale para o valor que estava enviado: se o valor único voltar
 * a ser enviado depois (`valorUnicoEm` mais recente), o aceite antigo deixa de
 * contar e um novo «sim» volta a gravar.
 */

let colunasDoAceite = false;

export async function ensureColunasDoAceite(): Promise<void> {
  if (colunasDoAceite) return;
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return;
  for (const sql of [
    "ALTER TABLE simulatorOrders ADD COLUMN valorUnicoAceiteEm DATETIME NULL DEFAULT NULL",
    "ALTER TABLE simulatorOrders ADD COLUMN valorUnicoAceitePor VARCHAR(120) NULL DEFAULT NULL",
  ]) {
    try {
      await pool.execute(sql);
    } catch (e) {
      // Já existe: é o caso de todos os arranques menos o primeiro.
      if (!/Duplicate column/i.test(e instanceof Error ? e.message : String(e))) throw e;
    }
  }
  colunasDoAceite = true;
}

/**
 * Marca o valor único como aceite. Só num pedido com valor único enviado e
 * sem aceite que valha para ele. Devolve se gravou.
 */
export async function marcarValorUnicoAceite(pedidoId: number, por: string): Promise<boolean> {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return false;
  await ensureColunasDoAceite();
  const pool = await getPool();
  if (!pool) return false;
  const [r] = (await pool.execute(
    `UPDATE simulatorOrders
        SET valorUnicoAceiteEm = NOW(), valorUnicoAceitePor = ?, updatedAt = updatedAt
      WHERE id = ? AND valorUnicoCliente IS NOT NULL
        AND (valorUnicoAceiteEm IS NULL OR (valorUnicoEm IS NOT NULL AND valorUnicoAceiteEm < valorUnicoEm))`,
    [por.slice(0, 120), pedidoId],
  )) as unknown as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}

export type AceiteDoValorUnico = { em: string; por: string | null };

/** Os aceites que valem (posteriores ao último envio do valor único), por pedido. Na dúvida, vazio. */
export async function aceitesDoValorUnico(pedidos: readonly number[]): Promise<Map<number, AceiteDoValorUnico>> {
  const mapa = new Map<number, AceiteDoValorUnico>();
  const ids = [...new Set(pedidos.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return mapa;
  try {
    await ensureColunasDoAceite();
    const pool = await getPool();
    if (!pool) return mapa;
    const [rows] = (await pool.execute(
      `SELECT id, valorUnicoAceiteEm, valorUnicoAceitePor FROM simulatorOrders
        WHERE id IN (${ids.map(() => "?").join(",")})
          AND valorUnicoCliente IS NOT NULL AND valorUnicoAceiteEm IS NOT NULL
          AND (valorUnicoEm IS NULL OR valorUnicoAceiteEm >= valorUnicoEm)`,
      ids,
    )) as unknown as [Array<{ id: number; valorUnicoAceiteEm: Date | string; valorUnicoAceitePor: string | null }>, unknown];
    for (const r of rows) {
      const em = instanteDaBase(r.valorUnicoAceiteEm)?.toISOString();
      if (em) mapa.set(Number(r.id), { em, por: r.valorUnicoAceitePor ?? null });
    }
  } catch (e) {
    console.error("[aceitesDoValorUnico]", e instanceof Error ? e.message : e);
  }
  return mapa;
}
