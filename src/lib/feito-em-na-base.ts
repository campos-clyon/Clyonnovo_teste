import { getPool } from "@/lib/db";
import { feitoEmDe } from "@/lib/feito-em";

/**
 * O «FEITO EM» DE UMA NEGOCIAÇÃO, LIDO DA BASE — d36, 15-11-2026. Para o
 * histórico do pedido dizer quando ficou feito, depois de gravado. Nunca lança:
 * sem a data (ou sem base), devolve `null` e o histórico diz o que dizia.
 */
export async function feitoEmDaNegociacao(negociacaoId: number): Promise<Date | null> {
  try {
    const pool = await getPool();
    if (!pool) return null;
    const [r] = (await pool.execute("SELECT feitoEm FROM negociacoes WHERE id = ? LIMIT 1", [negociacaoId])) as [
      Array<{ feitoEm: Date | string | null }>,
      unknown,
    ];
    return feitoEmDe(Array.isArray(r) ? r[0] : null);
  } catch {
    return null;
  }
}
