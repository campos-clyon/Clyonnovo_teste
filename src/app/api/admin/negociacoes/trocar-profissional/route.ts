import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  appendOrderHistory,
  registarSemFalhar,
  passarOTrabalhoAOutroProfissional,
} from "@/lib/db";

export const runtime = "nodejs";

/**
 * TROCAR A EMPRESA DE UM TRABALHO FECHADO — 01-10-2026.
 *
 * «Esse trabalho já foi concluído por outra empresa. Como é que o admin pode
 * marcar no painel para finalizar o pedido, e até editar a empresa?» — o #368.
 * A regra de como o negócio muda de mãos está em
 * `passarOTrabalhoAOutroProfissional`.
 *
 * NÃO AVISA NINGUÉM: quem perdeu e quem ganhou já sabem — foi um deles que fez
 * o trabalho. Fica escrito quem trocou, de quem para quem e por quanto.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown; providerId?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  const providerId = Number(corpo.providerId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Pedido ou profissional inválido." }, { status: 400 });
  }

  try {
    const r = await passarOTrabalhoAOutroProfissional(pedidoId, providerId);
    if (!r.ok) return NextResponse.json({ error: r.porque }, { status: 409 });

    const porQuem = colab?.nome ?? "a equipa";
    const valor = r.valor != null ? ` (${r.valor.toFixed(2).replace(".", ",")} €)` : "";
    const resumo =
      `Trabalho passado de ${r.deQuem || "—"} para ${r.paraQuem} por CLYON (${porQuem})${valor}. ` +
      `Mesmo valor e mesmas taxas; ${r.deQuem || "o anterior"} deixa de o ter.`;

    await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo });
    await registarSemFalhar({
      acontecimento: "profissional_trocado",
      pedidoId,
      negociacaoId: r.negociacaoId,
      providerId,
      autorTipo: "clyon",
      autorNome: porQuem,
      valor: r.valor,
      resumo,
    });

    return NextResponse.json({ ...r, resumo });
  } catch (error) {
    console.error("[api/admin/negociacoes/trocar-profissional]", error);
    return NextResponse.json({ error: "Não foi possível trocar o profissional." }, { status: 500 });
  }
}
