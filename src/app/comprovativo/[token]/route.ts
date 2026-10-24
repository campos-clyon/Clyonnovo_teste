import { NextRequest, NextResponse } from "next/server";
import { comprovativoDoTrabalho, lerTokenDoComprovativo } from "@/lib/comprovativo-do-trabalho";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /comprovativo/<token> — O COMPROVATIVO QUE O CLIENTE ABRE. 24-10-2026.
 *
 * O link vai pelo WhatsApp da CLYON (`/api/admin/comprovativo`, POST). Sem
 * sessão: quem tem o link tem o recibo, como o link do pedido. O token é
 * assinado (`comprovativo-do-trabalho.ts`) — mudar-lhe o número não abre o
 * de outro pedido. Abre no browser (`inline`), e não fica nos motores de
 * busca.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lido = lerTokenDoComprovativo(token);
  const semIndice = { "X-Robots-Tag": "noindex, nofollow" };
  if (!lido) {
    return new NextResponse("Este link de comprovativo não é válido.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...semIndice },
    });
  }
  try {
    const r = await comprovativoDoTrabalho(lido.negociacaoId, lido.para);
    if (!r.ok) {
      return new NextResponse(r.erro, { status: r.estado, headers: { "Content-Type": "text/plain; charset=utf-8", ...semIndice } });
    }
    return new NextResponse(Buffer.from(r.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${r.nomeDoFicheiro}"`,
        "Cache-Control": "private, no-store",
        ...semIndice,
      },
    });
  } catch (e) {
    console.error("[comprovativo]", e);
    return new NextResponse("Não foi possível abrir o comprovativo. Tente daqui a pouco.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...semIndice },
    });
  }
}
