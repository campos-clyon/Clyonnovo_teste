import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { mudancasAHoraSemValorNaMesa } from "@/lib/mudanca-a-hora-sem-valor-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS MUDANÇAS À HORA SEM O VALOR ENVIADO NA MESA — d14, 27-11-2026. Os pedidos
 * de mudança à hora dos últimos 30 dias, abertos, sem valor enviado ao cliente
 * e com 3 h ou mais desde que entraram. O cartão «Do nosso lado» faz deles uma
 * linha com o texto-modelo. Só leitura; só números de pedido.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  return NextResponse.json({ pedidos: await mudancasAHoraSemValorNaMesa() }, { headers: { "Cache-Control": "no-store" } });
}
