import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

/**
 * GET /api/users/check-unique?phone=XXX&excludeEmail=YYY
 * Verifica se um telefone já está associado a outra conta.
 * Retorna { available: boolean }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phone        = searchParams.get("phone")?.trim();
  const excludeEmail = searchParams.get("excludeEmail")?.trim();

  if (!phone) {
    return NextResponse.json({ available: true });
  }

  try {
    const pool = await getPool();
    if (!pool) return NextResponse.json({ available: true });

    const [rows] = await pool.execute(
      "SELECT id FROM users WHERE phone = ? AND email != ? AND deletedAt IS NULL LIMIT 1",
      [phone, excludeEmail ?? ""],
    ) as [Array<{ id: number }>, unknown];

    return NextResponse.json({ available: rows.length === 0 });
  } catch {
    // Em caso de erro de DB, não bloquear o utilizador
    return NextResponse.json({ available: true });
  }
}
