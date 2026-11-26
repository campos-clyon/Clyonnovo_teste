import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { idDoProfissional } from "@/lib/aviso-da-app-pro";
import { avisarNaAppPro } from "@/lib/aviso-da-app-pro-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * «AVISAR NO WHATSAPP» QUEM NÃO USA A CLYON PRO — d134 (26-11-2026). Só o
 * administrador (`requireAdminGeral`), como o quadro.
 *
 * POST { providerId, texto } → envia UM aviso pelo WhatsApp da plataforma,
 * com o texto que o administrador viu e carregou em «Enviar». Só a quem está
 * em «Nunca entrou» ou «Instalou e parou», um por dia de Lisboa, e fica no
 * histórico do profissional (quem, quando). O «Avisar todos» chama esta rota
 * um a um, com intervalo entre envios.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { providerId?: unknown; texto?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const providerId = idDoProfissional(corpo?.providerId);
  if (!providerId) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const r = await avisarNaAppPro({
      providerId,
      texto: corpo.texto,
      porQuem: String(colab?.nome ?? "").trim() || "administrador",
      porId: colab?.id ?? null,
    });
    if (!r.ok) return NextResponse.json({ error: r.error, avisadoEm: r.avisadoEm ?? null }, { status: r.status });
    return NextResponse.json({ ok: true, avisadoEm: r.avisadoEm });
  } catch (e) {
    console.error("[admin/quem-conta-para-os-12/avisar]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui enviar o aviso." }, { status: 500 });
  }
}
