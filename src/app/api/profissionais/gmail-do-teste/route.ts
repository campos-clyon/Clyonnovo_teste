import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { gmailDoTesteDe, guardarGmailDoTeste, validarGmail } from "@/lib/app-pro-no-telemovel";
import { listaDaPlayGuardada } from "@/lib/quem-conta-para-os-12-na-base";
import { estaNaListaDaPlay } from "@/lib/lista-da-play-e-o-profissional";

export const runtime = "nodejs";

/**
 * «O GMAIL DO MEU TELEMÓVEL É OUTRO» — 27-10-2026.
 *
 * O convite do teste da CLYON Pro pede para entrar com o Gmail da conta. Quem
 * tem outro no telemóvel escreve-o aqui, e a equipa põe-no na lista de
 * testadores da Play Console (backoffice → Profissionais → Gmails do teste).
 * A conta vem da sessão, nunca do corpo.
 */
/**
 * O que a adesão em passos (/app-pro, 17-11-2026) precisa de saber: se há
 * sessão de profissional, o Gmail que já deixou e o email da conta (para
 * pré-preencher, se for Gmail). Sem sessão: 401, e a página diz-lhe para
 * entrar primeiro.
 */
/**
 * O Gmail (ou o email da conta) está na última lista da Play colada no
 * backoffice? — 18-11-2026 (d6). Sem lista colada: false (o passo 3 diz que
 * avisamos). Se a lista não se lê: null (o passo 3 fica como sempre).
 */
async function naListaDaPlay(emails: Array<string | null | undefined>): Promise<boolean | null> {
  try {
    const lista = await listaDaPlayGuardada("pro");
    return estaNaListaDaPlay(emails, lista.emails);
  } catch (e) {
    console.error("[profissionais/gmail-do-teste] lista da Play:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const d = await gmailDoTesteDe(sessao.providerId);
    if (!d) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
    const naLista = await naListaDaPlay([d.gmail, d.emailDaConta]);
    return NextResponse.json({ ok: true, ...d, naListaDaPlay: naLista }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[profissionais/gmail-do-teste GET]", err);
    return NextResponse.json({ error: "Não consegui ler." }, { status: 500 });
  }
}

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
    return NextResponse.json({ ok: true, naListaDaPlay: await naListaDaPlay([v.gmail, (await gmailDoTesteDe(sessao.providerId))?.emailDaConta]) });
  } catch (err) {
    console.error("[profissionais/gmail-do-teste]", err);
    return NextResponse.json({ error: "Não consegui guardar o Gmail." }, { status: 500 });
  }
}
