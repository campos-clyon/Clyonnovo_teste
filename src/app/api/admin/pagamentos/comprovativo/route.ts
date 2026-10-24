import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { trabalhosParaGerir } from "@/lib/trabalhos-para-gerir";
import { comprovativoEmPdf } from "@/lib/comprovativo-pdf";
import { nomeDoRecebimento } from "@/lib/dinheiro-do-trabalho";
import { nomeDeComoPagou } from "@/lib/pagamento-declarado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/pagamentos/comprovativo?negociacao=<id>&para=cliente|profissional
 *
 * O COMPROVATIVO EM PDF — 24-10-2026. *«Como geramos comprovativo em PDF de
 * pagamento aqui? … Crie essa função.»* — o dono, sobre o #476. O do cliente
 * só depois de o dinheiro dele contar como recebido; o do profissional só
 * depois de se lhe pagar. Os números são os dos Pagamentos
 * (`trabalhosParaGerir`), e o documento é o de `comprovativo-pdf.ts`.
 *
 * Só LÊ — aberto a quem tem os Pagamentos e a quem tem a Mesa, de onde também
 * se carrega (ver `papel-do-painel.ts`).
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
    const [t] = await trabalhosParaGerir(negociacaoId);
    if (!t || !t.conta) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    if (para === "cliente" && !t.recebido) {
      return NextResponse.json(
        { error: "O cliente ainda não pagou — o comprovativo sai depois de o pagamento entrar." },
        { status: 409 },
      );
    }
    if (para === "profissional" && !t.pagoEm) {
      return NextResponse.json({ error: "Ainda não se pagou ao profissional." }, { status: 409 });
    }
    const doCliente = para === "cliente";
    const bytes = await comprovativoEmPdf({
      para,
      pedidoId: t.pedidoId,
      cliente: t.cliente,
      telefoneDoCliente: t.telefoneDoCliente,
      cidade: t.cidade,
      servico: t.servico,
      profissional: t.profissional,
      dataDoTrabalho: t.dataDoTrabalho,
      semFactura: t.semFactura,
      conta: t.conta,
      pagoEm: doCliente ? (t.clientePagouEm ?? t.declarado?.em ?? t.confirmadoEm) : t.pagoEm,
      como: doCliente
        ? t.comoEntrou
          ? nomeDoRecebimento(t.comoEntrou)
          : t.declarado && t.declarado.como !== "ainda_nao"
            ? nomeDeComoPagou(t.declarado.como)
            : null
        : null,
    });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="comprovativo-${t.pedidoId}-${para}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[admin/pagamentos/comprovativo]", e);
    return NextResponse.json({ error: "Não foi possível gerar o comprovativo." }, { status: 500 });
  }
}
