import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth-helper";
import { chaveDaEquipa } from "@/lib/avisos-a-equipa-na-base";
import { deletePushSubscription, getPushSubscriptionsByEmail, savePushSubscription } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/admin/sessao/avisos — «Avisos no telemóvel» do backoffice (d23,
 * 10-11-2026).
 *
 * Liga ou desliga, NESTE navegador, os avisos à equipa do que está parado
 * (ver `avisos-a-equipa.ts`). A subscrição fica com a chave da conta de quem
 * chama (`equipa:<id>`, sempre da sessão, nunca do corpo), e não com um email:
 * não se mistura com a de um cliente ou de um profissional. Quem recebe o quê
 * decide-se ao enviar, pelas secções da conta naquele momento — uma secção
 * retirada às 10h deixa de avisar às 10h.
 *
 * Fica em «sessao» porque é da própria conta, como o «quem sou eu»: qualquer
 * conta do backoffice liga os seus avisos. Só POST — o DELETE está fechado às
 * assistentes em todas as rotas.
 *
 *   { accao: "ligar", subscription: { endpoint, keys: { p256dh, auth } } }
 *   { accao: "desligar", endpoint }
 *   { accao: "estado", endpoint } → { ligado }
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: {
    accao?: unknown;
    endpoint?: unknown;
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const chave = chaveDaEquipa(colab.id);

  try {
    if (corpo.accao === "ligar") {
      const s = corpo.subscription;
      const endpoint = typeof s?.endpoint === "string" ? s.endpoint : "";
      const p256dh = typeof s?.keys?.p256dh === "string" ? s.keys.p256dh : "";
      const auth = typeof s?.keys?.auth === "string" ? s.keys.auth : "";
      if (!endpoint.startsWith("https://") || !p256dh || !auth || endpoint.length > 600) {
        return NextResponse.json({ error: "Subscrição incompleta." }, { status: 400 });
      }
      await savePushSubscription(chave, { endpoint, p256dh, auth });
      return NextResponse.json({ ok: true, ligado: true });
    }

    const endpoint = typeof corpo.endpoint === "string" ? corpo.endpoint : "";
    if (!endpoint) return NextResponse.json({ error: "Falta o aparelho." }, { status: 400 });
    // Só os aparelhos desta conta: nunca se apaga nem se lê o de outra pessoa.
    const minhas = await getPushSubscriptionsByEmail(chave);
    const meu = minhas.some((m) => m.endpoint === endpoint);

    if (corpo.accao === "desligar") {
      if (meu) await deletePushSubscription(endpoint);
      return NextResponse.json({ ok: true, ligado: false });
    }
    if (corpo.accao === "estado") return NextResponse.json({ ok: true, ligado: meu });
    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  } catch (e) {
    console.error("[admin/sessao/avisos]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível guardar os avisos." }, { status: 500 });
  }
}
