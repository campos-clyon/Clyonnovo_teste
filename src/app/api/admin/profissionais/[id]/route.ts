import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { verificarGuiaDeTransporte, definirEstadoDoProfissional } from "@/lib/db";

export const runtime = "nodejs";

const ESTADOS = ["pendente", "aprovado", "rejeitado", "suspenso"] as const;
type Estado = (typeof ESTADOS)[number];

/**
 * Aprovar um profissional, e confirmar o número de transportador.
 *
 * As duas coisas são separadas de propósito. Aprovar diz "pode receber
 * pedidos"; verificar a guia diz "confirmámos que ele pode legalmente
 * transportar resíduos". Alguém pode estar aprovado sem guia verificada — só
 * não recebe os pedidos que a exigem.
 *
 * Quem verifica fica gravado. Um distintivo em que o cliente confia tem de ter
 * um nome por trás: se um dia se descobrir que o número não presta, é preciso
 * saber quem o deu por bom.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const providerId = Number(id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  try {
    const feito: string[] = [];

    if (corpo.verificarGuia === true) {
      await verificarGuiaDeTransporte(providerId, colab.nome);
      feito.push("guia verificada");
    }

    if (typeof corpo.estado === "string") {
      if (!ESTADOS.includes(corpo.estado as Estado)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }
      await definirEstadoDoProfissional(providerId, corpo.estado as Estado);
      feito.push(`estado: ${corpo.estado}`);
    }

    if (feito.length === 0) {
      return NextResponse.json({ error: "Nada para alterar" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, feito });
  } catch (error) {
    console.error("[api/admin/profissionais PATCH]", error);
    return NextResponse.json({ error: "Erro ao actualizar profissional" }, { status: 500 });
  }
}
