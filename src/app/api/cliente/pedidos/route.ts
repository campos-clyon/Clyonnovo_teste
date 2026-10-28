import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { listaDosPedidosDoCliente } from "@/lib/pedidos-do-cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * R4 — «OS SEUS PEDIDOS» NA APP DE CLIENTE (d8, 28-10-2026).
 *
 * A lista resumida: serviço, cidade, estado em palavras e a novidade que
 * espera por ele. Sem morada, sem histórico, sem negociações, sem dinheiro —
 * isso é no pedido (`/api/cliente/pedidos/[id]`).
 *
 * Só os pedidos do email da sessão (cookie do site ou Bearer da app, pelo
 * leitor único `emailDoCliente`). Sem sessão válida, 401.
 */
export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-pedidos", 120, 300);
  if (limite.erro) return limite.erro;

  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const pagina = Number.parseInt(req.nextUrl.searchParams.get("pagina") ?? "1", 10) || 1;
  try {
    const r = await listaDosPedidosDoCliente(email, pagina);
    return NextResponse.json(
      { ok: true, ...r },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[cliente/pedidos]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível ler os pedidos." }, { status: 500 });
  }
}
