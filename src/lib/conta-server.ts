/**
 * Helpers server-side para carregar os dados da conta do cliente em SSR.
 * Usado por app/conta/page.tsx para pre-carregar user + pedidos e eliminar
 * o estado vazio de 7s que aparecia enquanto o cliente-side fazia fetch.
 */
import { ensureUsersSchema, ensureSimulatorOrdersTable, getPool, withConnection } from "@/lib/db";

let _schemaReady = false;
async function ensureReady() {
  if (_schemaReady) return;
  await Promise.all([ensureUsersSchema(), ensureSimulatorOrdersTable()]);
  _schemaReady = true;
}

/**
 * Regista que este cliente existe.
 *
 * A linha na tabela `users` nascia dentro do `loadContaData`, que só corre
 * quando alguém abre /conta. Quem entrava com Google e ia para outro lado —
 * voltar ao simulador, fechar o separador — ficava com sessão iniciada e sem
 * conta nenhuma na base.
 *
 * Era isso que tinha o contador do backoffice parado: doze contas em Julho,
 * uma em Agosto, com pedidos a entrar todos os dias. O número estava certo;
 * é que contava quem tinha aberto uma página, não quem se tinha autenticado.
 *
 * NUNCA lança. Isto é chamado de dentro do login: uma base indisponível não
 * pode impedir alguém de entrar. Se falhar, o /conta grava na mesma à
 * primeira visita, que é o que já acontecia antes.
 */
export async function registarCliente(email: string, name: string | null): Promise<void> {
  try {
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) return;
    await ensureReady();
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO users (email, name, openId, loginMethod, role, lastSignedIn, createdAt, updatedAt)
         VALUES (?, ?, NULL, 'google', 'user', NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = IF(name IS NULL OR name = '', VALUES(name), name),
           lastSignedIn = NOW(),
           updatedAt = NOW()`,
        [emailNorm, name ?? emailNorm.split("@")[0]],
      );
    });
  } catch (err) {
    console.error("[registarCliente] não gravou a conta:", err);
  }
}

export async function loadContaData(email: string, name: string | null) {
  await ensureReady();
  const emailNorm = email.trim().toLowerCase();
  const displayName = name ?? emailNorm.split("@")[0];

  const [user, ordersData] = await Promise.all([
    // Upsert do user + devolver row
    withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO users (email, name, openId, loginMethod, role, lastSignedIn, createdAt, updatedAt)
         VALUES (?, ?, NULL, 'google', 'user', NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = IF(name IS NULL OR name = '', VALUES(name), name),
           lastSignedIn = NOW(),
           updatedAt = NOW()`,
        [emailNorm, displayName],
      );
      const [rows] = await conn.execute(
        "SELECT * FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1",
        [emailNorm],
      ) as [Array<Record<string, unknown>>, unknown];
      return rows[0] ?? null;
    }),
    // Últimos pedidos + resumo — mesma query que /api/users/me/orders
    (async () => {
      const pool = await getPool();
      if (!pool) return { orders: [], summary: null };

      // Estas duas eram sequenciais: o resumo ia e voltava, e só depois é
      // que os pedidos partiam. Numa base remota é uma ida e volta inteira
      // de espera por nada — uma não depende da outra.
      const [[summaryRows], [rows]] = await Promise.all([
        pool.execute(
          `SELECT
           COUNT(*) AS totalOrders,
           SUM(CASE WHEN status NOT IN ('concluido','cancelado','rejeitado') THEN 1 ELSE 0 END) AS activeOrders,
           MAX(createdAt) AS lastOrderDate
         FROM simulatorOrders
         WHERE LOWER(TRIM(contactEmail)) = ?`,
          [emailNorm],
        ) as Promise<[Array<{ totalOrders: number; activeOrders: number | null; lastOrderDate: string | null }>, unknown]>,
        pool.execute(
          `SELECT
           o.id, o.serviceType, o.address, o.city, o.postalCode, o.status,
           o.estimateMin, o.estimateMax, o.estimateTotal,
           o.precoFinal, o.precoFinalIva,
           o.mensagemCliente, o.description, o.historyJson,
           o.urgency, o.floor, o.hasElevator, o.parkingDistance,
           o.distanceKm, o.distanceText, o.filesJson,
           o.scheduledDate, o.scheduledStartTime,
           o.createdAt, o.updatedAt, o.confirmadoPeloCliente,
           o.canceladoPeloCliente,
           o.recurrenceFrequency, o.recurringDiscountPercent,
           o.clientRating, o.clientRatingComment,
           o.providerId, o.assignedToId, o.assignedToName,
           p.name AS providerName, p.phone AS providerPhone
         FROM simulatorOrders o
         LEFT JOIN providers p ON p.id = o.providerId
         WHERE LOWER(TRIM(o.contactEmail)) = ?
         ORDER BY o.createdAt DESC
         LIMIT 10`,
          [emailNorm],
        ) as Promise<[Array<Record<string, unknown>>, unknown]>,
      ]);

      const summary = {
        totalOrders:   Number(summaryRows[0]?.totalOrders ?? 0),
        activeOrders:  Number(summaryRows[0]?.activeOrders ?? 0),
        lastOrderDate: summaryRows[0]?.lastOrderDate ?? null,
      };

      /*
       * As negociações de cada pedido — as mesmas que a API devolve.
       *
       * Faltavam aqui, e o efeito era subtil: a Visão Geral, que é servida
       * por esta consulta, abria o pedido sem propostas nenhumas; a lista
       * "Os meus pedidos", que vai à API, abria o mesmo pedido com elas. O
       * cliente via duas versões do mesmo ecrã conforme o caminho por onde
       * lá chegou.
       */
      const ids = rows.map((r) => Number(r.id)).filter((n) => Number.isInteger(n));
      const porPedido = new Map<number, unknown[]>();
      if (ids.length > 0) {
        const [negs] = (await pool.execute(
          `SELECT n.id, n.pedidoId, n.estado, n.valorAcordado, n.propostasJson,
                  n.execucaoEnviadaEm, n.provaJson, n.confirmadoEm, n.pagoEm,
                  n.estrelas,
                  p.name AS profissionalNome, p.phone AS profissionalTelefone,
                  p.emiteFatura, p.regimeIva, p.guiaVerificadaEm
             FROM negociacoes n
             JOIN providers p ON p.id = n.providerId
            WHERE n.pedidoId IN (${ids.map(() => "?").join(",")})
            ORDER BY n.updatedAt DESC`,
          ids,
        )) as [Array<Record<string, unknown>>, unknown];

        for (const n of negs) {
          const k = Number(n.pedidoId);
          if (!porPedido.has(k)) porPedido.set(k, []);
          // O telefone do profissional só depois de contratado.
          porPedido.get(k)!.push({
            ...n,
            profissionalTelefone: n.estado === "acordada" ? n.profissionalTelefone : null,
          });
        }
      }

      return {
        orders: rows.map((r) => ({
          ...r,
          negociacoes: porPedido.get(Number(r.id)) ?? [],
        })),
        summary,
      };
    })(),
  ]);

  return {
    user,
    orders: ordersData.orders,
    summary: ordersData.summary,
  };
}
