import { NextRequest, NextResponse } from "next/server";
import { deletePushSubscription, getPushSubscriptionsByEmail, perfilDoProfissional, savePushSubscription } from "@/lib/db";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { eTokenDaApp } from "@/lib/push-nativo";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * O TELEMÓVEL DO PROFISSIONAL PASSA A RECEBER AVISOS — 18-10-2026.
 *
 * A app CLYON Pro chama isto depois de ele entrar e de dar a permissão, com o
 * token que a Expo lhe deu. Guarda-se na tabela das subscrições do navegador,
 * pelo email da conta (ver `push-nativo.ts`): daí em diante, cada aviso que o
 * site já manda ao profissional chega também ao telemóvel.
 *
 * O email vem da sessão, nunca do corpo: se viesse do corpo, bastava trocá-lo
 * para receber no telemóvel os pedidos de outro profissional.
 */
async function emailDaConta(providerId: number): Promise<string | null> {
  const perfil = await perfilDoProfissional(providerId);
  return typeof perfil?.email === "string" && perfil.email ? perfil.email : null;
}

async function lerToken(req: NextRequest): Promise<string | null> {
  try {
    const corpo = (await req.json()) as { token?: unknown };
    return eTokenDaApp(corpo.token) ? corpo.token : null;
  } catch {
    return null;
  }
}

/**
 * JÁ TEM A APP? — 23-10-2026. O painel pergunta, para só convidar para o teste
 * da CLYON Pro quem ainda não a instalou (ver ConviteDaAppPro.tsx). Diz só
 * sim ou não: os tokens dos telemóveis não saem daqui.
 */
export async function GET(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const email = await emailDaConta(sessao.providerId);
    const subs = email ? await getPushSubscriptionsByEmail(email) : [];
    return NextResponse.json({ temApp: subs.some((s) => eTokenDaApp(s.endpoint)) });
  } catch (err) {
    console.error("[profissionais/dispositivo GET]", err);
    return NextResponse.json({ error: "Não consegui ver os telemóveis." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Só uma conta que ainda pode entrar no painel liga avisos novos.
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const token = await lerToken(req);
  if (!token) return NextResponse.json({ error: "Token da app inválido." }, { status: 400 });

  try {
    const email = await emailDaConta(sessao.providerId);
    if (!email) return NextResponse.json({ error: "A conta não tem email." }, { status: 409 });
    // Se o telemóvel já era de outra conta, passa a ser desta: o mesmo token
    // não recebe avisos de duas pessoas.
    await savePushSubscription(email, { endpoint: token, p256dh: "", auth: "" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[profissionais/dispositivo POST]", err);
    return NextResponse.json({ error: "Não consegui guardar o telemóvel." }, { status: 500 });
  }
}

/**
 * Sair da app apaga o telemóvel da lista.
 *
 * Aqui a prova é o próprio token do telemóvel, e não a sessão: só a app o tem
 * (nunca sai do telemóvel nem é mostrado), e uma conta entretanto suspensa —
 * ou uma sessão que já caducou — tem de continuar a poder dizer «não me
 * mandem mais nada». O pior que um token roubado faz aqui é calar avisos.
 */
export async function DELETE(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "profissional-dispositivo-apagar", 20, 600);
  if (limite.erro) return limite.erro;

  const token = await lerToken(req);
  if (!token) return NextResponse.json({ error: "Token da app inválido." }, { status: 400 });

  try {
    await deletePushSubscription(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[profissionais/dispositivo DELETE]", err);
    return NextResponse.json({ error: "Não consegui apagar o telemóvel." }, { status: 500 });
  }
}
