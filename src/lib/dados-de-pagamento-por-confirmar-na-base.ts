import { getPool, ensureNegociacoesTable, ensureProvidersSchema } from "./db";
import { porqueOsDadosEstaoPorConfirmar, type PorqueEstaoPorConfirmar } from "./dados-de-pagamento-por-confirmar";

/**
 * AS CONTRATADAS COM OS DADOS DE PAGAMENTO POR CONFIRMAR — d5, 19-11-2026. A
 * regra é `porqueOsDadosEstaoPorConfirmar`; aqui só se lê, numa consulta. Para
 * o bloco «Pagar a …» (um id) e para a Mesa (vários). Sem ids, vazio.
 */
export async function negociacoesComDadosPorConfirmar(
  ids: ReadonlyArray<number>,
): Promise<Map<number, PorqueEstaoPorConfirmar>> {
  const saida = new Map<number, PorqueEstaoPorConfirmar>();
  const validos = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (validos.length === 0) return saida;
  await ensureProvidersSchema();
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return saida;
  const [linhas] = (await pool.execute(
    `SELECT n.id, n.contratadaEm, n.createdAt, n.dadosPagamentoConfirmadosEm,
            p.ibanMudadoEm, p.iban, p.ibanTitular, p.name, p.responsavel
       FROM negociacoes n JOIN providers p ON p.id = n.providerId
      WHERE n.id IN (${validos.map(() => "?").join(",")}) AND n.estado = 'acordada'`,
    validos,
  )) as unknown as [Array<Record<string, unknown>>, unknown];
  for (const l of Array.isArray(linhas) ? linhas : []) {
    const porque = porqueOsDadosEstaoPorConfirmar(l);
    if (porque) saida.set(Number(l.id), porque);
  }
  return saida;
}

/**
 * O administrador confirmou por telefone com o parceiro. Grava a data e quem,
 * só numa negociação contratada. Devolve se gravou.
 */
export async function confirmarDadosDePagamento(negociacaoId: number, porQuem: string): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    `UPDATE negociacoes SET dadosPagamentoConfirmadosEm = UTC_TIMESTAMP(), dadosPagamentoConfirmadosPor = ?
      WHERE id = ? AND estado = 'acordada'`,
    [porQuem.slice(0, 120), negociacaoId],
  )) as unknown as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}
