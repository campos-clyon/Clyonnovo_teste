import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { estadoDasRotinas, contarVermelhas } from "@/lib/rotinas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS ROTINAS, no backoffice — 27-10-2026 (decisão d7).
 *
 * Uma linha por rotina da Vercel: a última passagem (há quantos segundos, no
 * relógio da base), se correu bem e porquê, e vermelha quando falhou ou
 * passou mais de 2× o intervalo sem passar (`rotinas.ts`). Só leitura, e só
 * do administrador: fora da lista do assistente (`papel-do-painel.ts`) e com
 * `requireAdminGeral` como segunda tranca.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const { ultimaPassagemDeCadaRotina } = await import("@/lib/licoes-da-vitoria-na-base");
    const { ultimas, carimbosHaSegundos } = await ultimaPassagemDeCadaRotina();
    const estados = estadoDasRotinas(ultimas, carimbosHaSegundos);
    return NextResponse.json({ estados, vermelhas: contarVermelhas(estados) });
  } catch (e) {
    console.error("[admin/rotinas GET]", e);
    return NextResponse.json({ error: "As rotinas não carregaram." }, { status: 500 });
  }
}
