/**
 * Rota de diagnóstico TEMPORÁRIA — remover após confirmar persistência.
 * Protegida com token simples para não expor dados em produção.
 *
 * GET /api/_diag?token=clyon_diag_2026
 *
 * Devolve:
 *  - DESCRIBE users (lista de colunas)
 *  - Utilizadores com email a conter "wanderson" (sem dados sensíveis)
 *  - BLOB_READ_WRITE_TOKEN configurado ou não
 */

import { NextRequest, NextResponse } from "next/server";
import { withConnection } from "@/lib/db";

const DIAG_TOKEN = "clyon_diag_2026";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== DIAG_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result: Record<string, unknown> = {};

  try {
    await withConnection(async (conn) => {
      // 1. Ping
      const [[ping]] = await conn.execute("SELECT 1 AS ok, DATABASE() AS db") as [Array<{ ok: number; db: string }>, unknown];
      result.connection = { ok: ping.ok === 1, database: ping.db };

      // 2. DESCRIBE users
      const [cols] = await conn.execute("DESCRIBE users") as [Array<{ Field: string; Type: string; Null: string; Key: string; Default: string | null }>, unknown];
      result.columns = cols.map((c) => ({
        field: c.Field,
        type: c.Type,
        null: c.Null,
        key: c.Key,
        default: c.Default,
      }));

      // 3. Colunas críticas
      const needed = ["phone", "addressLine", "addressNumber", "postalCode", "addressCity", "avatarUrl", "billingName", "billingNif", "billingAddress", "billingPostalCode", "billingCity", "notifOrderStatus", "notifWeeklyDigest", "notifWhatsapp", "deletedAt"];
      const existing = new Set(cols.map((c) => c.Field));
      result.missingColumns = needed.filter((n) => !existing.has(n));

      // 4. Utilizadores com "wanderson" no email — detectar duplicados
      const [users] = await conn.execute(
        `SELECT id, email, name, phone, addressLine, postalCode, addressCity, createdAt, updatedAt
         FROM users WHERE email LIKE ? ORDER BY createdAt ASC`,
        ["%wandersoncampossilva2018%"],
      ) as [Array<Record<string, unknown>>, unknown];
      result.userRows = users;
      result.duplicateDetected = users.length > 1;

      // 5. Todos os utilizadores (id, email mascarado, createdAt)
      const [allUsers] = await conn.execute(
        "SELECT id, CONCAT(LEFT(email,3),'***@',SUBSTRING_INDEX(email,'@',-1)) AS emailMasked, name, createdAt FROM users ORDER BY id ASC LIMIT 20",
      ) as [Array<Record<string, unknown>>, unknown];
      result.allUsersSample = allUsers;
    });
  } catch (err) {
    result.dbError = String(err);
  }

  // 6. BLOB token
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  result.blobToken = blobToken
    ? `configurado (${blobToken.slice(0, 20)}...)`
    : "NAO_CONFIGURADO";

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
