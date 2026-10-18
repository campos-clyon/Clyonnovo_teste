import { NextRequest, NextResponse } from "next/server";
import { getPushSubscriptionsByEmail, perfilDoProfissional } from "@/lib/db";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { eTokenDaApp } from "@/lib/push-nativo";
import { sendPushToUser } from "@/lib/webpush";

export const runtime = "nodejs";

/**
 * «ENVIAR UM AVISO DE TESTE» — 18-10-2026.
 *
 * O profissional carrega no botão da app e o telemóvel dele toca. É a prova
 * de que os avisos chegam, sem ter de esperar por um pedido verdadeiro — e o
 * primeiro sítio onde se vê se as definições do telemóvel os estão a calar.
 *
 * Não é um quinto momento de aviso (ver `avisar-por-push.ts`): só sai quando
 * ele o pede, e só para ele.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limite = await limitarRotaPublica(req, "profissional-aviso-de-teste", 5, 600);
  if (limite.erro) return limite.erro;

  try {
    const perfil = await perfilDoProfissional(sessao.providerId);
    const email = typeof perfil?.email === "string" ? perfil.email : "";
    if (!email) return NextResponse.json({ error: "A conta não tem email." }, { status: 409 });

    const telemoveis = (await getPushSubscriptionsByEmail(email)).filter((s) => eTokenDaApp(s.endpoint)).length;
    if (telemoveis === 0) {
      return NextResponse.json(
        { error: "Este telemóvel ainda não está registado. Carregue primeiro em «Ligar os avisos».", telemoveis },
        { status: 409 },
      );
    }

    await sendPushToUser(email, {
      title: "Avisos ligados",
      body: "É assim que lhe chega um pedido novo. Toque para abrir os seus trabalhos.",
      tag: "aviso-de-teste",
    });
    return NextResponse.json({ ok: true, telemoveis });
  } catch (err) {
    console.error("[profissionais/aviso-de-teste]", err);
    return NextResponse.json({ error: "Não foi possível enviar o aviso." }, { status: 500 });
  }
}
