import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * GET /api/users/check-unique?phone=XXX
 * Verifica se um telefone já está associado a outra conta.
 *
 * ⚠️ Estava aberta a toda a gente. Com ela, qualquer pessoa percorria uma
 * lista de números e ficava a saber quais têm conta na CLYON — e o
 * `excludeEmail` vinha da query string, por isso também dizia se um dado
 * email e um dado telefone pertenciam à mesma pessoa. É um serviço de
 * verificação de dados pessoais oferecido de graça a quem o encontrasse.
 *
 * Passa a exigir sessão, e o email de exclusão vem da sessão — não do
 * pedido. Quem valida o seu próprio telefone continua a poder fazê-lo;
 * quem quer testar os telefones dos outros deixa de conseguir.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const emailSessao = session?.user?.email;
  if (!emailSessao) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Mesmo autenticado, um utilizador não deve poder testar milhares de
  // números a partir da sua conta.
  const rl = await checkRateLimit(`check-unique:${emailSessao}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Demasiadas verificações. Aguarde." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const phone        = searchParams.get("phone")?.trim();
  const excludeEmail = emailSessao;

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
