import { trabalhosClyonTodosNoModeloAntigo } from "./novo-modelo";

/**
 * O QUE A REGRA DO CORTE DOS TRABALHOS CLYON PRECISA, LIDO DA BASE — d33.
 *
 * Para cada negociação: a marca de Trabalho CLYON (`negociacoes.ofertaClyon`, o
 * `valorFixoClyon` do pedido) e a criação do PEDIDO (`simulatorOrders.createdAt`),
 * que é o que `trabalhoClyonDoModeloAntigo` (`novo-modelo.ts`) pergunta.
 *
 * Com o interruptor ligado (`TRABALHOS_CLYON_NO_MODELO_ANTIGO`) todo o Trabalho
 * CLYON é do antigo e a data não serve para nada: devolve um mapa vazio, sem ir
 * à base. Se a leitura falhar, também vazio — e sem a data um Trabalho CLYON
 * fica no ANTIGO (nunca se passa ao modelo novo por não se saber).
 */
export type TrabalhoClyonDaBase = {
  ofertaClyon: string | null;
  valorFixoClyon: string | null;
  pedidoCriadoEm: Date | string | null;
  /**
   * d58 — quando o CLIENTE pagou este Trabalho CLYON à CLYON (seja qual for a
   * data), ou `null`: `clientePagouOTrabalhoClyon` sobre os `pagamentos` da
   * negociação e as datas do fecho. Com ela, fica no antigo.
   */
  clientePagouAClyonEm: Date | null;
};

export async function trabalhosClyonDasNegociacoes(
  ids: ReadonlyArray<number | string | null | undefined>,
): Promise<Map<number, TrabalhoClyonDaBase>> {
  const mapa = new Map<number, TrabalhoClyonDaBase>();
  if (trabalhosClyonTodosNoModeloAntigo()) return mapa;
  const validos = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (validos.length === 0) return mapa;
  try {
    const { getPool } = await import("./db");
    const pool = await getPool();
    if (!pool) return mapa;
    const [rows] = (await pool.execute(
      `SELECT n.id, n.ofertaClyon, o.valorFixoClyon, o.createdAt AS pedidoCriadoEm,
              n.confirmadoEm, n.pagoEm, n.execucaoEnviadaEm
         FROM negociacoes n
         JOIN simulatorOrders o ON o.id = n.pedidoId
        WHERE n.id IN (${validos.map(() => "?").join(",")})
          AND (n.ofertaClyon IS NOT NULL OR o.valorFixoClyon IS NOT NULL)`,
      validos,
    )) as unknown as [Array<Record<string, unknown>>, unknown];
    const linhas = Array.isArray(rows) ? rows : [];
    /*
     * d58: o pagamento do cliente à CLYON, seja qual for a data. Se a leitura
     * falhar, fica como antes (sem ele) — e diz-se no registo.
     */
    const { pagamentosDasNegociacoes } = await import("./pagamentos-na-base");
    const { clientePagouOTrabalhoClyon } = await import("./taxa-a-passar-a-clyon");
    const pagamentos = await pagamentosDasNegociacoes(linhas.map((r) => Number(r.id))).catch((err) => {
      console.error("[trabalho-clyon-na-base] pagamentos:", err instanceof Error ? err.message : err);
      return new Map<number, never[]>();
    });
    for (const r of linhas) {
      mapa.set(Number(r.id), {
        ofertaClyon: typeof r.ofertaClyon === "string" && r.ofertaClyon !== "" ? r.ofertaClyon : null,
        valorFixoClyon: r.valorFixoClyon == null ? null : String(r.valorFixoClyon),
        pedidoCriadoEm: (r.pedidoCriadoEm as Date | string | null) ?? null,
        clientePagouAClyonEm: clientePagouOTrabalhoClyon(pagamentos.get(Number(r.id)) ?? [], {
          confirmadoEm: r.confirmadoEm,
          pagoEm: r.pagoEm,
          execucaoEnviadaEm: r.execucaoEnviadaEm,
        }),
      });
    }
  } catch (err) {
    console.error("[trabalho-clyon-na-base] criação dos pedidos:", err instanceof Error ? err.message : err);
  }
  return mapa;
}

/**
 * Junta à linha o que veio da base — a marca e a criação do pedido. O que a
 * linha já traz ganha (a consulta de quem chama é a fonte); a base só preenche
 * o que falta (`segueONovoModelo({ id })`, por exemplo, chega sem marca).
 */
export function comOTrabalhoClyonDaBase<T extends { ofertaClyon?: unknown; pedidoCriadoEm?: Date | string | null }>(
  l: T,
  daBase: TrabalhoClyonDaBase | undefined,
): T & {
  ofertaClyon?: unknown;
  valorFixoClyon?: unknown;
  pedidoCriadoEm?: Date | string | null;
  clientePagouAClyonEm?: Date | string | null;
} {
  if (!daBase) return l;
  return {
    ...l,
    ofertaClyon: l.ofertaClyon ?? daBase.ofertaClyon,
    valorFixoClyon: (l as { valorFixoClyon?: unknown }).valorFixoClyon ?? daBase.valorFixoClyon,
    pedidoCriadoEm: l.pedidoCriadoEm ?? daBase.pedidoCriadoEm,
    // d58: só a base o sabe (os pagamentos e as datas do fecho lidos juntos).
    clientePagouAClyonEm: daBase.clientePagouAClyonEm,
  };
}
