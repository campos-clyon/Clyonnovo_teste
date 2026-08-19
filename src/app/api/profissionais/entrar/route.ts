import { NextRequest, NextResponse } from "next/server";
import { profissionalParaEntrar, registarAcessoDoProfissional } from "@/lib/db";
import {
  palavraPasseConfere,
  assinarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
  DURACAO_SESSAO_SEGUNDOS,
} from "@/lib/profissional-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * Entrada do profissional.
 *
 * A mensagem de erro é sempre a mesma, aconteça o que acontecer: email que não
 * existe, palavra-passe errada, conta suspensa, conta sem palavra-passe
 * definida. Distinguir seria dizer a quem tenta à sorte quais dos emails que
 * escreveu estão inscritos na plataforma — e a lista de profissionais da CLYON
 * não é para se descobrir a adivinhar.
 *
 * A excepção é a conta sem palavra-passe: aí diz-se, porque é a própria pessoa
 * a bater à porta certa e o silêncio deixá-la-ia sem saber o que fazer. Mas só
 * depois de o email conferir com uma conta aprovada.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "profissional-entrar", 10, 600);
  if (limite.erro) return limite.erro;

  let corpo: { email?: unknown; palavraPasse?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const palavraPasse = typeof corpo.palavraPasse === "string" ? corpo.palavraPasse : "";
  const GENERICO = "Email ou palavra-passe incorretos.";

  if (!email || !palavraPasse) {
    return NextResponse.json({ error: GENERICO }, { status: 401 });
  }

  if (!process.env.JWT_SECRET) {
    console.error("[profissionais/entrar] JWT_SECRET não está definido neste ambiente");
    return NextResponse.json(
      { error: "Área indisponível: falta configuração no servidor." },
      { status: 503 },
    );
  }

  try {
    const p = await profissionalParaEntrar(email);
    if (!p || p.estado !== "aprovado" || p.isActive !== 1) {
      return NextResponse.json({ error: GENERICO }, { status: 401 });
    }

    if (!p.passwordHash) {
      return NextResponse.json(
        {
          error:
            "Ainda não criou palavra-passe. Procure o email de aprovação, ou peça um link novo.",
          semPalavraPasse: true,
        },
        { status: 409 },
      );
    }

    if (!(await palavraPasseConfere(palavraPasse, p.passwordHash))) {
      return NextResponse.json({ error: GENERICO }, { status: 401 });
    }

    await registarAcessoDoProfissional(p.id);

    const token = await assinarSessaoDoProfissional(p.id, p.name);
    const resposta = NextResponse.json({ ok: true, nome: p.name });
    resposta.cookies.set(COOKIE_SESSAO_PROFISSIONAL, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_SESSAO_SEGUNDOS,
    });
    return resposta;
  } catch (error) {
    console.error("[profissionais/entrar]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
