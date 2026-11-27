import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { csvDaFolhaD7 } from "@/lib/folha-d7-mudancas";
import { folhaD7DasMudancas } from "@/lib/folha-d7-mudancas-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A FOLHA DA MEDIÇÃO DE 30 DIAS DA d7 — as mudanças (d14, 27-11-2026). Uma
 * linha por n.º de pedido de mudança: desde, referência, valor proposto,
 * aceite, motivo. `?formato=csv` dá o CSV; `?dias=` muda a janela (30 por
 * omissão). Só leitura; só números de pedido.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const url = new URL(req.url);
    const dias = Number(url.searchParams.get("dias") ?? "30");
    const linhas = await folhaD7DasMudancas(Number.isFinite(dias) ? dias : 30);
    if (url.searchParams.get("formato") === "csv") {
      return new NextResponse(`﻿${csvDaFolhaD7(linhas)}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="mudancas-d7.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json({ linhas }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/mudancas/folha-d7]", e instanceof Error ? e.message : e);
    return NextResponse.json({ linhas: [], error: "Não foi possível ler." }, { status: 500 });
  }
}
