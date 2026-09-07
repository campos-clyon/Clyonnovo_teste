import { NextRequest, NextResponse } from "next/server";

import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  criarAssistente,
  definirEstadoDoAssistente,
  definirPalavraPasseDoAssistente,
  erroDaPalavraPasseDeAssistente,
  erroDoNomeDeAssistente,
  existeColaboradorComNome,
  hashDaPalavraPasseDeAssistente,
  listarAssistentes,
  normalizarNomeDeAssistente,
} from "@/lib/assistentes";

export const runtime = "nodejs";

/**
 * As contas de assistente — geridas pelo administrador, e só por ele.
 *
 * `requireAdminGeral` e não `requireAdmin`: o segundo deixa passar um
 * assistente nas rotas da lista dele, e esta rota não pode estar nessa lista
 * nem por engano. Um assistente a criar assistentes é uma conta a
 * multiplicar-se sozinha.
 *
 * A palavra-passe é escolhida aqui e entregue à pessoa por fora. A resposta
 * nunca a devolve, nem o hash — guarda-se o hash e não há forma de a reler.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  try {
    return NextResponse.json({ assistentes: await listarAssistentes() });
  } catch (error) {
    console.error("[admin/assistentes GET]", error);
    return NextResponse.json({ error: "Erro ao listar assistentes." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    // ── Activar, desactivar ou repor a palavra-passe de quem já existe ─────
    if (corpo.id != null) {
      const id = Number(corpo.id);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Assistente inválido." }, { status: 400 });
      }

      if (typeof corpo.palavraPasse === "string") {
        const erroDaSenha = erroDaPalavraPasseDeAssistente(corpo.palavraPasse);
        if (erroDaSenha) return NextResponse.json({ error: erroDaSenha }, { status: 400 });
        const mudou = await definirPalavraPasseDoAssistente(
          id,
          await hashDaPalavraPasseDeAssistente(corpo.palavraPasse),
        );
        if (!mudou) return NextResponse.json({ error: "Assistente não encontrado." }, { status: 404 });
        return NextResponse.json({ ok: true, feito: "Palavra-passe reposta." });
      }

      if (typeof corpo.activo === "boolean") {
        const mudou = await definirEstadoDoAssistente(id, corpo.activo);
        if (!mudou) return NextResponse.json({ error: "Assistente não encontrado." }, { status: 404 });
        return NextResponse.json({
          ok: true,
          feito: corpo.activo ? "Conta reactivada." : "Conta desactivada — deixa de entrar já.",
        });
      }

      return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
    }

    // ── Criar ──────────────────────────────────────────────────────────────
    const nome = normalizarNomeDeAssistente(corpo.nome);
    const erroDoNome = erroDoNomeDeAssistente(nome);
    if (erroDoNome) return NextResponse.json({ error: erroDoNome }, { status: 400 });

    const erroDaSenha = erroDaPalavraPasseDeAssistente(corpo.palavraPasse);
    if (erroDaSenha) return NextResponse.json({ error: erroDaSenha }, { status: 400 });

    if (await existeColaboradorComNome(nome)) {
      return NextResponse.json({ error: "Já existe um colaborador com esse nome." }, { status: 409 });
    }

    const id = await criarAssistente({
      nome,
      senhaHash: await hashDaPalavraPasseDeAssistente(corpo.palavraPasse as string),
    });

    console.info("[admin/assistentes] assistente criado", { id, por: colab?.id });
    return NextResponse.json({ ok: true, id, nome, feito: `Conta ${nome} criada.` });
  } catch (error) {
    // O índice único do nome a fazer o trabalho dele, se duas criações se
    // cruzarem entre o SELECT e o INSERT.
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Já existe um colaborador com esse nome." }, { status: 409 });
    }
    console.error("[admin/assistentes POST]", error);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
