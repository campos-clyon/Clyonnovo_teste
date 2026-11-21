import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { falarComOCliente, pararSeguimentoAMao, seguimentoNaMesa } from "@/lib/seguimento-do-cliente-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O SEGUIMENTO DO CLIENTE NA MESA — d83, 21-11-2026.
 *
 * GET: o seguimento de cada pedido marcado («Seguimento: 1.ª mensagem a 22/11
 * às 10h · …», os «Falei com o cliente» guardados, e se está em curso — os em
 * curso saem da conta do «Precisa de si»).
 *
 * POST `{ pedidoId, accao: "falei", resposta, nota?, dia?, hora? }`: o «Falei
 * com o cliente» (o dia e a hora de Lisboa do «voltar a contactar»; no «Quer
 * cancelar», cancela já). POST `{ pedidoId, accao: "parar" }`: o «Parar o
 * seguimento». Quem carregou fica guardado.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    return NextResponse.json(await seguimentoNaMesa());
  } catch (e) {
    console.error("[admin/seguimento-do-cliente GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler o seguimento dos clientes." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  let corpo: { pedidoId?: unknown; accao?: unknown; resposta?: unknown; nota?: unknown; dia?: unknown; hora?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const porQuem = colab?.nome?.trim() || "a equipa";
  try {
    const r =
      corpo.accao === "parar"
        ? await pararSeguimentoAMao(pedidoId, porQuem, new Date())
        : corpo.accao === "falei"
          ? await falarComOCliente(
              {
                pedidoId,
                resposta: corpo.resposta,
                nota: corpo.nota,
                dia: corpo.dia,
                hora: corpo.hora,
                porQuem,
                colab: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
              },
              new Date(),
            )
          : { ok: false as const, porque: "Pedido inválido." };
    if (!r.ok) return NextResponse.json({ error: r.porque }, { status: 409 });
    return NextResponse.json({ ok: true, feito: `#${pedidoId}: ${r.feito}` });
  } catch (e) {
    console.error("[admin/seguimento-do-cliente POST]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível guardar o seguimento." }, { status: 500 });
  }
}
