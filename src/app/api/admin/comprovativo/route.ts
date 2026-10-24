import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { appendOrderHistory, numeroBloqueadoWhatsApp, retomarNumeroWhatsApp } from "@/lib/db";
import { enviarTextoManualWhatsApp } from "@/lib/whatsapp-cloud";
import {
  comprovativoDoTrabalho,
  linkDoComprovativo,
  mensagemDoComprovativo,
} from "@/lib/comprovativo-do-trabalho";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O COMPROVATIVO EM PDF — 24-10-2026, ver `comprovativo-do-trabalho.ts`.
 *
 * GET  ?negociacao=<id>&para=cliente|profissional — descarrega o PDF.
 * POST { negociacao } — *«Coloque o botão enviar comprovativo, que envia
 *      directamente ao cliente.»* — o dono. Vai pelo WhatsApp da CLYON uma
 *      mensagem com o link do comprovativo (`/comprovativo/<token>`), que o
 *      cliente abre no telemóvel. O número é o do pedido, lido aqui.
 *
 * Aberta aos Pagamentos e à Mesa, de onde se carrega (`papel-do-painel.ts`).
 * Não mexe em dinheiro: lê, e manda uma mensagem.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const q = new URL(req.url).searchParams;
  const negociacaoId = Number(q.get("negociacao"));
  const para = q.get("para");
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  if (para !== "cliente" && para !== "profissional") {
    return NextResponse.json({ error: "Diga se é o do cliente ou o do profissional." }, { status: 400 });
  }
  try {
    const r = await comprovativoDoTrabalho(negociacaoId, para);
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado });
    return new NextResponse(Buffer.from(r.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${r.nomeDoFicheiro}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[admin/comprovativo]", e);
    return NextResponse.json({ error: "Não foi possível gerar o comprovativo." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacao);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  try {
    // Gera-o primeiro: as mesmas regras do PDF (o cliente já pagou?) decidem se se envia.
    const r = await comprovativoDoTrabalho(negociacaoId, "cliente");
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado });
    const t = r.trabalho;
    const telefone = String(t.telefoneDoCliente ?? "");
    if (telefone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "O pedido não tem telemóvel." }, { status: 400 });
    }
    const link = linkDoComprovativo(negociacaoId, "cliente");
    if (!link) return NextResponse.json({ error: "Falta o segredo do servidor para assinar o link." }, { status: 500 });
    if (await numeroBloqueadoWhatsApp(telefone)) {
      return NextResponse.json(
        { error: "Este número está bloqueado. Desbloqueie-o primeiro, no ecrã do WhatsApp." },
        { status: 409 },
      );
    }
    const saiu = await enviarTextoManualWhatsApp(telefone, mensagemDoComprovativo(t, link));
    if (!saiu) {
      return NextResponse.json(
        {
          error:
            "Não saiu. Ou não há canal configurado, ou a janela de 24 horas desde a última mensagem dele já fechou — descarregue o PDF e mande-o do seu WhatsApp.",
        },
        { status: 400 },
      );
    }
    await retomarNumeroWhatsApp(telefone);
    const resumo = `Comprovativo de pagamento enviado ao cliente pelo WhatsApp da CLYON, por ${colab?.nome ?? "a CLYON"}.`;
    await appendOrderHistory(t.pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: resumo,
    });
    return NextResponse.json({ ok: true, feito: `#${t.pedidoId}: comprovativo enviado ao cliente.` });
  } catch (e) {
    console.error("[admin/comprovativo] enviar", e);
    return NextResponse.json({ error: "Não foi possível enviar o comprovativo." }, { status: 500 });
  }
}
