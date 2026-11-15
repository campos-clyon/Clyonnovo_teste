import { getPool, ensureNegociacoesTable, ensureProvidersSchema } from "./db";
import { mudaramDepoisDeContratar } from "./dados-de-pagamento-mudados";

/**
 * AS CONTRATADAS EM QUE O IBAN, O TITULAR OU O MB WAY DO PARCEIRO MUDARAM
 * DEPOIS DE O CLIENTE CONTRATAR — d28 (15-11-2026). A regra é
 * `mudaramDepoisDeContratar`; aqui só se lêem as datas, numa consulta. Para o
 * bloco «Pagar a …» (um id) e para o selo da Mesa (vários). Sem ids, vazio.
 */
export async function negociacoesComDadosDePagamentoMudados(ids: ReadonlyArray<number>): Promise<Set<number>> {
  const saida = new Set<number>();
  const validos = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (validos.length === 0) return saida;
  await ensureProvidersSchema();
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return saida;
  const [linhas] = (await pool.execute(
    `SELECT n.id, n.contratadaEm, n.createdAt, p.ibanMudadoEm
       FROM negociacoes n JOIN providers p ON p.id = n.providerId
      WHERE n.id IN (${validos.map(() => "?").join(",")}) AND n.estado = 'acordada' AND p.ibanMudadoEm IS NOT NULL`,
    validos,
  )) as unknown as [Array<Record<string, unknown>>, unknown];
  for (const l of Array.isArray(linhas) ? linhas : []) {
    if (mudaramDepoisDeContratar(l.ibanMudadoEm, l.contratadaEm, l.createdAt)) saida.add(Number(l.id));
  }
  return saida;
}
