import { NextRequest, NextResponse } from "next/server";
import { hashDaPalavraPasse, validarPalavraPasse } from "@/lib/profissional-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import {
  contaDoClientePorEmail,
  gastarLinkDaConta,
  gravarPalavraPasseDoCliente,
  linkDaContaAindaServe,
  registarEntradaDoCliente,
} from "@/lib/conta-com-palavra-passe";
import { porSessaoDoClienteNoSite } from "@/lib/sessao-do-cliente-no-site";
import { MENSAGEM_DO_LINK, type TipoDoLink } from "@/lib/palavra-passe-do-cliente";

export const runtime = "nodejs";

/**
 * ESCOLHER A PALAVRA-PASSE PELO LINK DO EMAIL — 01-11-2026. Chamada pela
 * página /entrar/repor (links «definir» e «repor»).
 *
 *   · `{ token, verificar: true }` → só diz se o link ainda serve (não o gasta);
 *   · `{ token, palavraPasse }`    → valida a palavra-passe ANTES de gastar o
 *     link (um erro de escrita não o queima), gasta-o, grava e abre a sessão
 *     do site.
 */
const TIPOS: readonly TipoDoLink[] = ["definir", "repor"];

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "entrada-repor-ip", 20, 900);
  if (limite.erro) return limite.erro;

  let corpo: { token?: unknown; palavraPasse?: unknown; verificar?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  try {
    if (corpo.verificar === true) {
      const v = await linkDaContaAindaServe(corpo.token, TIPOS);
      if (!v.ok) return NextResponse.json({ ok: false, motivo: v.motivo, error: MENSAGEM_DO_LINK[v.motivo] }, { status: 410 });
      return NextResponse.json({ ok: true, tipo: v.tipo });
    }

    const erro = validarPalavraPasse(corpo.palavraPasse);
    if (erro) return NextResponse.json({ ok: false, campo: "palavraPasse", error: erro.mensagem }, { status: 400 });

    const r = await gastarLinkDaConta(corpo.token, TIPOS);
    if (!r.ok) return NextResponse.json({ ok: false, motivo: r.motivo, error: MENSAGEM_DO_LINK[r.motivo] }, { status: 410 });

    const conta = await contaDoClientePorEmail(r.link.email);
    if (!conta) {
      return NextResponse.json({ ok: false, motivo: "sem-conta", error: MENSAGEM_DO_LINK["sem-conta"] }, { status: 410 });
    }
    await gravarPalavraPasseDoCliente(conta.id, await hashDaPalavraPasse(corpo.palavraPasse as string));
    await registarEntradaDoCliente(conta.id);

    const resposta = NextResponse.json({ ok: true, email: r.link.email });
    await porSessaoDoClienteNoSite(resposta, { email: r.link.email, nome: conta.nome });
    return resposta;
  } catch (err) {
    console.error("[entrada/repor] falhou:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível gravar agora. Tente outra vez daqui a um minuto." },
      { status: 500 },
    );
  }
}
