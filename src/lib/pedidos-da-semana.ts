import { getPool } from "./db";

/*
 * QUANTOS PEDIDOS CHEGARAM NA ÚLTIMA SEMANA — 31-10-2026 (d6 de 28-10).
 *
 * Para /quero-ser-parceiro mostrar a quem tem carrinha que há trabalho, com um
 * número lido da base e nunca escrito à mão. Contam os pedidos de clientes
 * que entraram nos últimos 7 dias — pelo site, pelo WhatsApp ou registados
 * pela equipa —, menos os arquivados (repetidos, testes, os que não eram
 * pedidos). Na dúvida conta-se a menos, nunca a mais.
 *
 * A página guarda-o uma hora (`revalidate`), como as taxas: uma consulta por
 * hora, e não uma por visita.
 */

/** Abaixo disto a linha não aparece: um número pequeno não ajuda a recrutar. */
export const MINIMO_PARA_MOSTRAR = 5;

export async function pedidosDosUltimos7Dias(): Promise<number | null> {
  try {
    const pool = await getPool();
    if (!pool) return null;
    const [linhas] = (await pool.execute(
      `SELECT COUNT(*) AS n FROM simulatorOrders
        WHERE createdAt >= NOW() - INTERVAL 7 DAY
          AND (status IS NULL OR status <> 'arquivado')`,
    )) as [Array<{ n: unknown }>, unknown];
    const n = Number(linhas[0]?.n);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    console.error("[pedidos-da-semana]", e instanceof Error ? e.message : e);
    return null;
  }
}

/** O número a mostrar, ou null se não se sabe ou é pequeno de mais. */
export function pedidosParaMostrar(n: number | null): number | null {
  return n != null && Number.isInteger(n) && n >= MINIMO_PARA_MOSTRAR ? n : null;
}
