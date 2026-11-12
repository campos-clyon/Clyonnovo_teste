import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { provaDaGuiaDe } from "@/lib/db";

export const runtime = "nodejs";

/**
 * VER A PROVA DO REGISTO DE TRANSPORTADOR — 12-11-2026 (d5).
 *
 * Só o administrador (é ele quem verifica a guia, d10.2). O ficheiro é lido do
 * lado do servidor e devolvido aqui: o endereço no armazenamento nunca chega a
 * um browser, nem ao do administrador. Sem cache.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  const providerId = Number((await params).id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Profissional inválido." }, { status: 400 });
  }

  const prova = await provaDaGuiaDe(providerId);
  if (!prova) return NextResponse.json({ error: "Sem prova." }, { status: 404 });

  try {
    const r = await fetch(prova.url, { cache: "no-store" });
    if (!r.ok || !r.body) return NextResponse.json({ error: "A prova não está disponível." }, { status: 502 });
    const nome = (prova.nome ?? "prova").replace(/[^\w.\- ]/g, "_");
    return new NextResponse(r.body, {
      status: 200,
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${nome}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[admin/prova-da-guia]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "A prova não está disponível." }, { status: 502 });
  }
}
