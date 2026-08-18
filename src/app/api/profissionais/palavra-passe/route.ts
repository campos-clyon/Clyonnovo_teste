import { NextRequest, NextResponse } from "next/server";
import { palavraPasseGuardada, definirPalavraPasseDoProfissional } from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  validarPalavraPasse,
  hashDaPalavraPasse,
  palavraPasseConfere,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * Mudar a palavra-passe já com sessão iniciada.
 *
 * Pede a actual, e não só a nova. A sessão dura trinta dias e vive num
 * telemóvel que fica em cima da mesa — sem a palavra-passe actual, quem
 * apanhasse o telefone desbloqueado trocava-a e ficava com a conta, e o dono
 * perdia o acesso ao saldo dele.
 */
export async function POST(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Travão de força bruta contra a palavra-passe actual: com sessão iniciada,
  // adivinhá-la aqui seria mais barato do que na página de entrada.
  const limite = await limitarRotaPublica(req, "profissional-mudar-senha", 10, 600);
  if (limite.erro) return limite.erro;

  let corpo: { actual?: unknown; nova?: unknown };
  try {
    corpo = (await req.json()) as { actual?: unknown; nova?: unknown };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const erro = validarPalavraPasse(corpo.nova);
  if (erro) return NextResponse.json({ error: erro.mensagem }, { status: 400 });

  try {
    const guardada = await palavraPasseGuardada(sessao.providerId);
    const confere =
      typeof corpo.actual === "string" &&
      (await palavraPasseConfere(corpo.actual, guardada));
    if (!confere) {
      return NextResponse.json({ error: "A palavra-passe actual não confere." }, { status: 403 });
    }

    await definirPalavraPasseDoProfissional(
      sessao.providerId,
      await hashDaPalavraPasse(corpo.nova as string),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[profissionais/palavra-passe]", error);
    return NextResponse.json({ error: "Não foi possível mudar" }, { status: 500 });
  }
}
