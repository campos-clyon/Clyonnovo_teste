import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/cancelar-pelo-cliente — d126 (CEO e dono, 25-11-2026).
 *
 * O cliente pediu por escrito, na conversa, para cancelar estes pedidos, e a
 * Vitória não o fez (a conversa ficou com a equipa). Daqui, a equipa cancela-os
 * pelo MESMO caminho da conversa (`cancelarOsPedidosPelaConversa`: as guardas
 * do dinheiro e do acordo, o «não contactar», a anonimização, e UMA mensagem
 * com a pergunta do porquê) — nunca por outro. Só o admin geral.
 *
 * Corpo: { ids: number[] } — todos do mesmo número. A conversa volta à Vitória
 * (para ler a resposta ao porquê); se algum ficar com a equipa, volta a ficar
 * com a equipa, com o motivo à vista.
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(Number))].filter((n) => Number.isInteger(n) && n > 0) : [];
  if (ids.length === 0 || ids.length > 10) return NextResponse.json({ error: "Indique de 1 a 10 pedidos." }, { status: 400 });

  const base = await import("@/lib/cancelar-pelo-cliente-na-base");
  const { mesmoTelefoneEstrito } = await import("@/lib/validade-do-orcamento");
  const lidos = await Promise.all(ids.map((id) => base.lerOPedidoParaCancelar(id)));
  if (lidos.some((p) => !p)) return NextResponse.json({ error: "Um dos pedidos não existe." }, { status: 404 });
  const telefone = String(lidos[0]?.contactPhone ?? "");
  if (telefone.replace(/\D/g, "").length < 9 || lidos.some((p) => !mesmoTelefoneEstrito(p?.contactPhone ?? null, telefone))) {
    return NextResponse.json({ error: "Os pedidos têm de ser todos do mesmo número de telefone." }, { status: 409 });
  }

  const { retomarNumeroWhatsApp, interromperNumeroWhatsApp } = await import("@/lib/db");
  const { telefoneParaWhatsApp } = await import("@/lib/whatsapp-cloud");
  const tel = telefoneParaWhatsApp(telefone);
  await retomarNumeroWhatsApp(tel);
  const r = await base.cancelarOsPedidosPelaConversa(ids, tel);
  if (r.recusados.length > 0) {
    await interromperNumeroWhatsApp(
      tel,
      `O cliente quer cancelar, mas ${r.recusados.map((x) => `#${x.pedidoId}: ${x.porque}`).join("; ")} — tratar à mão`,
    ).catch(() => {});
  }
  return NextResponse.json({ ok: true, cancelados: r.cancelados, recusados: r.recusados, mensagemSaiu: r.mensagemSaiu, conversaApagada: r.conversaApagada });
}
