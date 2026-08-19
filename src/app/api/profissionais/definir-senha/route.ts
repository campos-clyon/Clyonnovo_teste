import { NextRequest, NextResponse } from "next/server";
import {
  profissionalPorTokenDeSenha,
  definirPalavraPasseDoProfissional,
} from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import {
  validarPalavraPasse,
  hashDaPalavraPasse,
  assinarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
  DURACAO_SESSAO_SEGUNDOS,
} from "@/lib/profissional-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * Definir a palavra-passe a partir do link do email.
 *
 * O token é de uso único: `definirPalavraPasseDoProfissional` apaga-o ao gravar.
 * Sem isso, quem apanhasse o email antigo — reencaminhado, ou numa caixa
 * partilhada — podia trocar a palavra-passe outra vez e ficar com a conta.
 *
 * Quem define a palavra-passe entra logo. Obrigá-lo a escrevê-la outra vez a
 * seguir é um passo sem valor: acabou de a escolher.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "profissional-definir-senha", 10, 600);
  if (limite.erro) return limite.erro;

  let corpo: { token?: unknown; palavraPasse?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  if (typeof corpo.token !== "string") {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }

  const erro = validarPalavraPasse(corpo.palavraPasse);
  if (erro) return NextResponse.json({ error: erro.mensagem }, { status: 400 });

  const linha = await profissionalPorTokenDeSenha(hashDeToken(corpo.token));
  const r = verificarTokenDeAcesso(
    corpo.token,
    linha?.senhaTokenHash ?? null,
    linha?.senhaTokenExpiraEm ?? null,
  );
  if (!linha || !r.valido) {
    return NextResponse.json(
      {
        error:
          r.valido === false && r.motivo === "expirado"
            ? "Este link expirou. Peça outro na página de entrada."
            : "Link inválido.",
      },
      { status: 403 },
    );
  }

  // Um profissional suspenso ou rejeitado não deve poder criar acesso com um
  // convite antigo que lhe tenha ficado na caixa de correio.
  if (linha.estado !== "aprovado") {
    return NextResponse.json(
      { error: "Esta conta não está activa. Fale connosco." },
      { status: 403 },
    );
  }

  try {
    await definirPalavraPasseDoProfissional(
      linha.id,
      await hashDaPalavraPasse(corpo.palavraPasse as string),
    );

    const token = await assinarSessaoDoProfissional(linha.id, linha.name);
    const resposta = NextResponse.json({ ok: true, nome: linha.name });
    resposta.cookies.set(COOKIE_SESSAO_PROFISSIONAL, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_SESSAO_SEGUNDOS,
    });
    return resposta;
  } catch (error) {
    console.error("[profissionais/definir-senha]", error);
    return NextResponse.json(
      { error: "Não foi possível guardar. Tente novamente." },
      { status: 500 },
    );
  }
}
