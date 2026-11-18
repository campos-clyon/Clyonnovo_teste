import { NextRequest, NextResponse } from "next/server";
import { reservasDe } from "@/lib/reserva-na-base";
import { avisarOClienteDoPedido } from "@/lib/avisos-ao-cliente";
import { avisarProfissionalClientePagouPorPush } from "@/lib/avisar-por-push";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { getPool, appendOrderHistory, registarSemFalhar, ensureNegociacoesTable } from "@/lib/db";
import { configuracaoDoEupago } from "@/lib/eupago";
import { contaDoCliente, taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { modeloDaLinha, paraQueDaLinha } from "@/lib/sem-factura";
import { dividaDoProfissional, temDividaDoProfissional } from "@/lib/divida-do-profissional";
import {
  RECEBIMENTOS_A_MAO,
  nomeDoRecebimento,
  type ComoEntrou,
} from "@/lib/dinheiro-do-trabalho";
import { registarRecebimentoAMao } from "@/lib/pagamentos-na-base";
import { valorDoPagamento } from "@/lib/pagamento-declarado";
import { dividaDoRegistoEmMao, pagoAoProfissionalRegistado } from "@/lib/pago-em-mao";
import { fraseDoPagoEmDinheiro } from "@/lib/pagamento-da-divida";
import { gerarReferenciaDaDivida } from "@/lib/cobrar-divida-do-profissional";
import { segueONovoModelo } from "@/lib/novo-modelo-no-servidor";
import { taxaAPassarAClyon } from "@/lib/taxa-a-passar-a-clyon";
import { conferirRegistoAMao } from "@/lib/origem-do-pagamento";
import { contasDeDestino } from "@/lib/contas-de-destino-na-base";
import { ficheiroDoComprovativo } from "@/lib/comprovativo-no-servidor";
import { anotarContaDeDestino, guardarComprovativo, subirComprovativo } from "@/lib/rasto-do-pagamento-na-base";
import { MENSAGENS_DO_COMPROVATIVO } from "@/lib/comprovativo-do-pagamento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «O CLIENTE JÁ PAGOU» — DITO POR UMA PESSOA, QUANDO NÃO FOI PELO euPAGO.
 *
 * *«Gerir quem pagou e como pagou.»* — 24-09-2026.
 *
 * Até aqui, «o cliente pagou» era uma pergunta que só o euPago sabia
 * responder: a carteira lê a tabela `pagamentos`, e só o webhook escrevia lá.
 * Um cliente que transferisse para a conta da CLYON, ou que pagasse em
 * numerário, ou que simplesmente pagasse ao profissional no fim — que é o que
 * os ecrãs lhe prometem hoje — não tinha como ser registado. O trabalho ficava
 * «por cobrar» para sempre, e o dinheiro do profissional ficava preso atrás de
 * um desbloqueio que nunca vinha.
 *
 * ⚠️ ISTO DESBLOQUEIA DINHEIRO. Um registo aqui move o trabalho de «por
 * cobrar» para «disponível» na carteira do profissional — ou seja, autoriza
 * uma transferência. Por isso: só administrador (`requireAdminGeral` desde
 * 03-10-2026 — o assistente com a secção Pagamentos só vê), só métodos da
 * lista, e o índice único da base é que garante que não entra duas vezes.
 *
 * NÃO PAGA NADA A NINGUÉM. Diz o que já aconteceu. Quem paga ao profissional
 * é outro botão, noutro sítio, com outro registo.
 */

export async function POST(req: NextRequest) {
  // Só o administrador — 03-10-2026, decisão do dono: nesta secção o assistente
  // só vê; mexer em dinheiro ou em taxas é do administrador. Ver
  // `ESCRITAS_SO_DO_ADMINISTRADOR` em papel-do-painel.ts.
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  /*
   * D66 (18-11-2026): DE ONDE VEIO, E A PROVA. Por transferência ou numerário
   * o pedido vem num formulário com o comprovativo (`file`, foto ou PDF) e,
   * numa transferência, a conta onde entrou (`contaDeDestino`, da lista das
   * Configs). Sem eles, nada se grava. O «pago ao profissional» continua a
   * poder vir em JSON (o comprovativo junta-se depois, se houver).
   */
  let corpo: { negociacaoId?: unknown; metodo?: unknown; contaDeDestino?: unknown };
  let comprovativo: Awaited<ReturnType<typeof ficheiroDoComprovativo>> = null;
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const fd = await req.formData();
      corpo = { negociacaoId: fd.get("negociacaoId"), metodo: fd.get("metodo"), contaDeDestino: fd.get("contaDeDestino") };
      comprovativo = await ficheiroDoComprovativo(fd);
    } else {
      corpo = (await req.json()) as typeof corpo;
    }
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (comprovativo && !comprovativo.ok) {
    return NextResponse.json({ error: comprovativo.erro }, { status: comprovativo.status });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  /*
   * A lista fechada, e não o que vier no corpo. Um método escrito à mão numa
   * coluna de texto é um relatório que nunca mais soma certo.
   */
  const metodo = String(corpo.metodo ?? "") as ComoEntrou;
  if (!RECEBIMENTOS_A_MAO.includes(metodo)) {
    return NextResponse.json(
      { error: "Diga como entrou: transferência, numerário, ou pago ao profissional." },
      { status: 400 },
    );
  }

  // A conta (numa transferência) e o comprovativo (transferência e numerário), antes de tudo.
  const conferido = conferirRegistoAMao({
    metodo,
    contaId: corpo.contaDeDestino,
    contas: await contasDeDestino(),
    temComprovativo: Boolean(comprovativo?.ok),
    comprovativoObrigatorio: true,
  });
  if (!conferido.ok) return NextResponse.json({ error: conferido.erro }, { status: 400 });

  // Lê `pagamentoParaQue`, coluna de 29-09-2026.
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      `SELECT n.pedidoId, n.providerId, n.valorAcordado, n.taxaCliente, n.taxaProfissional,
              n.estado, n.pagamentoParaQue, n.formaDePagamento, n.createdAt, n.semFactura,
              n.ofertaClyon, n.execucaoEnviadaEm, n.provaJson, n.confirmadoEm, n.pagoEm,
              pr.name AS profissional
         FROM negociacoes n JOIN providers pr ON pr.id = n.providerId
        WHERE n.id = ? LIMIT 1`,
      [negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];

    const l = linhas[0];
    if (!l) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    if (l.estado !== "acordada") {
      return NextResponse.json(
        { error: `Este trabalho está «${l.estado}» — só se regista o pagamento de um trabalho fechado.` },
        { status: 409 },
      );
    }
    if (l.valorAcordado == null) {
      return NextResponse.json({ error: "Este trabalho não tem valor acordado." }, { status: 409 });
    }

    /*
     * O VALOR É O DA CONTA, e não um número escrito no ecrã. Quem regista diz
     * COMO entrou; QUANTO entrou sai das taxas gravadas nesta negociação, que
     * são as mesmas que o cliente viu. Deixar escrever o valor era deixar a
     * carteira do profissional depender de quem tem pressa.
     */
    /*
     * COM OU SEM FACTURA, segundo o que ficou declarado ao dar o trabalho por
     * feito — 29-09-2026. Até aqui gravava-se sempre o total com IVA, mesmo a
     * quem não pediu factura: um cliente que pagou 283,50 € ficava registado
     * com 348,71 €, e a soma dos recebidos mentia por 23 % em cada um deles.
     *
     * Sem declaração fica o total, que é o que sempre foi.
     */
    /*
     * EM DINHEIRO COM IVA INCLUÍDO, O QUE ENTRA É A DÍVIDA DO PROFISSIONAL —
     * 01-10-2026. O cliente pagou-lhe tudo em notas; o que a CLYON regista
     * aqui é o IVA e a comissão que ele lhe entregou (por transferência, ou
     * em mão), e é isso que dá a referência dele por paga.
     */
    const modelo = modeloDaLinha(l, l.createdAt as Date | string | null);
    /*
     * O MODELO DE 15-11-2026 — d31. O cliente pagou ao profissional
     * diretamente: o que se regista aqui é a taxa que ELE passou à CLYON (a
     * taxa e o IVA dela), nunca o valor do cliente — e o cliente não é avisado
     * de pagamento nenhum.
     */
    const novoModelo = await segueONovoModelo({ ...l, id: negociacaoId });
    if (novoModelo && metodo === "ao_profissional") {
      return NextResponse.json(
        { error: "Neste trabalho o cliente paga ao profissional diretamente — registe só a taxa que ele passou à CLYON." },
        { status: 409 },
      );
    }
    const taxaDoNovo = novoModelo
      ? taxaAPassarAClyon(Number(l.valorAcordado), taxasDaNegociacao(l), "normal", (await reservasDe([negociacaoId])).get(negociacaoId) ?? 0)
      : null;
    if (novoModelo && !taxaDoNovo) {
      return NextResponse.json({ error: "Não foi possível fazer a conta da taxa deste trabalho." }, { status: 409 });
    }
    const doProfissional = novoModelo || temDividaDoProfissional(l.formaDePagamento, modelo);
    const valor = taxaDoNovo
      ? taxaDoNovo.total
      : doProfissional
      ? dividaDoProfissional(Number(l.valorAcordado), taxasDaNegociacao(l)).total
      : valorDoPagamento(
          contaDoCliente(Number(l.valorAcordado), taxasDaNegociacao(l)),
          paraQueDaLinha(l),
          modelo,
        );
    const conf = configuracaoDoEupago(process.env);

    /*
     * O FICHEIRO SOBE ANTES DO REGISTO (d66): se o armazenamento falhar, o
     * pagamento não fica registado sem a prova que o botão exige.
     */
    let urlDoComprovativo: string | null = null;
    if (comprovativo?.ok) {
      try {
        urlDoComprovativo = await subirComprovativo(
          comprovativo.ficheiro,
          comprovativo.conferido,
          `comprovativos/${Number(l.pedidoId)}-${negociacaoId}-recebido`,
        );
      } catch (e) {
        console.error("[admin/pagamentos/recebido] comprovativo:", e instanceof Error ? e.message : e);
        return NextResponse.json({ error: MENSAGENS_DO_COMPROVATIVO.falhou }, { status: 503 });
      }
    }

    const r = await registarRecebimentoAMao({
      negociacaoId,
      pedidoId: Number(l.pedidoId),
      providerId: Number(l.providerId),
      metodo,
      valor,
      quando: new Date(),
      ambiente: conf.ok ? conf.config.ambiente : "producao",
    });

    if (!r.feito) {
      return NextResponse.json({ error: r.porque }, { status: 409 });
    }

    const porQuem = colab?.nome ?? "a CLYON";

    // A conta onde entrou e o comprovativo, na linha que acabou de nascer (d66).
    if (r.pagamentoId) {
      await anotarContaDeDestino("pagamentos", [r.pagamentoId], conferido.contaDeDestino);
      if (urlDoComprovativo && comprovativo?.ok) {
        await guardarComprovativo({
          alvo: "pagamento",
          alvoIds: [r.pagamentoId],
          negociacaoId,
          pedidoId: Number(l.pedidoId),
          url: urlDoComprovativo,
          nome: comprovativo.conferido.nome,
          tipo: comprovativo.conferido.tipo,
          tamanho: comprovativo.ficheiro.size,
          por: porQuem,
        });
      }
    }
    const comoSeChama = nomeDoRecebimento(metodo);
    const emEuros = `${valor.toFixed(2).replace(".", ",")} €`;

    /*
     * O CLIENTE PAGOU AO PROFISSIONAL, EM DINHEIRO — 01-11-2026 (dono): o
     * histórico diz quanto, e quanto ele fica a dever à CLYON, com o IVA e a
     * taxa à vista. «Cliente pagou X € ao profissional em dinheiro. O
     * profissional deve à CLYON Y € (IVA Z € + taxa W €).»
     */
    const emMao = pagoAoProfissionalRegistado(l.formaDePagamento, metodo)
      ? dividaDoRegistoEmMao(Number(l.valorAcordado), taxasDaNegociacao(l), valor)
      : null;
    const fraseEmMao = emMao ? fraseDoPagoEmDinheiro(emMao) : null;

    await appendOrderHistory(Number(l.pedidoId), {
      type: "created",
      by: null,
      message: fraseEmMao
        ? `${fraseEmMao} Registado por ${porQuem}.`
        : (doProfissional
            ? `${porQuem} registou que ${String(l.profissional ?? "o profissional")} pagou à CLYON ${emEuros} ` +
              `de IVA e taxa da plataforma (${novoModelo ? "o cliente pagou-lhe diretamente" : "trabalho pago em dinheiro"}) — ${comoSeChama}. `
            : `${porQuem} registou que o cliente pagou ${emEuros} — ${comoSeChama}. `) +
          "Não passou pelo euPago: é um registo à mão." +
          (urlDoComprovativo ? " Com comprovativo." : ""),
    });

    await registarSemFalhar({
      acontecimento: "pagamento_recebido",
      pedidoId: Number(l.pedidoId),
      negociacaoId,
      providerId: Number(l.providerId),
      autorTipo: "clyon",
      autorNome: porQuem,
      resumo: fraseEmMao ?? `${comoSeChama}: ${emEuros} registados à mão.`,
      valor,
      detalhe: {
        pagamentoId: r.pagamentoId,
        metodo,
        valor,
        // A conta fica na linha do pagamento (`contaDeDestino`), que só a equipa lê.
        comComprovativo: Boolean(urlDoComprovativo),
        ...(emMao ? { deveAClyon: emMao.total, iva: emMao.iva, taxa: emMao.comissao } : {}),
      },
    });

    /*
     * A REFERÊNCIA DA DÍVIDA DE UM PAGO EM MÃO — 04-11-2026 (d9). Se o trabalho
     * já está feito, gera-se já, como na confirmação; se ainda não, gera-se ao
     * confirmar (`avisar-confirmacao.ts`). Nunca lança, e não desfaz o registo.
     */
    if (emMao) {
      await gerarReferenciaDaDivida(negociacaoId, { metodo: "multibanco", autor: { tipo: "clyon", nome: porQuem } });
    }

    // S19 (BO26, 29-10-2026): o «pago» também quando se regista à mão — a
    // mesma regra do webhook (a dívida do profissional não é aviso do cliente).
    if (!doProfissional) await avisarOClienteDoPedido(Number(l.pedidoId), "pago", { negociacaoId });
    // E o parceiro, pelo mesmo caminho — 02-11-2026 (transferência bancária).
    if (!doProfissional) {
      await avisarProfissionalClientePagouPorPush({
        providerId: Number(l.providerId),
        pedidoId: Number(l.pedidoId),
        negociacaoId,
      });
    }

    return NextResponse.json({ ok: true, valor, metodo });
  } catch (e) {
    console.error("[admin/pagamentos/recebido]", e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível registar o pagamento.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}
