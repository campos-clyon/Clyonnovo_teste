import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { appendOrderHistory, registarSemFalhar } from "@/lib/db";
import {
  PORQUE_NAO_SE_CORRIGE,
  fraseDaCorreccao,
  lerCorreccaoDoPagamento,
} from "@/lib/corrigir-pagamento-registado";
import { corrigirPagamentoRegistado } from "@/lib/corrigir-pagamento-na-base";
import { gerarReferenciaDaDivida } from "@/lib/cobrar-divida-do-profissional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pagamentos/corrigir-pagamento — 04-11-2026 (d9, dono).
 *
 * Corrigir um pagamento já registado à mão: a fatura (com ou sem) e o valor
 * que o cliente pagou. Só o administrador, com motivo obrigatório. Fica no
 * histórico do pedido e no registo permanente quem corrigiu, quando, o antes,
 * o depois e o motivo; a conta em degraus refaz-se sozinha com os valores
 * novos (lê-se da base). A regra é `corrigir-pagamento-registado.ts`.
 *
 * NÃO PAGA NEM COBRA NADA. Num pago em mão com a dívida do profissional ainda
 * aberta e o trabalho feito, a referência dela gera-se de novo com o valor
 * novo — como na confirmação (`gerarReferenciaDaDivida`).
 */
const NAO_ENCONTRADO: Record<string, [string, number]> = {
  nao_existe: ["Trabalho não encontrado.", 404],
  nao_fechado: ["Este trabalho ainda não está fechado.", 409],
  sem_pagamento: ["Este trabalho não tem pagamento registado — registe-o primeiro.", 409],
};

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const lido = lerCorreccaoDoPagamento(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });

  try {
    const r = await corrigirPagamentoRegistado(negociacaoId, lido.pedido);
    if (!r.ok) {
      const [texto, estado] =
        NAO_ENCONTRADO[r.porque] ?? [PORQUE_NAO_SE_CORRIGE[r.porque as keyof typeof PORQUE_NAO_SE_CORRIGE], 409];
      return NextResponse.json({ error: texto }, { status: estado });
    }

    const quem = colab?.nome ?? "a CLYON";
    const frase = fraseDaCorreccao(r.plano, { quem, motivo: lido.pedido.motivo, metodo: r.metodo });
    await appendOrderHistory(r.pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: frase,
    });
    const { antes, depois } = r.plano;
    const retrato = (x: typeof antes) => ({
      semFactura: x.semFactura,
      declarado: x.declarado,
      valor: x.valor,
      taxas: x.taxas,
      iva: x.conta?.iva ?? null,
      taxaDaPlataforma: x.conta?.clyon ?? null,
      profissional: x.conta?.profissional ?? null,
      deveAClyon: x.dividaEmMao?.total ?? null,
    });
    await registarSemFalhar({
      acontecimento: "pagamento_corrigido",
      pedidoId: r.pedidoId,
      negociacaoId,
      providerId: r.providerId,
      autorTipo: "clyon",
      autorNome: quem,
      resumo: frase,
      valor: depois.valor,
      detalhe: {
        pagamentoId: r.pagamentoId,
        metodo: r.metodo,
        motivo: lido.pedido.motivo,
        antes: retrato(antes),
        depois: retrato(depois),
        dividaFechadaCom: r.plano.dividaFechadaCom,
      },
    });

    // A dívida de um pago em mão, ainda aberta: a referência com o valor novo (só se o trabalho está feito).
    if (depois.dividaEmMao && r.plano.dividaFechadaCom == null) {
      await gerarReferenciaDaDivida(negociacaoId, { metodo: "multibanco", autor: { tipo: "clyon", nome: quem } });
    }

    return NextResponse.json({ ok: true, feito: frase });
  } catch (e) {
    console.error("[admin/pagamentos/corrigir-pagamento]", e);
    return NextResponse.json({ error: "Não foi possível corrigir." }, { status: 500 });
  }
}
