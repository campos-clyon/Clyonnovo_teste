import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { motivosDoFechoDaSemana } from "@/lib/db";
import { motivosPorServico } from "@/lib/motivo-do-fecho";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Os pedidos cancelados ou arquivados nos últimos 7 dias, por serviço e por motivo (d54). */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json({ dias: 7, porServico: motivosPorServico(await motivosDoFechoDaSemana()) });
  } catch (e) {
    console.error("[admin/motivos-do-fecho]", e);
    return NextResponse.json({ error: "Não foi possível contar os motivos." }, { status: 500 });
  }
}
