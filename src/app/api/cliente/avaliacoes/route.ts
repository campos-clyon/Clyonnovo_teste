import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { avaliacoesRecebidasPeloCliente } from "@/lib/avaliacoes-do-cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS AVALIAÇÕES QUE O CLIENTE RECEBEU DOS PARCEIROS (29-10-2026) — «As minhas
 * avaliações» no Perfil da app de cliente. Só com sessão de cliente, e só as
 * dele: nunca as que ele deu. Ver `src/lib/avaliacoes-do-cliente.ts`.
 */
export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-avaliacoes", 60, 300);
  if (limite.erro) return limite.erro;
  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  try {
    return NextResponse.json(await avaliacoesRecebidasPeloCliente(email), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cliente/avaliacoes]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível ler as avaliações." }, { status: 500 });
  }
}
