import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { guardarGmailDoTeste, validarGmail } from "@/lib/app-pro-no-telemovel";

export const runtime = "nodejs";

/**
 * «O GMAIL DO MEU TELEMÓVEL É OUTRO» — 27-10-2026.
 *
 * O convite do teste da CLYON Pro pede para entrar com o Gmail da conta. Quem
 * tem outro no telemóvel escreve-o aqui, e a equipa põe-no na lista de
 * testadores da Play Console (backoffice → Profissionais → Gmails do teste).
 * A conta vem da sessão, nunca do corpo.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: { gmail?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const v = validarGmail(corpo.gmail);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });

  try {
    const ok = await guardarGmailDoTeste(sessao.providerId, v.gmail);
    if (!ok) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[profissionais/gmail-do-teste]", err);
    return NextResponse.json({ error: "Não consegui guardar o Gmail." }, { status: 500 });
  }
}
