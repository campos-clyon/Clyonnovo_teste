import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { cortarSessoesDoCliente } from "@/lib/db";

export const runtime = "nodejs";

/**
 * «SAIR DE TODOS OS APARELHOS» (S22, 29-10-2026): todas as sessões da app de
 * cliente desta conta deixam de valer, esta incluída. A sessão do site
 * (cookie) não é tocada.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-sair-de-todos", 10, 300);
  if (limite.erro) return limite.erro;
  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  try {
    await cortarSessoesDoCliente(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cliente/sair-de-todos]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível sair agora. Tente outra vez." }, { status: 500 });
  }
}
