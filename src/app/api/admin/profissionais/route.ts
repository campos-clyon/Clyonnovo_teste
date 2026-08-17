import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool, ensureProvidersSchema, actividadeDosProfissionais } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Lista os profissionais do site para o painel, com a actividade de cada um.
 *
 * A actividade não é enfeite: sem ela não se distingue um profissional que
 * trabalha de um que recebe pedidos e nunca responde, ou de um que nunca
 * recebeu nada — e cada um desses casos pede uma acção diferente do
 * administrador. Vem de uma consulta agregada às negociações, e não de uma por
 * profissional.
 *
 * Devolve email, telefone, NIF e número de transportador, que são dados
 * pessoais e comerciais — daí exigir sessão de administrador.
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

    const actividade = await actividadeDosProfissionais();

    const profissionais = (rows as Array<Record<string, unknown>>).map((p) => ({
      ...p,
      actividade:
        actividade.get(Number(p.id)) ?? { recebidos: 0, comProposta: 0, fechados: 0 },
    }));

    return NextResponse.json({ profissionais });
  } catch (error) {
    console.error("[api/admin/profissionais GET]", error);
    return NextResponse.json({ error: "Erro ao listar profissionais" }, { status: 500 });
  }
}
