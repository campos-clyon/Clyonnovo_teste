import { NextRequest, NextResponse } from "next/server";
import { getPagamentosAssistente } from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };
  if (!colab.isAdmin) return { err: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), colab: null };
  return { err: null, colab };
}

// GET /api/admin/pagamentos?from=ISO&to=ISO&assistenteId=N
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { searchParams } = req.nextUrl;
  const fromStr = searchParams.get("from");
  const toStr   = searchParams.get("to");
  const assistenteIdStr = searchParams.get("assistenteId");

  // Defaults: início da semana actual (segunda-feira) até agora
  const now = new Date();
  let from: Date;
  let to: Date = now;

  if (fromStr) {
    from = new Date(fromStr);
  } else {
    // Início da semana actual (segunda-feira 00:00)
    from = new Date(now);
    const day = from.getDay(); // 0=dom, 1=seg...
    const diff = day === 0 ? -6 : 1 - day;
    from.setDate(from.getDate() + diff);
    from.setHours(0, 0, 0, 0);
  }

  if (toStr) {
    to = new Date(toStr);
  }

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
  }

  const assistenteId = assistenteIdStr ? Number(assistenteIdStr) : undefined;

  const pagamentos = await getPagamentosAssistente({ from, to, assistenteId });

  return NextResponse.json({
    ok: true,
    from: from.toISOString(),
    to: to.toISOString(),
    pagamentos,
  });
}
