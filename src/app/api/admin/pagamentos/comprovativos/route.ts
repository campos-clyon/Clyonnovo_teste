import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { registarSemFalhar } from "@/lib/db";
import { eAlvoDoComprovativo } from "@/lib/origem-do-pagamento";
import { alvoDoComprovativo } from "@/lib/rasto-do-pagamento-na-base";
import { ficheiroDoComprovativo, juntarComprovativo } from "@/lib/comprovativo-no-servidor";
import { MENSAGENS_DO_COMPROVATIVO } from "@/lib/comprovativo-do-pagamento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * JUNTAR O COMPROVATIVO A UM PAGAMENTO JÁ REGISTADO — d66 (18-11-2026).
 *
 * Uma fotografia ou um PDF (até 10 MB, conferido pelos primeiros bytes), a um
 * registo feito à mão: uma linha de `pagamentos` que não veio do euPago, uma
 * parte da cobrança ao profissional, ou o «Já pagámos» ao profissional. Serve
 * os registos antigos «sem comprovativo» e os que se juntam depois.
 *
 * QUEM: o administrador, ou o assistente com a secção Pagamentos
 * (`papel-do-painel.ts`: esta é a única escrita de /api/admin/pagamentos
 * aberta a essa secção — não mexe em dinheiro, só junta a prova).
 * Formulário: `file`, `alvo` («pagamento», «cobranca», «pago_ao_profissional»)
 * e `alvoId`.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const alvo = fd.get("alvo");
  if (!eAlvoDoComprovativo(alvo)) return NextResponse.json({ error: "Diga a que registo junta o comprovativo." }, { status: 400 });
  const alvoId = Number(fd.get("alvoId"));

  const f = await ficheiroDoComprovativo(fd);
  if (!f) return NextResponse.json({ error: MENSAGENS_DO_COMPROVATIVO.semFicheiro }, { status: 400 });
  if (!f.ok) return NextResponse.json({ error: f.erro }, { status: f.status });

  try {
    const onde = await alvoDoComprovativo(alvo, alvoId);
    if ("erro" in onde) return NextResponse.json({ error: onde.erro }, { status: onde.status });
    const por = colab?.nome ?? "a CLYON";
    const [id] = await juntarComprovativo({
      ficheiro: f.ficheiro,
      conferido: f.conferido,
      alvo,
      alvoIds: [alvoId],
      negociacaoId: onde.negociacaoId,
      pedidoId: onde.pedidoId,
      por,
    });
    await registarSemFalhar({
      acontecimento: "comprovativo_do_pagamento",
      pedidoId: onde.pedidoId,
      negociacaoId: onde.negociacaoId,
      autorTipo: "clyon",
      autorNome: por,
      resumo: "Comprovativo do pagamento junto.",
      detalhe: { alvo, alvoId, comprovativoId: id, nome: f.conferido.nome },
    });
    return NextResponse.json({ ok: true, id, nome: f.conferido.nome });
  } catch (e) {
    console.error("[admin/pagamentos/comprovativos]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: MENSAGENS_DO_COMPROVATIVO.falhou }, { status: 500 });
  }
}
