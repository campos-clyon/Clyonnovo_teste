import { NextRequest, NextResponse } from "next/server";
import { deletePushSubscription, getPushSubscriptionsByEmail, savePushSubscription } from "@/lib/db";
import { emailDoCliente } from "@/lib/cliente-auth";
import { eTokenDaApp } from "@/lib/push-nativo";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * R6 — O TELEMÓVEL DO CLIENTE PASSA A RECEBER AVISOS (d8, 28-10-2026).
 *
 * A app de cliente chama isto depois de ele dar a permissão, com o token que a
 * Expo lhe deu. Guarda-se na tabela das subscrições pelo email da sessão, com
 * `app: "cliente"` (d12, 25-10-2026): os avisos do cliente saem com
 * `sendPushToUser(email, aviso, "cliente")` e nunca tocam na CLYON Pro do
 * mesmo email.
 *
 * O email vem da sessão, nunca do corpo: se viesse do corpo, bastava trocá-lo
 * para receber no telemóvel os avisos dos pedidos de outra pessoa.
 *
 * `DELETE` com o mesmo corpo tira o telemóvel («Sair», ou desligar os avisos),
 * e só se o telemóvel for desta conta. Apagar a conta já os tira a todos.
 */
async function lerToken(req: NextRequest): Promise<string | null> {
  try {
    const corpo = (await req.json()) as { token?: unknown };
    return eTokenDaApp(corpo.token) ? corpo.token : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-dispositivo", 20, 600);
  if (limite.erro) return limite.erro;

  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const porConta = await limitarPorConta("cliente-dispositivo-conta", email, 20, 600);
  if (porConta.erro) return porConta.erro;

  const token = await lerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Token da app inválido." }, { status: 400 });

  try {
    // Se o telemóvel já era de outra conta, passa a ser desta: o mesmo token
    // não recebe avisos de duas pessoas.
    await savePushSubscription(email, { endpoint: token, p256dh: "", auth: "" }, "cliente");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cliente/dispositivo POST]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não consegui guardar o telemóvel." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-dispositivo-apagar", 20, 600);
  if (limite.erro) return limite.erro;

  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const porConta = await limitarPorConta("cliente-dispositivo-apagar-conta", email, 20, 600);
  if (porConta.erro) return porConta.erro;

  const token = await lerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Token da app inválido." }, { status: 400 });

  try {
    // Só o telemóvel desta conta: um token de outra pessoa não se cala daqui.
    const meus = await getPushSubscriptionsByEmail(email);
    if (meus.some((s) => s.endpoint === token)) await deletePushSubscription(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cliente/dispositivo DELETE]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não consegui apagar o telemóvel." }, { status: 500 });
  }
}
