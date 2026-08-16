import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool, ensureProvidersSchema } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Lista os profissionais do site para o painel.
 *
 * Existe porque a verificação do número de transportador é trabalho de uma
 * pessoa, e sem um ecrã só se fazia por SQL à mão — que é como se esquece de
 * o fazer, e um pedido com guia obrigatória não chega a ninguém sem se
 * perceber porquê.
 *
 * Devolve o número de transportador, o NIF e o email, que são dados pessoais
 * e comerciais — daí exigir sessão de administrador e não apenas de
 * colaborador.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    await ensureProvidersSchema();
    const pool = await getPool();
    if (!pool) return NextResponse.json({ profissionais: [] });

    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, nif, city, categorias, zonas, raioKm,
              emiteFatura, emiteGuiaTransporte, numeroTransportador,
              guiaVerificadaEm, guiaVerificadaPor, estado, isActive,
              baseLat, baseLng, createdAt
         FROM providers
        WHERE isClyon = 0
        ORDER BY
          -- Quem espera verificação primeiro: é o que trava pedidos.
          (emiteGuiaTransporte = 1 AND guiaVerificadaEm IS NULL) DESC,
          (estado = 'pendente') DESC,
          createdAt DESC
        LIMIT 500`,
    ) as any[];

    return NextResponse.json({ profissionais: rows });
  } catch (error) {
    console.error("[api/admin/profissionais GET]", error);
    return NextResponse.json({ error: "Erro ao listar profissionais" }, { status: 500 });
  }
}
