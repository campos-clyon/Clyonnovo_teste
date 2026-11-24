import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { confirmacaoDoRefazer, CONFIRMACAO_DO_REFAZER } from "@/lib/refazer-sem-reserva";
import { refazerSemReserva, trabalhosComReserva } from "@/lib/refazer-sem-reserva-na-base";
import { interruptorDaReserva } from "@/lib/reserva-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/admin/reserva-do-valor-unico/refazer — d101 (dono, 24-11-2026).
 *
 * GET: as negociações com reserva gravada (d39) e o estado da parte da CLYON
 * (pago / referência pendente / sem referência). Só números de pedido, de
 * negociação e valores.
 *
 * POST { "confirmacao": "REFAZER" }: com o interruptor desligado, para cada uma
 * cuja parte da CLYON não está paga, gera a referência nova pelo caminho de
 * sempre (`gerarReferenciaDaDivida`, já sem a reserva) e anula a velha por
 * pagar com o motivo «Reserva do valor único retirada (dono, 24/11/2026)» —
 * fica «cancelado», nunca se apaga; uma linha no histórico de cada pedido. As
 * pagas não se mexem: vêm em `pagas`, para o dono decidir. Não manda WhatsApp
 * nem email: a referência nova aparece ao parceiro no painel e na app.
 *
 * Só o administrador (`requireAdminGeral`).
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const [interruptor, trabalhos] = await Promise.all([interruptorDaReserva(), trabalhosComReserva()]);
    return NextResponse.json({ interruptor, trabalhos });
  } catch (e) {
    console.error("[admin/reserva-do-valor-unico/refazer] GET", e);
    return NextResponse.json({ error: "Não foi possível ler." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!confirmacaoDoRefazer(corpo)) {
    return NextResponse.json({ error: `Para refazer, escreva ${CONFIRMACAO_DO_REFAZER}.` }, { status: 400 });
  }
  try {
    const r = await refazerSemReserva({ id: colab?.id ?? null, nome: colab?.nome?.trim() || "administrador", papel: colab?.papel ?? null });
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 409 });
    return NextResponse.json({ ok: true, ...r.resultado });
  } catch (e) {
    console.error("[admin/reserva-do-valor-unico/refazer] POST", e);
    return NextResponse.json({ error: "Não foi possível refazer." }, { status: 500 });
  }
}
