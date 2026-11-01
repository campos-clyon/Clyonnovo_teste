import { NextRequest, NextResponse } from "next/server";
import { emailValido } from "@/lib/inscricao-profissional";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { contaDoClientePorEmail, criarLinkDaConta } from "@/lib/conta-com-palavra-passe";
import { enviarEmailDaConta } from "@/lib/email-conta-do-cliente";
import { FRASE_DO_ESQUECI } from "@/lib/palavra-passe-do-cliente";

export const runtime = "nodejs";

/**
 * «ESQUECI-ME DA PALAVRA-PASSE» DO CLIENTE — 01-11-2026.
 *
 * `{ email }` → um link de repor (1 hora, uso único) se o email tiver conta —
 * com ou sem palavra-passe: quem entrava com o Google ou com o link também
 * pode escolher uma por aqui. A RESPOSTA É SEMPRE A MESMA, como no link de
 * entrada; e as duas travas de lá: por endereço e por email.
 */
export async function POST(req: NextRequest) {
  const porIp = await limitarRotaPublica(req, "entrada-esqueci-ip", 8, 900);
  if (porIp.erro) {
    return NextResponse.json(
      { ok: false, codigo: "muitas-tentativas", error: "Demasiados pedidos. Aguarde alguns minutos e tente novamente." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let corpo: { email?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, codigo: "invalido", error: "Pedido inválido." }, { status: 400 });
  }

  const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const sempreOMesmo = NextResponse.json({ ok: true, mensagem: FRASE_DO_ESQUECI });
  if (!emailValido(email) || email.length > 200) return sempreOMesmo;

  const porEmail = await limitarPorConta("entrada-esqueci-email", email, 3, 900);
  if (porEmail.erro) return sempreOMesmo;

  try {
    const conta = await contaDoClientePorEmail(email);
    if (conta) {
      const token = await criarLinkDaConta(conta.passwordHash ? "repor" : "definir", email);
      await enviarEmailDaConta({
        tipo: conta.passwordHash ? "repor" : "definir",
        para: email,
        link: `${urlDeAccaoDoPedido(req.headers)}/entrar/repor?token=${encodeURIComponent(token)}`,
      });
    }
  } catch (err) {
    console.error("[entrada/esqueci] falhou:", err instanceof Error ? err.message : err);
  }

  return sempreOMesmo;
}
