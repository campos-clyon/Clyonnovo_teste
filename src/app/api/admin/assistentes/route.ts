import { NextRequest, NextResponse } from "next/server";

import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  COMISSAO_ASSISTENTE_POR_OMISSAO,
  anularPagamentoDoPeriodo,
  criarAssistente,
  definirComissaoClyonPercent,
  definirComissaoDoAssistente,
  definirComissaoSobre,
  definirEstadoDoAssistente,
  definirPalavraPasseDoAssistente,
  definirSeccoesDoAssistente,
  erroDaPalavraPasseDeAssistente,
  erroDoNomeDeAssistente,
  existeColaboradorComNome,
  hashDaPalavraPasseDeAssistente,
  listarAssistentes,
  marcarPeriodoComoPago,
  normalizarNomeDeAssistente,
  percentagemValida,
  trabalhosDoAssistente,
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
 * GET devolve, por conta: as secções que vê, a percentagem dela, sobre que
 * trabalhos ganha («todos» ou «os seus»), os trabalhos de que foi responsável
 * por estado, e a comissão por períodos — 23/09 a 15/10, depois quinzenas —,
 * cada um em curso, por pagar ou pago. E a percentagem da CLYON usada nessa
 * conta, que também se muda aqui.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  /*
   * O DETALHE DE UMA CONTA: os trabalhos por trás do número.
   *
   * «Quero mais detalhes dos trabalhos feitos para saber quais trabalhos o
   * assistente fez, para justificar os valores.» — 29-09-2026.
   *
   * Pedido à parte, e só quando se abre: a lista pode ter centenas de linhas
   * por assistente, e o ecrã das contas carrega-se de vinte em vinte segundos.
   */
  const detalhe = req.nextUrl.searchParams.get("trabalhos");
  if (detalhe != null) {
    const id = Number(detalhe);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Assistente inválido." }, { status: 400 });
    }
    try {
      const r = await trabalhosDoAssistente(id);
      if (!r) return NextResponse.json({ error: "Assistente não encontrado." }, { status: 404 });
      return NextResponse.json(r);
    } catch (error) {
      console.error("[admin/assistentes GET trabalhos]", error);
      return NextResponse.json({ error: "Erro ao ler os trabalhos." }, { status: 500 });
    }
  }

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

      // ── Sobre que trabalhos ganha (08-10-2026) ───────────────────────────
      if (corpo.comissaoSobre !== undefined) {
        if (corpo.comissaoSobre !== "todos" && corpo.comissaoSobre !== "seus") {
          return NextResponse.json({ error: "Escolha «todos» ou «os seus»." }, { status: 400 });
        }
        const mudou = await definirComissaoSobre(id, corpo.comissaoSobre);
        if (!mudou) return NextResponse.json({ error: "Assistente não encontrado." }, { status: 404 });
        return NextResponse.json({
          ok: true,
          feito:
            corpo.comissaoSobre === "todos"
              ? "Passa a ganhar sobre todos os trabalhos concluídos."
              : "Passa a ganhar só sobre os trabalhos de que é responsável.",
        });
      }

      // ── Pagar, ou anular o pagamento de, um período (08-10-2026) ─────────
      // O valor nunca vem daqui: a conta refaz-se no servidor.
      const periodo =
        typeof corpo.pagarPeriodo === "string"
          ? corpo.pagarPeriodo
          : typeof corpo.anularPagamento === "string"
            ? corpo.anularPagamento
            : null;
      if (periodo !== null) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodo)) {
          return NextResponse.json({ error: "Período inválido." }, { status: 400 });
        }
        const r =
          typeof corpo.pagarPeriodo === "string"
            ? await marcarPeriodoComoPago(id, periodo, colab?.nome ?? null)
            : await anularPagamentoDoPeriodo(id, periodo, colab?.nome ?? null);
        if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado });
        const valor = r.valorPago.toFixed(2).replace(".", ",");
        return NextResponse.json({
          ok: true,
          feito:
            typeof corpo.pagarPeriodo === "string"
              ? `Período ${r.rotulo} marcado como pago: ${valor} € (${r.trabalhos} trabalho${r.trabalhos === 1 ? "" : "s"}).`
              : `Pagamento de ${r.rotulo} anulado — o período volta a contar com os números de hoje.`,
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

    /*
     * SEM SECÇÕES, NENHUMA — 03-10-2026. Até aqui uma conta criada sem lista
     * (ou com a lista vazia) ficava com todas; com o menu inteiro na lista,
     * isso eram carteiras, pagamentos e configurações por esquecimento. Grava-se
     * sempre a lista — nunca NULL —, porque NULL é o que as contas antigas têm
     * e quer dizer as seis de sempre (ver `seccoesGuardadas`).
     */
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
