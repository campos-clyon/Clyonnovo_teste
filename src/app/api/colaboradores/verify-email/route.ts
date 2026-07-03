import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

/**
 * POST /api/colaboradores/verify-email
 *
 * Verifica se um email pertence a um colaborador activo na DB.
 * Chamado pelo EntrarForm após login Google bem-sucedido para decidir
 * se a sessão deve ser mantida ou terminada com erro de autorização.
 *
 * Body: { email: string }
 * Resposta: { authorized: boolean }
 */
export async function POST(request: NextRequest) {
  let email: string | undefined;

  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email obrigatório." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    if (!pool) {
      return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503 });
    }

    const [rows] = await pool.execute(
      "SELECT id FROM colaboradores WHERE email = ? AND ativo = 1 LIMIT 1",
      [email],
    ) as [Array<{ id: number }>, unknown];

    return NextResponse.json({ authorized: rows.length > 0 });
  } catch (err) {
    console.error("[verify-email] Erro ao verificar colaborador:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
