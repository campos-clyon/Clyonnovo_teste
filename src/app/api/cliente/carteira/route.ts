import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { carteiraDoClienteParaAApp } from "@/lib/carteira-para-a-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A CARTEIRA DO CLIENTE NA APP (S22, 29-10-2026) — a mesma conta da `/conta`,
 * em texto. Só com sessão de cliente.
 */
export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-carteira", 60, 300);
  if (limite.erro) return limite.erro;
  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  try {
    return NextResponse.json(await carteiraDoClienteParaAApp(email), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cliente/carteira]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível ler a carteira." }, { status: 500 });
  }
}
