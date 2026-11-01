import { NextRequest, NextResponse } from "next/server";
import { emailValido } from "@/lib/inscricao-profissional";
import { hashDaPalavraPasse, validarPalavraPasse } from "@/lib/profissional-auth";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { contaDoClientePorEmail, criarLinkDaConta } from "@/lib/conta-com-palavra-passe";
import { enviarEmailDaConta } from "@/lib/email-conta-do-cliente";
import { FRASE_DO_REGISTO, nomeDoRegisto } from "@/lib/palavra-passe-do-cliente";

export const runtime = "nodejs";

/**
 * REGISTO DE CLIENTE COM EMAIL E PALAVRA-PASSE — 01-11-2026.
 *
 * `{ nome, email, palavraPasse }` → um email, e A MESMA FRASE para todos:
 *   · email sem conta → link de CONFIRMAÇÃO (24 h, uso único). A conta só
 *     nasce quando o link é aberto, com a palavra-passe que ficou à espera
 *     junto do link. Antes disso não há sessão nem pedidos à vista — os
 *     pedidos juntam-se à conta pelo email, e só o dono do email abre o link;
 *   · conta sem palavra-passe (Google, link, pedido) → o email de DEFINIR (a
 *     palavra-passe escrita aqui não se guarda: quem a escreveu pode não ser
 *     o dono do email);
 *   · conta com palavra-passe → o email «já tem conta», com o link de repor.
 *
 * O nome, o email e a palavra-passe validam-se primeiro, com erros que não
 * dizem nada sobre contas. O hash calcula-se SEMPRE, para o tempo de resposta
 * não separar os três casos.
 */
export async function POST(req: NextRequest) {
  const porIp = await limitarRotaPublica(req, "entrada-registo-ip", 8, 900);
  if (porIp.erro) {
    return NextResponse.json(
      { ok: false, codigo: "muitas-tentativas", error: "Demasiados pedidos. Aguarde alguns minutos e tente novamente." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let corpo: { nome?: unknown; email?: unknown; palavraPasse?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, codigo: "invalido", error: "Pedido inválido." }, { status: 400 });
  }
  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ ok: false, codigo: "invalido", error: "Pedido inválido." }, { status: 400 });
  }

  const nome = nomeDoRegisto(corpo.nome);
  if (!nome) {
    return NextResponse.json(
      { ok: false, codigo: "invalido", campo: "nome", error: "Escreva o seu nome." },
      { status: 400 },
    );
  }
  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  if (!emailValido(email) || email.length > 200) {
    return NextResponse.json(
      { ok: false, codigo: "invalido", campo: "email", error: "Escreva um email válido." },
      { status: 400 },
    );
  }
  const erroDaPalavraPasse = validarPalavraPasse(corpo.palavraPasse);
  if (erroDaPalavraPasse) {
    return NextResponse.json(
      { ok: false, codigo: "invalido", campo: "palavraPasse", error: erroDaPalavraPasse.mensagem },
      { status: 400 },
    );
  }

  // Uma só, devolvida em todos os caminhos daqui para baixo.
  const sempreOMesmo = NextResponse.json({ ok: true, mensagem: FRASE_DO_REGISTO });

  // Por endereço e só por endereço: contra quem enche a caixa de outra pessoa.
  // Não devolve o erro do limitador — seria a mesma informação por outra porta.
  const porEmail = await limitarPorConta("entrada-registo-email", email, 4, 900);
  if (porEmail.erro) return sempreOMesmo;

  try {
    const hash = await hashDaPalavraPasse(corpo.palavraPasse as string);
    const conta = await contaDoClientePorEmail(email);
    const base = urlDeAccaoDoPedido(req.headers);

    if (!conta) {
      const token = await criarLinkDaConta("registo", email, { nome, passwordHashPendente: hash });
      await enviarEmailDaConta({
        tipo: "confirmar",
        para: email,
        link: `${base}/entrar/confirmar-email?token=${encodeURIComponent(token)}`,
      });
    } else if (!conta.passwordHash) {
      const token = await criarLinkDaConta("definir", email);
      await enviarEmailDaConta({
        tipo: "definir",
        para: email,
        link: `${base}/entrar/repor?token=${encodeURIComponent(token)}`,
      });
    } else {
      const token = await criarLinkDaConta("repor", email);
      await enviarEmailDaConta({
        tipo: "ja-tem",
        para: email,
        link: `${base}/entrar/repor?token=${encodeURIComponent(token)}`,
      });
    }
  } catch (err) {
    // Fica no registo para nós, e não muda uma vírgula do que sai daqui.
    console.error("[entrada/registo] falhou:", err instanceof Error ? err.message : err);
  }

  return sempreOMesmo;
}
