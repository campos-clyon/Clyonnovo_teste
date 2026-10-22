import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { appendOrderHistory, mudarAFacturaDaNegociacao } from "@/lib/db";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";

export const runtime = "nodejs";

/**
 * POST /api/admin/pagamentos/factura — COM OU SEM FACTURA, 21-10-2026.
 *
 * *«Nesse caso a cliente pagou 510 total sem fatura, temos que ter a opção
 * de sem fatura.»* Sem factura, as taxas da CLYON (5 % + 6 %) juntam-se e saem
 * do valor do trabalho; daí em diante, com ou sem factura só muda o IVA — *«os
 * 23 % não pertencem à CLYON»* (22-10-2026). A regra está em `sem-factura.ts`.
 * Dinheiro, por isso só do administrador, e fica no histórico do pedido quem
 * mudou e o que cada um passa a pagar e a receber.
 */
const PORQUE: Record<string, [string, number]> = {
  nao_existe: ["Trabalho não encontrado.", 404],
  nao_fechado: ["Este trabalho ainda não está fechado.", 409],
  em_dinheiro: ["Em dinheiro o profissional recebe em mão — aqui não se muda.", 409],
  ja_entrou: ["O pagamento do cliente já está registado — para mudar agora, corrija o valor.", 409],
  pro_ja_pago: ["Já se pagou ao profissional, e sem factura as taxas juntam-se — ele receberia outro valor. Para mudar agora, corrija o valor.", 409],
  ja_esta: ["Já está assim.", 409],
};

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; semFactura?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const semFactura = corpo.semFactura === true;

  try {
    const r = await mudarAFacturaDaNegociacao(negociacaoId, semFactura);
    if (!r.ok) {
      const [texto, estado] = PORQUE[r.porque];
      return NextResponse.json({ error: texto }, { status: estado });
    }
    const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
    const pct = (p: number) => `${Math.round(p * 1000) / 10} %`.replace(".", ",");
    const quem = colab?.nome ?? "a CLYON";
    const recebe = quantoOProfissionalRecebe(r.valor, r.depois);
    // As taxas juntaram-se agora? Senão, só entrou ou saiu o IVA (22-10-2026).
    const juntou = r.depois.cliente !== r.antes.cliente || r.depois.profissional !== r.antes.profissional;
    const resumo = juntou
      ? `Sem factura, por ${quem}: o cliente paga ${euros(r.valor)}, sem IVA, e as taxas da CLYON ` +
        `(${pct(r.antes.cliente)} + ${pct(r.antes.profissional)} = ${pct(r.depois.profissional)}) saem desse valor — ` +
        `o profissional recebe ${euros(recebe)}, com ou sem factura.`
      : semFactura
        ? `Sem factura, por ${quem}: o cliente paga sem IVA — o profissional recebe o mesmo, ${euros(recebe)}.`
        : `Com factura, por ${quem}: soma-se o IVA ao que o cliente paga — o profissional recebe o mesmo, ${euros(recebe)}.`;
    await appendOrderHistory(r.pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: resumo,
    });
    return NextResponse.json({ ok: true, feito: resumo });
  } catch (e) {
    console.error("[admin/pagamentos/factura]", e);
    return NextResponse.json({ error: "Não foi possível mudar." }, { status: 500 });
  }
}
