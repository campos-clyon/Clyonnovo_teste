import { NextRequest, NextResponse } from "next/server";
import { testadorPorUtilizador, registarAcessoDoTestador } from "@/lib/db";
import {
  COOKIE_CHAVE_MVP,
  COOKIE_SESSAO_TESTE,
  DURACAO_SESSAO_TESTE_SEGUNDOS,
  assinarSessaoDeTeste,
  chaveConfere,
  palavraPasseDeTesteConfere,
} from "@/lib/acesso-mvp";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * A segunda fechadura: quem é.
 *
 * A primeira — a chave no endereço — já foi verificada pelo middleware, mas
 * verifica-se outra vez aqui. O middleware pode um dia deixar de cobrir este
 * caminho por causa de uma vírgula num `matcher`, e essa vírgula não pode ser
 * a única coisa entre o mundo e a criação de sessões.
 *
 * A resposta é a mesma para utilizador que não existe, palavra-passe errada e
 * conta desactivada. Distinguir dizia a quem tenta que aquele nome existe — e
 * metade do trabalho de adivinhar credenciais é descobrir os nomes.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "plataforma-entrar", 10, 600);
  if (limite.erro) return limite.erro;

  if (!chaveConfere(req.cookies.get(COOKIE_CHAVE_MVP)?.value)) {
    return new NextResponse(null, { status: 404 });
  }

  let corpo: { utilizador?: unknown; palavraPasse?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const utilizador =
    typeof corpo.utilizador === "string" ? corpo.utilizador.trim().toLowerCase() : "";
  const palavraPasse = typeof corpo.palavraPasse === "string" ? corpo.palavraPasse : "";

  if (!utilizador || !palavraPasse) {
    return NextResponse.json({ error: "Preencha os dois campos." }, { status: 400 });
  }

  try {
    const testador = await testadorPorUtilizador(utilizador);
    const confere =
      testador != null &&
      Number(testador.activo) === 1 &&
      (await palavraPasseDeTesteConfere(palavraPasse, testador.passwordHash));

    if (!testador || !confere) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const token = await assinarSessaoDeTeste({
      testadorId: testador.id,
      nome: testador.nome,
    });

    await registarAcessoDoTestador(testador.id);

    const resposta = NextResponse.json({ ok: true, nome: testador.nome, papel: testador.papel });
    resposta.cookies.set(COOKIE_SESSAO_TESTE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_SESSAO_TESTE_SEGUNDOS,
    });
    return resposta;
  } catch (error) {
    console.error("[plataforma/entrar]", error);
    return NextResponse.json({ error: "Erro ao entrar." }, { status: 500 });
  }
}
