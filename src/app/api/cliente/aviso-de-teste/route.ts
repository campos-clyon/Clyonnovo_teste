import { NextRequest, NextResponse } from "next/server";
import { deletePushSubscription, getPushSubscriptionsByEmail } from "@/lib/db";
import { emailDoCliente } from "@/lib/cliente-auth";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { aparelhosDaApp, enviarAvisoNaApp, explicarErroDoAviso, recibosDaExpo } from "@/lib/push-nativo";

export const runtime = "nodejs";

/** Quantas vezes, e com que intervalo, se pergunta pelo recibo da entrega. */
const TENTATIVAS = 3;
const ESPERA_MS = 2000;

/**
 * «ENVIAR UM AVISO DE TESTE» NA APP DE CLIENTE — d5, 31-10-2026.
 *
 * Igual à da CLYON Pro (`/api/profissionais/aviso-de-teste`): o cliente
 * carrega no botão do Perfil e o telemóvel dele toca. Diz a verdade — espera
 * pelo recibo da Expo (até ~6 s) e devolve o motivo quando o aviso não passou
 * (sem a chave FCM V1 no projecto clyon-cliente, a Expo aceita e o telemóvel
 * fica calado).
 *
 * O email vem da sessão de cliente, nunca do corpo; só os telemóveis da app
 * de cliente (`app: "cliente"`) recebem — a CLYON Pro do mesmo email fica
 * calada. Travão por endereço e por conta.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-aviso-de-teste", 5, 600);
  if (limite.erro) return limite.erro;

  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const porConta = await limitarPorConta("cliente-aviso-de-teste-conta", email, 5, 600);
  if (porConta.erro) return porConta.erro;

  try {
    const tokens = aparelhosDaApp(await getPushSubscriptionsByEmail(email), "cliente");
    if (tokens.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Este telemóvel ainda não está registado. Ligue primeiro «Avisos no telemóvel».", telemoveis: 0 },
        { status: 409 },
      );
    }

    const bilhetes = await enviarAvisoNaApp(
      tokens,
      {
        title: "Avisos ligados",
        body: "É assim que lhe chega uma proposta nova. Toque para abrir a app.",
        tag: "aviso-de-teste",
      },
      { para: "cliente", esquecer: deletePushSubscription },
    );

    const recusado = bilhetes.find((b) => b.erro);
    if (recusado && bilhetes.every((b) => b.erro)) {
      return NextResponse.json(
        { ok: false, error: explicarErroDoAviso(recusado.erro!, "cliente"), codigo: recusado.erro, telemoveis: tokens.length },
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
          { ok: false, error: explicarErroDoAviso(falhou.erro ?? "Erro", "cliente"), codigo: falhou.erro, telemoveis: tokens.length },
          { status: 502 },
        );
      }
    }
    // A Expo aceitou, mas o recibo ainda não chegou: não se diz que chegou.
    return NextResponse.json({ ok: true, entregue: false, telemoveis: tokens.length });
  } catch (err) {
    console.error("[cliente/aviso-de-teste]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível enviar o aviso." }, { status: 500 });
  }
}
