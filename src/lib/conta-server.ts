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

      const [summaryRows] = await pool.execute(
        `SELECT
           COUNT(*) AS totalOrders,
           SUM(CASE WHEN status NOT IN ('concluido','cancelado','rejeitado') THEN 1 ELSE 0 END) AS activeOrders,
           MAX(createdAt) AS lastOrderDate
         FROM simulatorOrders
         WHERE LOWER(TRIM(contactEmail)) = ?`,
        [emailNorm],
      ) as [Array<{ totalOrders: number; activeOrders: number | null; lastOrderDate: string | null }>, unknown];

      const summary = {
        totalOrders:   Number(summaryRows[0]?.totalOrders ?? 0),
        activeOrders:  Number(summaryRows[0]?.activeOrders ?? 0),
        lastOrderDate: summaryRows[0]?.lastOrderDate ?? null,
      };

      const [rows] = await pool.execute(
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
      ) as [Array<Record<string, unknown>>, unknown];

      return { orders: rows, summary };
    })(),
  ]);

  return {
    user,
    orders: ordersData.orders,
    summary: ordersData.summary,
  };
}
