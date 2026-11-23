import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { accoesDoEnsaio, avaliarEnsaio, ensaiosNoPainel, interruptorDoEnsaio } from "@/lib/vitoria-agente/na-base";
import { resumoDaRecolhaEmEnsaio } from "@/lib/vitoria-agente/recolha-em-ensaio-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O ENSAIO DA VITÓRIA — d85, fase 0 (22-11-2026). Na secção WhatsApp.
 *
 * GET: os últimos ensaios — a mensagem do cliente (sem dados de pessoas), a
 * resposta real ao lado da do agente, o que ele teria feito, o custo; com
 * `?ensaio=<id>`, as acções desse ensaio, passo a passo. Só lê.
 *
 * d99 (23-11-2026): `recolha` — a recolha em ensaio (ligada ou não, o tecto,
 * o gasto de hoje) e os cinco critérios para a fase 2, sobre os últimos 30
 * dias (campos do resumo iguais, fugas, avaliadas melhor/igual, custo por
 * pedido, prazo). Só com `?recolha=1`, só esses números.
 *
 * POST { id, avaliacao: "melhor" | "igual" | "pior" | null }: a equipa diz se
 * a resposta do agente estava melhor, igual ou pior do que a real. Não muda nada na
 * conversa nem no pedido.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const ensaio = Number(req.nextUrl.searchParams.get("ensaio"));
  try {
    if (Number.isInteger(ensaio) && ensaio > 0) return NextResponse.json({ accoes: await accoesDoEnsaio(ensaio) });
    if (req.nextUrl.searchParams.get("recolha") === "1") return NextResponse.json({ recolha: await resumoDaRecolhaEmEnsaio(30) });
    const [lista, interruptor, recolha] = await Promise.all([
      ensaiosNoPainel(50),
      interruptorDoEnsaio(),
      resumoDaRecolhaEmEnsaio(30).catch(() => null),
    ]);
    return NextResponse.json({ ...lista, ligado: interruptor.ligado, recolha });
  } catch (e) {
    console.error("[admin/whatsapp/ensaio-da-vitoria]", e);
    return NextResponse.json({ ensaios: [], melhor: 0, igual: 0, pior: 0, avaliados: 0, porAvaliar: 0, ligado: false, recolha: null });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  let corpo: { id?: unknown; avaliacao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const id = Number(corpo.id);
  const avaliacao =
    corpo.avaliacao === "melhor" || corpo.avaliacao === "igual" || corpo.avaliacao === "pior" ? corpo.avaliacao : corpo.avaliacao === null ? null : undefined;
  if (!Number.isInteger(id) || id <= 0 || avaliacao === undefined) {
    return NextResponse.json({ error: "Diga qual o ensaio e se estava melhor, igual ou pior." }, { status: 400 });
  }
  try {
    const ok = await avaliarEnsaio(id, avaliacao, colab?.nome?.trim() || "equipa");
    if (!ok) return NextResponse.json({ error: "Ensaio não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/whatsapp/ensaio-da-vitoria POST]", e);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
