import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { motivoDeTirar } from "@/lib/tirar-a-empresa";
import { tirarAEmpresaDoTrabalho } from "@/lib/tirar-a-empresa-na-base";

export const runtime = "nodejs";

/**
 * TIRAR A EMPRESA E PEDIR PROPOSTAS DE NOVO — d137 (26-11-2026; o #595).
 *
 * Um Trabalho CLYON atribuído (ou um contratado da Mesa) que não foi feito, sem
 * dinheiro em jogo: a empresa sai e é avisada, e o pedido volta a «à espera»
 * (na Mesa, às propostas). Não reenvia nada — o caminho a seguir escolhe-o a
 * pessoa. As regras em `tirar-a-empresa.ts`; a base em `tirar-a-empresa-na-base.ts`.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown; motivo?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const r = await tirarAEmpresaDoTrabalho(pedidoId, motivoDeTirar(corpo.motivo), {
      quem: colab?.nome ?? "a CLYON",
      por: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
    });
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado });
    return NextResponse.json(r);
  } catch (e) {
    console.error("[api/admin/negociacoes/tirar-empresa]", e);
    return NextResponse.json({ error: "Não foi possível tirar a empresa do trabalho." }, { status: 500 });
  }
}
