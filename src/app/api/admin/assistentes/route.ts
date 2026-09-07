import { NextRequest, NextResponse } from "next/server";

import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  COMISSAO_ASSISTENTE_POR_OMISSAO,
  criarAssistente,
  definirComissaoClyonPercent,
  definirComissaoDoAssistente,
  definirEstadoDoAssistente,
  definirPalavraPasseDoAssistente,
  definirSeccoesDoAssistente,
  erroDaPalavraPasseDeAssistente,
  erroDoNomeDeAssistente,
  existeColaboradorComNome,
  hashDaPalavraPasseDeAssistente,
  listarAssistentes,
  normalizarNomeDeAssistente,
  percentagemValida,
} from "@/lib/assistentes";
import { normalizarSeccoes } from "@/lib/papel-do-painel";

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
 *
 * GET devolve, por conta: as secções que vê, a percentagem dela, e os
 * trabalhos de que foi responsável — concluídos, em curso, cancelados,
 * arquivados — com o valor dos concluídos e a comissão que isso dá. E a
 * percentagem da CLYON usada nessa conta, que também se muda aqui.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  try {
    const { assistentes, comissaoClyonPercent } = await listarAssistentes();
    return NextResponse.json({
      assistentes,
      comissaoClyonPercent,
      comissaoAssistentePorOmissao: COMISSAO_ASSISTENTE_POR_OMISSAO,
    });
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
    // ── A percentagem da CLYON, comum a todos ──────────────────────────────
    if (corpo.comissaoClyonPercent !== undefined && corpo.id == null) {
      const pct = percentagemValida(corpo.comissaoClyonPercent);
      if (pct === null) {
        return NextResponse.json({ error: "Percentagem da CLYON: número entre 0 e 100." }, { status: 400 });
      }
      await definirComissaoClyonPercent(pct);
      return NextResponse.json({ ok: true, feito: `Comissão da CLYON passa a ${pct} %.` });
    }

    // ── Alterar quem já existe ────────────────────────────────────────────
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

      if (Array.isArray(corpo.seccoes)) {
        const seccoes = normalizarSeccoes(corpo.seccoes);
        const mudou = await definirSeccoesDoAssistente(id, seccoes);
        if (!mudou) return NextResponse.json({ error: "Assistente não encontrado." }, { status: 404 });
        return NextResponse.json({ ok: true, feito: "Acessos actualizados — valem na próxima chamada." });
      }

      if (corpo.comissaoPercent !== undefined) {
        const pct = percentagemValida(corpo.comissaoPercent);
        if (pct === null) {
          return NextResponse.json({ error: "Comissão: número entre 0 e 100." }, { status: 400 });
        }
        const mudou = await definirComissaoDoAssistente(id, pct);
        if (!mudou) return NextResponse.json({ error: "Assistente não encontrado." }, { status: 404 });
        return NextResponse.json({ ok: true, feito: `Comissão passa a ${pct} % da parte da CLYON.` });
      }

      return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
    }

    // ── Criar ──────────────────────────────────────────────────────────────
    const nome = normalizarNomeDeAssistente(corpo.nome);
    const erroDoNome = erroDoNomeDeAssistente(nome);
    if (erroDoNome) return NextResponse.json({ error: erroDoNome }, { status: 400 });

    const erroDaSenha = erroDaPalavraPasseDeAssistente(corpo.palavraPasse);
    if (erroDaSenha) return NextResponse.json({ error: erroDaSenha }, { status: 400 });

    const comissaoPercent =
      corpo.comissaoPercent === undefined
        ? COMISSAO_ASSISTENTE_POR_OMISSAO
        : percentagemValida(corpo.comissaoPercent);
    if (comissaoPercent === null) {
      return NextResponse.json({ error: "Comissão: número entre 0 e 100." }, { status: 400 });
    }

    if (await existeColaboradorComNome(nome)) {
      return NextResponse.json({ error: "Já existe um colaborador com esse nome." }, { status: 409 });
    }

    const seccoes = normalizarSeccoes(corpo.seccoes);
    const id = await criarAssistente({
      nome,
      senhaHash: await hashDaPalavraPasseDeAssistente(corpo.palavraPasse as string),
      seccoes,
      comissaoPercent,
    });

    console.info("[admin/assistentes] assistente criado", { id, por: colab?.id, seccoes });
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
