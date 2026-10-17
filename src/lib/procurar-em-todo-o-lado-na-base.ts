import { ensureNegociacoesTable, ensureSimulatorOrdersTable, withConnection } from "@/lib/db";
import { procurarNasLinhas, termoQueProcura, type LinhaParaProcurar, type ResultadoDaProcura } from "@/lib/procurar-em-todo-o-lado";

/** A leitura da base para `procurar-em-todo-o-lado.ts` — só no servidor. */
export async function procurarEmTodoOLado(termo: string): Promise<ResultadoDaProcura[]> {
  if (!termoQueProcura(termo)) return [];
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  const linhas = await withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `SELECT o.id, o.status, o.contactName, o.contactPhone, o.contactEmail, o.address, o.city, o.postalCode,
              o.serviceType, o.valorFixoClyon, o.createdAt,
              (SELECT COUNT(*) FROM negociacoes x WHERE x.pedidoId = o.id) AS negociacoes,
              pn.name AS profissional
         FROM simulatorOrders o
         LEFT JOIN (
           SELECT pedidoId, MAX(id) AS negociacaoId
             FROM negociacoes
            WHERE estado = 'acordada'
            GROUP BY pedidoId
         ) a ON a.pedidoId = o.id
         LEFT JOIN negociacoes n ON n.id = a.negociacaoId
         LEFT JOIN providers pn ON pn.id = n.providerId
        ORDER BY o.id DESC
        LIMIT 5000`,
    )) as [LinhaParaProcurar[], unknown];
    return r;
  });
  return procurarNasLinhas(linhas, termo);
}
