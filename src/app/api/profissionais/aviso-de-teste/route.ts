import { NextRequest, NextResponse } from "next/server";
import { deletePushSubscription, getPushSubscriptionsByEmail, perfilDoProfissional } from "@/lib/db";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { enviarAvisoNaApp, eTokenDaApp, explicarErroDoAviso, recibosDaExpo } from "@/lib/push-nativo";

export const runtime = "nodejs";

/** Quantas vezes, e com que intervalo, se pergunta pelo recibo da entrega. */
const TENTATIVAS = 3;
const ESPERA_MS = 2000;

/**
 * «ENVIAR UM AVISO DE TESTE» — 18-10-2026.
 *
 * O profissional carrega no botão da app e o telemóvel dele toca. É a prova
 * de que os avisos chegam, sem ter de esperar por um pedido verdadeiro.
 *
 * DIZ A VERDADE, e não só «enviado». A primeira versão respondia «enviado»
 * assim que a Expo aceitava o aviso — e o telemóvel ficava calado, porque
 * faltava a chave do Firebase do lado da Expo. Aceitar não é entregar: quem
 * diz se chegou é o recibo, que aparece uns segundos depois. Esta rota espera
 * por ele (até ~6 s) e devolve o motivo quando o aviso não passou.
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

    const tokens = (await getPushSubscriptionsByEmail(email)).map((s) => s.endpoint).filter(eTokenDaApp);
    if (tokens.length === 0) {
      return NextResponse.json(
        { error: "Este telemóvel ainda não está registado. Carregue primeiro em «Ligar os avisos».", telemoveis: 0 },
        { status: 409 },
      );
    }

    const bilhetes = await enviarAvisoNaApp(
      tokens,
      {
        title: "Avisos ligados",
        body: "É assim que lhe chega um pedido novo. Toque para abrir os seus trabalhos.",
        tag: "aviso-de-teste",
      },
      { esquecer: deletePushSubscription },
    );

    const recusado = bilhetes.find((b) => b.erro);
    if (recusado && bilhetes.every((b) => b.erro)) {
      return NextResponse.json(
        { error: explicarErroDoAviso(recusado.erro!), codigo: recusado.erro, telemoveis: tokens.length },
        { status: 502 },
      );
    }

    const ids = bilhetes.map((b) => b.id).filter((id): id is string => !!id);
    for (let i = 0; i < TENTATIVAS; i++) {
      await new Promise((r) => setTimeout(r, ESPERA_MS));
      const recibos = await recibosDaExpo(ids);
      const lidos = ids.map((id) => recibos[id]).filter(Boolean);
      if (lidos.some((r) => r.ok)) {
        return NextResponse.json({ ok: true, entregue: true, telemoveis: tokens.length });
      }
      const falhou = lidos.find((r) => !r.ok);
      if (falhou && lidos.length === ids.length) {
        return NextResponse.json(
          { error: explicarErroDoAviso(falhou.erro ?? "Erro"), codigo: falhou.erro, telemoveis: tokens.length },
          { status: 502 },
        );
      }
    }
    // A Expo aceitou, mas o recibo ainda não chegou: não se diz que chegou.
    return NextResponse.json({ ok: true, entregue: false, telemoveis: tokens.length });
  } catch (err) {
    console.error("[profissionais/aviso-de-teste]", err);
    return NextResponse.json({ error: "Não foi possível enviar o aviso." }, { status: 500 });
  }
}
