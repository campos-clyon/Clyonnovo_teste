import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { appendOrderHistory, mudarAFacturaDaNegociacao } from "@/lib/db";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";

export const runtime = "nodejs";

/**
 * POST /api/admin/pagamentos/factura — COM OU SEM FACTURA, 21-10-2026.
 *
 * *«Nesse caso a cliente pagou 510 total sem fatura, temos que ter a opção
 * de sem fatura.»* Desde 22-10-2026 sem factura só sai o IVA: *«para o
 * profissional, não muda nada»* — a regra está em `sem-factura.ts`.
 * Dinheiro, por isso só do administrador, e fica no histórico do pedido quem
 * mudou e o que cada um passa a pagar e a receber.
 */
const PORQUE: Record<string, [string, number]> = {
  nao_existe: ["Trabalho não encontrado.", 404],
  nao_fechado: ["Este trabalho ainda não está fechado.", 409],
  em_dinheiro: ["Em dinheiro o profissional recebe em mão — aqui não se muda.", 409],
  ja_entrou: ["O pagamento do cliente já está registado — para mudar agora, corrija o valor.", 409],
  pro_ja_pago: ["Já se pagou ao profissional, e acertar mudaria o que ele recebeu — para mudar agora, corrija o valor.", 409],
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
    // Só sai ou entra o IVA (22-10-2026) — a não ser numa marcada com a regra de 21-10-2026, que se acerta.
    const acertou = r.depois.cliente !== r.antes.cliente || r.depois.profissional !== r.antes.profissional;
    const comoFica = semFactura ? "Sem factura" : "Com factura";
    const resumo = acertou
      ? `${comoFica}, por ${quem}, acertado à regra de 22-10-2026: as taxas voltam a ${pct(r.depois.cliente)} do cliente e ` +
        `${pct(r.depois.profissional)} do profissional — o profissional recebe ${euros(recebe)}.`
      : semFactura
        ? `Sem factura, por ${quem}: o cliente paga sem IVA — o profissional recebe o mesmo, ${euros(recebe)}.`
        : `Com factura outra vez, por ${quem}: o cliente paga com IVA — o profissional recebe o mesmo, ${euros(recebe)}.`;
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
