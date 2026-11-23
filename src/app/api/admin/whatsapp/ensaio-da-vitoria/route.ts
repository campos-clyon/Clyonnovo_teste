import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { accoesDoEnsaio, avaliarEnsaio, ensaiosNoPainel, interruptorDoEnsaio } from "@/lib/vitoria-agente/na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O ENSAIO DA VITÓRIA — d85, fase 0 (22-11-2026). Na secção WhatsApp.
 *
 * GET: os últimos ensaios — a mensagem do cliente (sem dados de pessoas), a
 * resposta real ao lado da do agente, o que ele teria feito, o custo; com
 * `?ensaio=<id>`, as acções desse ensaio, passo a passo. Só lê.
 *
 * POST { id, avaliacao: "melhor" | "pior" | null }: a equipa diz se a
 * resposta do agente estava melhor ou pior do que a real. Não muda nada na
 * conversa nem no pedido.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const ensaio = Number(req.nextUrl.searchParams.get("ensaio"));
  try {
    if (Number.isInteger(ensaio) && ensaio > 0) return NextResponse.json({ accoes: await accoesDoEnsaio(ensaio) });
    const [lista, interruptor] = await Promise.all([ensaiosNoPainel(50), interruptorDoEnsaio()]);
    return NextResponse.json({ ...lista, ligado: interruptor.ligado });
  } catch (e) {
    console.error("[admin/whatsapp/ensaio-da-vitoria]", e);
    return NextResponse.json({ ensaios: [], melhor: 0, pior: 0, avaliados: 0, porAvaliar: 0, ligado: false });
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
  const avaliacao = corpo.avaliacao === "melhor" || corpo.avaliacao === "pior" ? corpo.avaliacao : corpo.avaliacao === null ? null : undefined;
  if (!Number.isInteger(id) || id <= 0 || avaliacao === undefined) {
    return NextResponse.json({ error: "Diga qual o ensaio e se estava melhor ou pior." }, { status: 400 });
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
