import { NextRequest, NextResponse } from "next/server";

import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  COMISSAO_ASSISTENTE_POR_OMISSAO,
  anularPagamentoDoPeriodo,
  criarAssistente,
  definirComissaoDoAssistente,
  definirDataDeConclusao,
  definirLucroManual,
  definirComissaoSobre,
  definirEstadoDoAssistente,
  definirExcepcaoDaSaida,
  definirPalavraPasseDoAssistente,
  definirSeccoesDoAssistente,
  definirSaidaDoAssistente,
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
import { appendOrderHistory, definirPrecoAoClienteClyon } from "@/lib/db";
import { lerPrecoAoCliente } from "@/lib/oferta-clyon";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";
import { normalizarSeccoes } from "@/lib/papel-do-painel";
import { ROTULO_DA_EXCEPCAO, diaDeSaidaValido } from "@/lib/saida-da-assistente";
import { diaEscrito, intervaloValido, type Periodo } from "@/lib/periodos-de-comissao";
import { erroDoCodigo, gerarCodigo, normalizarCodigo, segredoDoIndice } from "@/lib/codigo-de-entrada";
import {
  anularCodigoDaConta,
  contasParaOsCodigos,
  definirCodigoDaConta,
  registoDosCodigos,
} from "@/lib/codigo-de-entrada-na-base";
import { assinarSessaoDoPainel, porCookieDaSessao } from "@/lib/emitir-sessao-do-painel";
import { randomBytes } from "node:crypto";

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
  /*
   * OS CÓDIGOS PARA ENTRAR (d75): as contas do painel — administradores e
   * assistentes — com «tem código» ou não, e o registo das trocas. Nunca o
   * código, nem o índice, nem o hash.
   */
  if (req.nextUrl.searchParams.get("codigos") != null) {
    try {
      const [contas, registo] = await Promise.all([contasParaOsCodigos(), registoDosCodigos(30)]);
      return NextResponse.json({ contas, registo, segredoPosto: segredoDoIndice() !== null });
    } catch (error) {
      console.error("[admin/assistentes GET codigos]", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "Erro ao ler os códigos." }, { status: 500 });
    }
  }

  const detalhe = req.nextUrl.searchParams.get("trabalhos");
  if (detalhe != null) {
    const id = Number(detalhe);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Assistente inválido." }, { status: 400 });
    }
    /*
     * E UM INTERVALO À ESCOLHA — 14-10-2026: «Gostaria de poder manipular as
     * datas em que quero o resumo.» Com `de` e `ate`, a resposta traz também o
     * resumo desse intervalo (ver `resumoEntreDatas`).
     */
    const de = req.nextUrl.searchParams.get("de");
    const ate = req.nextUrl.searchParams.get("ate");
    let intervalo: Periodo | undefined;
    if (de != null || ate != null) {
      const v = intervaloValido(de, ate);
      if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
      intervalo = v.intervalo;
    }
    try {
      const r = await trabalhosDoAssistente(id, intervalo);
      if (!r) return NextResponse.json({ error: "Assistente não encontrado." }, { status: 404 });
      return NextResponse.json(r);
    } catch (error) {
      console.error("[admin/assistentes GET trabalhos]", error);
      return NextResponse.json({ error: "Erro ao ler os trabalhos." }, { status: 500 });
    }
  }

  try {
    const { assistentes } = await listarAssistentes();
    return NextResponse.json({
      assistentes,
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
    /*
     * ── O CÓDIGO PARA ENTRAR de uma conta (d75, 20-11-2026) ──
     *
     * Só o administrador (esta rota é requireAdminGeral), para qualquer conta
     * do painel — a dele incluída. «gerar: true» cria um código forte
     * aleatório e devolve-o UMA vez, nesta resposta, para copiar; um código
     * escrito à mão não volta na resposta. A regra valida-se aqui, sempre.
     * Trocar fecha as sessões dessa pessoa; se for a de quem troca, recebe
     * logo uma sessão nova para não ser posto fora a meio.
     */
    if (corpo.codigoDeEntrada != null && typeof corpo.codigoDeEntrada === "object") {
      const pedido = corpo.codigoDeEntrada as Record<string, unknown>;
      const contaId = Number(pedido.id);
      if (!Number.isInteger(contaId) || contaId <= 0) {
        return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
      }
      const segredo = segredoDoIndice();
      if (!segredo) {
        return NextResponse.json(
          { error: "Falta a variável CODIGO_DE_ENTRADA_PEPPER na Vercel — sem ela não se gravam códigos." },
          { status: 503 },
        );
      }
      const gerar = pedido.gerar === true;
      const codigo = gerar ? gerarCodigo() : normalizarCodigo(pedido.codigo);
      const erroDaRegra = erroDoCodigo(codigo);
      if (erroDaRegra) return NextResponse.json({ error: erroDaRegra }, { status: 400 });

      const r = await definirCodigoDaConta({
        contaId,
        codigo,
        segredo,
        por: colab ? { id: colab.id, nome: colab.nome } : null,
      });
      if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado });

      const propria = Boolean(colab) && colab!.id === contaId;
      const sessaoNova = propria
        ? await assinarSessaoDoPainel({ id: colab!.id, nome: colab!.nome, papel: "admin" })
        : null;
      const resposta = NextResponse.json({
        ok: true,
        feito:
          r.accao === "criado"
            ? `Código de ${r.nome} criado. As sessões que tinha abertas fecharam-se.`
            : `Código de ${r.nome} trocado. As sessões que tinha abertas fecharam-se.`,
        // Só quando foi gerado aqui — é a única vez que se vê.
        ...(gerar ? { codigoGerado: codigo } : {}),
        ...(sessaoNova ? { sessaoNova } : {}),
      });
      if (sessaoNova) porCookieDaSessao(resposta, sessaoNova);
      return resposta;
    }

    /*
     * ── O LUCRO ESCRITO À MÃO de um trabalho sem negociação (08-10-2026) ──
     *
     * «Escrevo o lucro à mão.» Só aí: um pedido concluído que não passou pela
     * plataforma nem é Trabalho CLYON não tem outra fonte para o lucro. Fica no
     * histórico do pedido quem escreveu, e de quanto para quanto.
     */
    if (corpo.lucroDoPedido != null && typeof corpo.lucroDoPedido === "object") {
      const { pedidoId: idCru, lucro: lucroCru } = corpo.lucroDoPedido as Record<string, unknown>;
      const pedidoId = Number(idCru);
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
      }
      const texto = typeof lucroCru === "number" ? String(lucroCru) : typeof lucroCru === "string" ? lucroCru : "";
      const lucro = Number(texto.replace("€", "").replace(/\s/g, "").replace(",", "."));
      if (!texto.trim() || !Number.isFinite(lucro) || lucro < 0 || lucro > 20_000) {
        return NextResponse.json({ error: "Escreva o lucro da CLYON neste trabalho, sem IVA (0 ou mais)." }, { status: 400 });
      }
      const r = await definirLucroManual(pedidoId, Math.round(lucro * 100) / 100);
      if (!r) {
        return NextResponse.json(
          { error: "Esse pedido tem negociação ou é um Trabalho CLYON — o lucro sai daí." },
          { status: 409 },
        );
      }
      const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
      const quem = colab?.nome ?? "a CLYON";
      await appendOrderHistory(pedidoId, {
        type: "note",
        by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
        message:
          r.antes == null
            ? `Lucro da CLYON escrito por ${quem}: ${euros(lucro)} sem IVA.`
            : `Lucro da CLYON mudado por ${quem}: de ${euros(r.antes)} para ${euros(lucro)} sem IVA.`,
      });
      return NextResponse.json({ ok: true, feito: `#${pedidoId}: lucro ${euros(lucro)}.` });
    }

    /*
     * ── O PREÇO AO CLIENTE de um Trabalho CLYON, escrito no período (17-10-2026) ──
     *
     * «Escrever o preço ali» — o dono, com o 23/09–15/10 preso porque o #422
     * não tinha preço ao cliente. É a mesma gravação de «Trabalhos CLYON»
     * (`definirPrecoAoClienteClyon`), com a mesma leitura do valor e a mesma
     * nota no histórico do pedido; só que feita onde se viu que faltava.
     */
    if (corpo.precoDoPedido != null && typeof corpo.precoDoPedido === "object") {
      const { pedidoId: idCru, preco: precoCru } = corpo.precoDoPedido as Record<string, unknown>;
      const pedidoId = Number(idCru);
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
      }
      const lido = lerPrecoAoCliente(precoCru);
      if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
      const r = await definirPrecoAoClienteClyon(pedidoId, lido.valor);
      if (!r) return NextResponse.json({ error: "Esse pedido não é um Trabalho CLYON." }, { status: 404 });
      const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
      const quem = colab?.nome ?? "a CLYON";
      await appendOrderHistory(pedidoId, {
        type: "note",
        by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
        message:
          r.antes == null
            ? `Preço ao cliente escrito por ${quem}: ${euros(lido.valor)} sem IVA.`
            : `Preço ao cliente mudado por ${quem}: de ${euros(r.antes)} para ${euros(lido.valor)} sem IVA.`,
      });
      return NextResponse.json({ ok: true, feito: `#${pedidoId}: preço ao cliente ${euros(lido.valor)}.` });
    }

    /*
     * ── A DATA DA CONCLUSÃO de um trabalho, corrigida (14-10-2026) ──
     *
     * Para os concluídos antes de 08-10 sem negociação, cuja data é a da
     * última mexida no pedido — ver `definirDataDeConclusao`. Fica no
     * histórico do pedido quem corrigiu, e de que dia para que dia.
     */
    if (corpo.dataDoPedido != null && typeof corpo.dataDoPedido === "object") {
      const { pedidoId: idCru, dia } = corpo.dataDoPedido as Record<string, unknown>;
      const pedidoId = Number(idCru);
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
      }
      const v = intervaloValido(dia, dia);
      if (!v.ok) return NextResponse.json({ error: "Escolha o dia em que o trabalho ficou concluído." }, { status: 400 });
      const hoje = diaEmLisboa(new Date());
      if (v.intervalo.inicio > hoje) {
        return NextResponse.json({ error: "O dia da conclusão não pode ser no futuro." }, { status: 400 });
      }
      const r = await definirDataDeConclusao(pedidoId, v.intervalo.inicio);
      if (!r) return NextResponse.json({ error: "Esse pedido não está concluído." }, { status: 409 });
      const quem = colab?.nome ?? "a CLYON";
      const novo = diaEscrito(v.intervalo.inicio);
      await appendOrderHistory(pedidoId, {
        type: "note",
        by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
        message: `Data da conclusão corrigida por ${quem}: ${r.antes ? `de ${diaEscrito(r.antes)} ` : ""}para ${novo}.`,
      });
      return NextResponse.json({ ok: true, feito: `#${pedidoId}: concluído a ${novo}.` });
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
        // Desactivar invalida o código dela (d75). Reactivar não o devolve.
        if (!corpo.activo) await anularCodigoDaConta(id, colab ? { id: colab.id, nome: colab.nome } : null);
        return NextResponse.json({
          ok: true,
          feito: corpo.activo ? "Conta reactivada." : "Conta desactivada — deixa de entrar já.",
        });
      }

      if (Array.isArray(corpo.seccoes)) {
        const seccoes = normalizarSeccoes(corpo.seccoes);
        const mudou = await definirSeccoesDoAssistente(id, seccoes);
        if (!mudou) return NextResponse.json({ error: "Assistente não encontrado." }, { status: 404 });
        return NextResponse.json({ ok: true, feito: "Acessos atualizados — valem na próxima chamada." });
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

      // ── O dia de saída (d40, 15-11-2026) ───────────────────────────────────
      // Só o administrador (esta rota é requireAdminGeral). `null` apaga o dia.
      if (corpo.saiuA !== undefined) {
        const dia = corpo.saiuA === null || corpo.saiuA === "" ? null : diaDeSaidaValido(corpo.saiuA);
        if (corpo.saiuA !== null && corpo.saiuA !== "" && dia === null) {
          return NextResponse.json({ error: "Escolha o dia em que saiu." }, { status: 400 });
        }
        const r = await definirSaidaDoAssistente(id, dia, colab?.nome ?? null);
        if (!r) return NextResponse.json({ error: "Assistente não encontrado." }, { status: 404 });
        return NextResponse.json({
          ok: true,
          feito: dia
            ? `${r.nome} saiu a ${diaEscrito(dia)}: o que for feito depois não conta para ela, salvo os marcados.`
            : `Dia de saída de ${r.nome} apagado — volta a contar como antes.`,
        });
      }

      // ── Um trabalho que conta depois da saída, por excepção (d40) ─────────
      if (corpo.excepcaoDaSaida != null && typeof corpo.excepcaoDaSaida === "object") {
        const { pedidoId: idCru, marcar } = corpo.excepcaoDaSaida as Record<string, unknown>;
        const pedidoId = Number(String(idCru ?? "").replace("#", "").trim());
        if (!Number.isInteger(pedidoId) || pedidoId <= 0 || typeof marcar !== "boolean") {
          return NextResponse.json({ error: "Escreva o número do pedido." }, { status: 400 });
        }
        const r = await definirExcepcaoDaSaida(id, pedidoId, marcar, colab?.nome ?? null);
        if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado });
        const quem = colab?.nome ?? "a CLYON";
        await appendOrderHistory(pedidoId, {
          type: "note",
          by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
          message: marcar
            ? `Marcado por ${quem}: conta para ${r.nome} depois da saída — ${ROTULO_DA_EXCEPCAO}.`
            : `Desmarcado por ${quem}: deixa de contar para ${r.nome} depois da saída.`,
        });
        return NextResponse.json({
          ok: true,
          feito: marcar
            ? `#${pedidoId} conta para ${r.nome} quando ficar concluído, na quinzena em que for feito.`
            : `#${pedidoId} já não conta para ${r.nome} depois da saída.`,
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

    /*
     * A conta nova nasce com CÓDIGO para entrar (d75): gerado aqui ou escrito
     * à mão. A palavra-passe da coluna `senha` é aleatória e ninguém a sabe —
     * a coluna é obrigatória, e com código a palavra-passe já não entra.
     */
    const segredo = segredoDoIndice();
    if (!segredo) {
      return NextResponse.json(
        { error: "Falta a variável CODIGO_DE_ENTRADA_PEPPER na Vercel — sem ela não se criam contas com código." },
        { status: 503 },
      );
    }
    const gerarONovo = corpo.gerarCodigo === true;
    const codigoNovo = gerarONovo ? gerarCodigo() : normalizarCodigo(corpo.codigo);
    const erroDoCodigoNovo = erroDoCodigo(codigoNovo);
    if (erroDoCodigoNovo) return NextResponse.json({ error: erroDoCodigoNovo }, { status: 400 });

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
      senhaHash: await hashDaPalavraPasseDeAssistente(randomBytes(24).toString("base64url")),
      seccoes,
      comissaoPercent,
    });

    const comCodigo = await definirCodigoDaConta({
      contaId: id,
      codigo: codigoNovo,
      segredo,
      por: colab ? { id: colab.id, nome: colab.nome } : null,
    });
    if (!comCodigo.ok) {
      /*
       * A conta ficou criada mas sem código: desactiva-se, para não fazer
       * reaparecer a ligação «Entrar com utilizador» com uma palavra-passe
       * que ninguém sabe.
       */
      await definirEstadoDoAssistente(id, false);
      return NextResponse.json(
        { error: `Conta ${nome} criada mas desactivada: ${comCodigo.erro} Reactive-a e dê-lhe outro código.` },
        { status: comCodigo.estado },
      );
    }

    console.info("[admin/assistentes] assistente criado", { id, por: colab?.id, seccoes });
    return NextResponse.json({
      ok: true,
      id,
      nome,
      feito: `Conta ${nome} criada, com código para entrar.`,
      ...(gerarONovo ? { codigoGerado: codigoNovo } : {}),
    });
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
