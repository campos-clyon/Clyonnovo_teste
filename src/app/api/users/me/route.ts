import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptionsCliente } from "@/auth-cliente";
import { withConnection, ensureUsersSchema } from "@/lib/db";

// Cache de módulo para evitar chamar ensureUsersSchema múltiplas vezes (é lento na Neon DB)
let _schemaReady = false;
async function getSchemaReady() {
  if (_schemaReady) return;
  await ensureUsersSchema();
  _schemaReady = true;
}

// Row returned from DB
interface UserRow {
  id: number;
  name: string | null;
  email: string;
  openId: string | null;
  phone: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  postalCode: string | null;
  addressCity: string | null;
  nif: string | null;
  billingName: string | null;
  billingNif: string | null;
  billingAddress: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  avatarUrl: string | null;
  notifOrderStatus: number;
  notifWeeklyDigest: number;
  notifWhatsapp: number;
  createdAt: string;
}

/**
 * Obtém ou cria o utilizador pelo email (normalizado para lowercase).
 * Usa INSERT ... ON DUPLICATE KEY UPDATE para ser uma única query atómica
 * que nunca falha por falta de registo nem cria duplicados.
 * Requer índice UNIQUE em `email`, que `ensureUsersSchema` garante.
 */
async function getOrCreateUser(email: string, name: string | null): Promise<UserRow> {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = name ?? normalizedEmail.split("@")[0];

  return withConnection(async (conn) => {
    // Upsert: cria se não existe, actualiza lastSignedIn se já existe
    // openId = NULL explícito para schemas antigos onde era NOT NULL sem default
    await conn.execute(
      `INSERT INTO users (email, name, openId, loginMethod, role, lastSignedIn, createdAt, updatedAt)
       VALUES (?, ?, NULL, 'google', 'user', NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         name = IF(name IS NULL OR name = '', VALUES(name), name),
         lastSignedIn = NOW(),
         updatedAt = NOW()`,
      [normalizedEmail, displayName],
    );

    const [rows] = await conn.execute(
      "SELECT * FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1",
      [normalizedEmail],
    ) as [UserRow[], unknown];

    if (!rows[0]) throw new Error(`Utilizador não encontrado após upsert: ${normalizedEmail}`);
    return rows[0];
  });
}

// GET /api/users/me
export async function GET() {
  const session = await getServerSession(authOptionsCliente);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  await getSchemaReady();

  const emailNorm = session.user.email.trim().toLowerCase();

  try {
    const user = await getOrCreateUser(emailNorm, session.user.name ?? null);
    return NextResponse.json({ user }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/users/me] GET erro:", err);
    }
    return NextResponse.json({ error: "Erro ao carregar dados." }, { status: 500 });
  }
}

const PatchSchema = z.object({
  name:              z.string().min(1).max(160).optional(),
  phone:             z.string().max(30).optional().nullable(),
  addressLine:       z.string().max(255).optional().nullable(),
  addressNumber:     z.string().max(20).optional().nullable(),
  postalCode:        z.string().max(20).optional().nullable(),
  addressCity:       z.string().max(120).optional().nullable(),
  nif:               z.string().max(20).optional().nullable(),
  billingName:       z.string().max(160).optional().nullable(),
  billingNif:        z.string().max(20).optional().nullable(),
  billingAddress:    z.string().max(255).optional().nullable(),
  billingPostalCode: z.string().max(20).optional().nullable(),
  billingCity:       z.string().max(120).optional().nullable(),
  avatarUrl:         z.string().max(1024).optional().nullable(),
  notifOrderStatus:  z.boolean().optional(),
  notifWeeklyDigest: z.boolean().optional(),
  notifWhatsapp:     z.boolean().optional(),
});

// PATCH /api/users/me
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptionsCliente);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  await getSchemaReady();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const userEmail = session.user.email.trim().toLowerCase();
  const displayName = session.user?.name ?? userEmail.split("@")[0];

  // Campos string que podem ser NULL
  const strFields = [
    "name", "phone", "addressLine", "addressNumber", "postalCode", "addressCity",
    "nif", "billingName", "billingNif", "billingAddress", "billingPostalCode",
    "billingCity", "avatarUrl",
  ] as const;

  // Campos boolean (TINYINT na DB)
  const boolFields = ["notifOrderStatus", "notifWeeklyDigest", "notifWhatsapp"] as const;

  // Construir SET clauses para o ON DUPLICATE KEY UPDATE
  const updateClauses: string[] = ["updatedAt = NOW()"];
  const updateValues: unknown[] = [];

  for (const f of strFields) {
    if (f in data) {
      updateClauses.push(`${f} = ?`);
      updateValues.push(data[f] ?? null);
    }
  }
  for (const f of boolFields) {
    if (f in data) {
      updateClauses.push(`${f} = ?`);
      updateValues.push(data[f] ? 1 : 0);
    }
  }

  if (updateClauses.length === 1) {
    // Só updatedAt — nada para guardar
    return NextResponse.json({ success: true });
  }

  try {
    return await withConnection(async (conn) => {
      // Verificar unicidade do telefone antes de gravar
      if (data.phone) {
        const [phoneRows] = await conn.execute(
          "SELECT id FROM users WHERE phone = ? AND email <> ? AND deletedAt IS NULL LIMIT 1",
          [data.phone, userEmail],
        ) as [Array<{ id: number }>, unknown];
        if (phoneRows.length > 0) {
          return NextResponse.json(
            { error: "Este número de telefone já está associado a outra conta.", field: "phone" },
            { status: 409 },
          );
        }
      }

      // INSERT ... ON DUPLICATE KEY UPDATE — atómica, nunca falha por falta de registo
      // Se o utilizador não existe: cria. Se existe: actualiza os campos enviados.
      // O índice UNIQUE em email garante que ON DUPLICATE KEY dispara correctamente.
      // Excluir 'name' de strFields porque já está incluído explicitamente
      const extraStrFields = strFields.filter(f => f !== "name" && f in data);
      const extraBoolFields = boolFields.filter(f => f in data);
      
      const insertCols = ["email", "name", "openId", "loginMethod", "role", "createdAt", "updatedAt",
        ...extraStrFields,
        ...extraBoolFields,
      ];
      const insertVals: unknown[] = [
        userEmail, displayName, null, "google", "user", new Date(), new Date(),
        ...extraStrFields.map(f => data[f] ?? null),
        ...extraBoolFields.map(f => data[f] ? 1 : 0),
      ];

      console.log("[v0] PATCH: INSERT cols:", insertCols.join(", "));
      console.log("[v0] PATCH: UPDATE clauses:", updateClauses.join(", "));
      console.log("[v0] PATCH: total params:", insertVals.length + updateValues.length);

      const [result] = await conn.execute(
        `INSERT INTO users (${insertCols.join(", ")}) VALUES (${insertCols.map(() => "?").join(", ")})
         ON DUPLICATE KEY UPDATE ${updateClauses.join(", ")}`,
        [...insertVals, ...updateValues],
      ) as [{ affectedRows: number; changedRows: number }, unknown];

      // affectedRows = 1 → INSERT novo; 2 → UPDATE feito; 0 → UPDATE sem alteração (dados iguais)
      console.log(`[v0] PATCH OK — affectedRows=${result.affectedRows} changedRows=${result.changedRows} email=${userEmail}`);

      return NextResponse.json({ success: true, affectedRows: result.affectedRows });
    });
  } catch (err: unknown) {
    // ER_DUP_ENTRY no telefone pode acontecer em race condition
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ER_DUP_ENTRY" &&
      err.message.includes("phone")
    ) {
      console.error("[v0] PATCH: ER_DUP_ENTRY no telefone:", err.message);
      return NextResponse.json(
        { error: "Este número de telefone já está associado a outra conta.", field: "phone" },
        { status: 409 },
      );
    }
    console.error("[v0] PATCH erro completo:", {
      name: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({
      error: `Erro ao guardar dados: ${err instanceof Error ? err.message : String(err)}`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// DELETE /api/users/me — anonimiza dados, não apaga pedidos
export async function DELETE() {
  const session = await getServerSession(authOptionsCliente);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const userEmail = session.user.email.trim().toLowerCase();
  try {
    await withConnection(async (conn) => {
      await conn.execute(
        `UPDATE users
         SET name = 'Utilizador eliminado', phone = NULL, addressLine = NULL,
             addressNumber = NULL, postalCode = NULL, addressCity = NULL,
             nif = NULL, billingName = NULL, billingNif = NULL,
             billingAddress = NULL, billingPostalCode = NULL, billingCity = NULL,
             avatarUrl = NULL, deletedAt = NOW(), updatedAt = NOW()
         WHERE email = ?`,
        [userEmail],
      );
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/users/me] DELETE:", err);
    return NextResponse.json({ error: "Erro ao eliminar conta." }, { status: 500 });
  }
}
