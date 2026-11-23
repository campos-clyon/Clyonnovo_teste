import { getPool } from "./db";
import { estadoDoEspaco, type EspacoDaBase } from "./espaco-da-base";

/**
 * O QUE CADA TABELA OCUPA — d1 (23-11-2026). Só leitura: uma consulta ao
 * `information_schema`, guardada 10 minutos em memória (o selo das Configs
 * pergunta de poucos em poucos segundos). Nada se apaga nem se escreve.
 */

type Guardado = { em: number; espaco: EspacoDaBase };
let guardado: Guardado | null = null;
const DEZ_MINUTOS = 10 * 60 * 1000;

export async function medirOEspaco(agora: number = Date.now()): Promise<EspacoDaBase | null> {
  if (guardado && agora - guardado.em < DEZ_MINUTOS) return guardado.espaco;
  const pool = await getPool();
  if (!pool) return null;
  const [linhas] = (await pool.execute(
    `SELECT table_name AS tabela,
            COALESCE(data_length, 0) / 1048576 AS dadosMb,
            COALESCE(index_length, 0) / 1048576 AS indicesMb,
            COALESCE(data_free, 0) / 1048576 AS livreMb,
            COALESCE(table_rows, 0) AS linhas
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`,
  )) as unknown as [Array<Record<string, unknown>>, unknown];
  const espaco = estadoDoEspaco(
    (Array.isArray(linhas) ? linhas : []).map((l) => ({
      tabela: String(l.tabela ?? l.TABLE_NAME ?? ""),
      dadosMb: Number(l.dadosMb ?? 0),
      indicesMb: Number(l.indicesMb ?? 0),
      livreMb: Number(l.livreMb ?? 0),
      linhas: Number(l.linhas ?? 0),
    })),
  );
  guardado = { em: agora, espaco };
  return espaco;
}

/**
 * O QUE A PURGA DOS 60 DIAS E A ANONIMIZAÇÃO JÁ DEVIAM TER TIRADO — só contagens
 * (nunca dados de pessoas): os pedidos terminados com mais de 60 dias, os
 * abandonados com mais de 90, e o peso, em MB, dos campos grandes dos pedidos.
 * Cada contagem falha sozinha: uma coluna ou tabela diferente não derruba as outras.
 */
export type RelatorioDaPurga = {
  pedidosTerminadosComMaisDe60Dias: number | null;
  pedidosAbandonadosComMaisDe90Dias: number | null;
  pesoDosCamposDosPedidosMb: Record<string, number | null>;
};

export async function relatorioDaPurga(): Promise<RelatorioDaPurga> {
  const pool = await getPool();
  const saida: RelatorioDaPurga = {
    pedidosTerminadosComMaisDe60Dias: null,
    pedidosAbandonadosComMaisDe90Dias: null,
    pesoDosCamposDosPedidosMb: {},
  };
  if (!pool) return saida;
  const um = async (sql: string): Promise<number | null> => {
    try {
      const [r] = (await pool.execute(sql)) as unknown as [Array<Record<string, unknown>>, unknown];
      const v = Array.isArray(r) ? r[0]?.n : null;
      return v == null ? null : Number(v);
    } catch (e) {
      console.error("[espaco-da-base] consulta:", e instanceof Error ? e.message : e);
      return null;
    }
  };
  saida.pedidosTerminadosComMaisDe60Dias = await um(
    "SELECT COUNT(*) AS n FROM simulatorOrders WHERE status IN ('concluido','cancelado','arquivado') AND createdAt < (UTC_TIMESTAMP() - INTERVAL 60 DAY)",
  );
  saida.pedidosAbandonadosComMaisDe90Dias = await um(
    "SELECT COUNT(*) AS n FROM simulatorOrders WHERE status NOT IN ('concluido','cancelado','arquivado','confirmado') AND createdAt < (UTC_TIMESTAMP() - INTERVAL 90 DAY)",
  );
  for (const coluna of ["description", "filesJson", "rawOrderJson", "chatJson", "historyJson", "percursoJson"]) {
    const bytes = await um(`SELECT COALESCE(SUM(LENGTH(${coluna})), 0) AS n FROM simulatorOrders`);
    saida.pesoDosCamposDosPedidosMb[coluna] = bytes == null ? null : Math.round((bytes / 1048576) * 10) / 10;
  }
  return saida;
}
