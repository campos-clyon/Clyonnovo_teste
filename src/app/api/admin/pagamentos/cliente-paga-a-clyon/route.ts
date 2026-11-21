import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { appendOrderHistory, ensureNegociacoesTable, getPool, registarSemFalhar } from "@/lib/db";
import {
  PORQUE_NAO_DESFAZ,
  PORQUE_NAO_PASSA,
  fraseDaPassagem,
  fraseDoDesfazer,
  lerPedidoDoClientePagaAClyon,
} from "@/lib/cliente-paga-a-clyon";
import { desfazerOClientePagaAClyon, oQueODialogoPrecisa, passarOClienteAPagarAClyon } from "@/lib/cliente-paga-a-clyon-na-base";
import { segueONovoModelo } from "@/lib/novo-modelo-no-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/admin/pagamentos/cliente-paga-a-clyon — d82 (CEO e dono, 21-11-2026).
 *
 * Só o administrador. Num Trabalho CLYON do modelo de 15-11, o parceiro pediu ao
 * cliente que pagasse à CLYON: o trabalho passa ao caminho em que o cliente paga
 * à CLYON e a CLYON paga ao profissional (a regra da d58), a dívida da taxa sai
 * da carteira do parceiro e as referências por pagar dela ficam canceladas.
 *
 * GET `?negociacaoId=` — o que o diálogo precisa (a base, o valor, se já passou).
 * POST `{ accao: "passar", negociacaoId, motivo, fatura: "com"|"sem", valorTotal?, previsualizar? }`
 * POST `{ accao: "desfazer", negociacaoId, motivo, previsualizar? }` — enquanto o
 * cliente não pagou e não se pagou ao profissional.
 *
 * Com `previsualizar: true` só devolve a conta. NÃO ENVIA NADA A NINGUÉM, não
 * gera referências e não paga: o valor final ao cliente envia-se depois, pelo
 * botão de sempre. A regra é `cliente-paga-a-clyon.ts`; a escrita
 * `cliente-paga-a-clyon-na-base.ts`.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const negociacaoId = Number(req.nextUrl.searchParams.get("negociacaoId"));
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  try {
    const d = await oQueODialogoPrecisa(negociacaoId);
    if (!d) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, ...d });
  } catch (e) {
    console.error("[admin/pagamentos/cliente-paga-a-clyon GET]", e);
    return NextResponse.json({ error: "Não foi possível ler o trabalho." }, { status: 500 });
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
  const lido = lerPedidoDoClientePagaAClyon(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
  const pedido = lido.pedido;
  const quem = colab?.nome ?? "a CLYON";
  const autor = colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null;

  try {
    if (pedido.accao === "desfazer") {
      const r = await desfazerOClientePagaAClyon(pedido, { quem });
      if (!r.ok) {
        if (r.porque === "nao_existe") return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
        return NextResponse.json({ error: PORQUE_NAO_DESFAZ[r.porque] }, { status: 409 });
      }
      const frase = fraseDoDesfazer({ quem, motivo: pedido.motivo, referenciasCanceladas: r.referenciasCanceladas.length });
      if (!r.gravado) return NextResponse.json({ ok: true, previsualizar: true, frase, referenciasCanceladas: r.referenciasCanceladas });
      await appendOrderHistory(r.pedidoId, { type: "note", by: autor, message: frase });
      await registarSemFalhar({
        acontecimento: "pagamento_corrigido",
        pedidoId: r.pedidoId,
        negociacaoId: pedido.negociacaoId,
        providerId: r.providerId,
        autorTipo: "clyon",
        autorNome: quem,
        resumo: frase,
        detalhe: { tipo: "cliente_paga_a_clyon_desfeito", motivo: pedido.motivo, referenciasCanceladas: r.referenciasCanceladas },
      });
      for (const ref of r.referenciasCanceladas) {
        await registarSemFalhar({
          acontecimento: "referencia_anulada",
          pedidoId: r.pedidoId,
          negociacaoId: pedido.negociacaoId,
          providerId: r.providerId,
          autorTipo: "clyon",
          autorNome: quem,
          resumo: `Referência do cliente cancelada por ${quem} (d82, desfeito): o cliente volta a pagar ao parceiro.`,
          valor: ref.valor,
          detalhe: { pagamentoId: ref.pagamentoId, metodo: ref.metodo, motivo: pedido.motivo, euPagoAvisado: false },
        });
      }
      return NextResponse.json({ ok: true, feito: frase });
    }

    // O modelo de 15-11 decide-se fora da transacção (lê os pagamentos), como no acordo final (d78).
    await ensureNegociacoesTable();
    const pool = await getPool();
    if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
    const [linhas] = (await pool.execute(
      `SELECT id, ofertaClyon, estado, execucaoEnviadaEm, provaJson, confirmadoEm, pagoEm, formaDePagamento
         FROM negociacoes WHERE id = ? LIMIT 1`,
      [pedido.negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];
    if (!linhas[0]) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    const novoModelo = await segueONovoModelo({ ...linhas[0], id: pedido.negociacaoId });

    const r = await passarOClienteAPagarAClyon(pedido, { quem, novoModelo });
    if (!r.ok) {
      if (r.porque === "nao_existe") return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
      return NextResponse.json({ error: PORQUE_NAO_PASSA[r.porque] }, { status: 409 });
    }
    const frase = fraseDaPassagem({
      quem,
      motivo: pedido.motivo,
      antes: r.antes,
      depois: r.depois,
      referenciasCanceladas: r.referenciasCanceladas.length,
    });
    if (!r.gravado) {
      return NextResponse.json({
        ok: true,
        previsualizar: true,
        frase,
        antes: r.antes,
        depois: r.depois,
        referenciasCanceladas: r.referenciasCanceladas,
      });
    }
    await appendOrderHistory(r.pedidoId, { type: "note", by: autor, message: frase });
    await registarSemFalhar({
      acontecimento: "pagamento_corrigido",
      pedidoId: r.pedidoId,
      negociacaoId: pedido.negociacaoId,
      providerId: r.providerId,
      autorTipo: "clyon",
      autorNome: quem,
      resumo: frase,
      valor: r.depois.clientePaga,
      detalhe: {
        tipo: "cliente_paga_a_clyon",
        motivo: pedido.motivo,
        comFatura: pedido.comFatura,
        antes: r.antes,
        depois: r.depois,
        referenciasCanceladas: r.referenciasCanceladas,
      },
    });
    for (const ref of r.referenciasCanceladas) {
      await registarSemFalhar({
        acontecimento: "referencia_anulada",
        pedidoId: r.pedidoId,
        negociacaoId: pedido.negociacaoId,
        providerId: r.providerId,
        autorTipo: "clyon",
        autorNome: quem,
        resumo: `Referência da taxa do parceiro cancelada por ${quem} (d82): o cliente paga à CLYON.`,
        valor: ref.valor,
        detalhe: { pagamentoId: ref.pagamentoId, metodo: ref.metodo, motivo: pedido.motivo, euPagoAvisado: false },
      });
    }
    return NextResponse.json({ ok: true, feito: frase, antes: r.antes, depois: r.depois });
  } catch (e) {
    console.error("[admin/pagamentos/cliente-paga-a-clyon]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}
