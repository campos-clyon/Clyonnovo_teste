import { NextRequest, NextResponse } from "next/server";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import {
  contaConfirmada,
  gastarLinkDaConta,
  gravarPalavraPasseDoCliente,
} from "@/lib/conta-com-palavra-passe";
import { porSessaoDoClienteNoSite } from "@/lib/sessao-do-cliente-no-site";
import { MENSAGEM_DO_LINK } from "@/lib/palavra-passe-do-cliente";

export const runtime = "nodejs";

/**
 * CONFIRMAR O EMAIL DO REGISTO — 01-11-2026. Chamada pela página
 * /entrar/confirmar-email (o link do email), com `{ token }`.
 *
 * Gasta o link (uso único, 24 h), cria a conta se ainda não existir e passa
 * para ela a palavra-passe que esperava junto do link. Só AQUI o email fica
 * confirmado — e só aqui há sessão: o cookie do site, como no Google. Na app,
 * a pessoa entra a seguir com o email e a palavra-passe.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "entrada-confirmar-ip", 20, 900);
  if (limite.erro) return limite.erro;

  let corpo: { token?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const r = await gastarLinkDaConta(corpo?.token, ["registo"]);
    if (!r.ok) {
      console.warn(`[entrada/confirmar] link recusado: ${r.motivo}`);
      return NextResponse.json({ ok: false, motivo: r.motivo, error: MENSAGEM_DO_LINK[r.motivo] }, { status: 410 });
    }
    const { email, nome, passwordHashPendente } = r.link;
    if (!passwordHashPendente) {
      return NextResponse.json(
        { ok: false, motivo: "desconhecido", error: MENSAGEM_DO_LINK.desconhecido },
        { status: 410 },
      );
    }
    const userId = await contaConfirmada(email, nome);
    await gravarPalavraPasseDoCliente(userId, passwordHashPendente);
    console.info(`[entrada/confirmar] conta ${userId} confirmada`);

    const resposta = NextResponse.json({ ok: true, email });
    await porSessaoDoClienteNoSite(resposta, { email, nome });
    return resposta;
  } catch (err) {
    console.error("[entrada/confirmar] falhou:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível confirmar agora. Tente outra vez daqui a um minuto." },
      { status: 500 },
    );
  }
}
