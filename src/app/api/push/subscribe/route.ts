import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { perfilDoProfissional } from "@/lib/db";

/**
 * DE QUEM É ESTE BROWSER — do cliente ou do profissional?
 *
 * As duas rotas de push só conheciam a sessão do NextAuth, que é a do cliente.
 * O profissional tem sessão própria, por cookie, e por isso não conseguia
 * activar avisos nenhuns — o que deixava de fora exactamente a pessoa a quem os
 * avisos mais valem: numa plataforma onde cinco respondem ao mesmo pedido, quem
 * é avisado primeiro ganha o trabalho.
 *
 * A tabela `pushSubscriptions` guarda por email, e o profissional também tem
 * email. Não foi preciso tabela nova — foi preciso deixá-lo entrar.
 */
async function emailDeQuemPede(req: NextRequest): Promise<string | null> {
  const sessaoDoCliente = await getServerSession(authOptions);
  if (sessaoDoCliente?.user?.email) return sessaoDoCliente.user.email;

  const sessaoDoPro = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessaoDoPro) return null;
  const perfil = await perfilDoProfissional(sessaoDoPro.providerId);
  return typeof perfil?.email === "string" && perfil.email ? perfil.email : null;
}
import { savePushSubscription } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/push/subscribe — guarda a subscrição Web Push do cliente autenticado.
export async function POST(req: NextRequest) {
  const email = await emailDeQuemPede(req);
  if (!email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const sub = body?.subscription ?? body;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Subscrição incompleta." }, { status: 400 });
  }

  try {
    await savePushSubscription(email, { endpoint, p256dh, auth });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/push/subscribe]", err);
    return NextResponse.json({ error: "Erro ao guardar subscrição." }, { status: 500 });
  }
}
