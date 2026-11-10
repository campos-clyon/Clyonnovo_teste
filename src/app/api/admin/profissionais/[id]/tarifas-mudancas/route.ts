import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { tarifaDasMudancasDe } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Os preços das mudanças de um profissional, para a ficha no backoffice —
 * 10-11-2026 (fase 1). SÓ LEITURA: quem os muda é o profissional, no painel
 * ou na app.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;
  const providerId = Number(id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }
  try {
    return NextResponse.json({ tarifa: await tarifaDasMudancasDe(providerId) });
  } catch (e) {
    console.error("[admin/tarifas-mudancas]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler os preços." }, { status: 500 });
  }
}
