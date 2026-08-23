import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/auth";
import {
  withConnection,
  ensureUsersSchema,
  apagarContaDeCliente,
  apagarFotosDoBlob,
  ContaComPendencias,
} from "@/lib/db";

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
  const session = await getServerSession(authOptions);
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
  const session = await getServerSession(authOptions);
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
      // Era `email=${userEmail}` — o email do cliente escrito nos registos a
      // cada gravação de perfil, no caminho normal, sem ninguém precisar dele.
      // Registos guardam-se, exportam-se e vêem-se por mais gente do que a
      // base de dados. O que interessa para diagnóstico é o resultado.
      console.log(`[users/me] PATCH ok — affectedRows=${result.affectedRows} changedRows=${result.changedRows}`);

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
/**
 * Apagar a conta, a pedido do titular.
 *
 * O QUE ISTO FAZIA ANTES
 *
 * Limpava a linha em `users` e mais nada. O ecrã prometia "Os pedidos
 * existentes ficam anonimizados" e os pedidos ficavam intactos — nome,
 * telefone, email, morada completa e fotografias da casa, tudo onde estava.
 * A promessa era do ecrã; o código não a cumpria.
 *
 * E não havia guarda nenhum: dava para apagar a conta a meio de um trabalho
 * contratado, deixando o profissional a trabalhar para ninguém.
 *
 * O trabalho todo vive agora em `apagarContaDeCliente`, numa transacção.
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // A palavra escrita à mão, como no botão. Sem ela, qualquer página que a
  // pessoa visite com a sessão aberta podia apagar-lhe a conta com um `fetch`.
  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    /* corpo vazio — cai na verificação seguinte */
  }
  if (corpo.confirmacao !== "ELIMINAR") {
    return NextResponse.json(
      { error: "Falta a confirmação. Escreva ELIMINAR para continuar." },
      { status: 400 },
    );
  }

  const userEmail = session.user.email.trim().toLowerCase();
  try {
    const r = await apagarContaDeCliente(userEmail, session.user.name ?? userEmail);

    /*
     * As fotografias saem do Blob DEPOIS da resposta.
     *
     * São uma chamada de rede por ficheiro. Pô-las à frente de quem está a
     * fechar a conta fazia-o esperar por elas — e a conta já está apagada
     * quando esta linha corre: o que falta é arrumação, não é o pedido dele.
     */
    if (r.fotos.length > 0) {
      after(async () => {
        const apagadas = await apagarFotosDoBlob(r.fotos);
        if (apagadas < r.fotos.length) {
          console.error(
            `[api/users/me DELETE] ${r.fotos.length - apagadas} de ${r.fotos.length} fotografias não saíram do Blob`,
          );
        }
      });
    }

    return NextResponse.json({ success: true, pedidos: r.pedidos });
  } catch (err) {
    if (err instanceof ContaComPendencias) {
      return NextResponse.json({ error: err.message, motivos: err.motivos }, { status: 409 });
    }
    console.error("[api/users/me] DELETE:", err);
    return NextResponse.json({ error: "Erro ao eliminar conta." }, { status: 500 });
  }
}
