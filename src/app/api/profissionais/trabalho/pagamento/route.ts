import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { negociacaoNoTerreno } from "@/lib/db";
import { ACCAO_NAO_RECEBI, ACCAO_RECEBI, parceiroNaoRecebeu, parceiroRecebeu } from "@/lib/pagamento-registado-no-servidor";
import { limitarPorConta } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * O PARCEIRO DIZ SE RECEBEU — d3 (23-11-2026). `{ negociacaoId, accao }` com a
 * sessão do parceiro (painel e app CLYON Pro), só num trabalho dele:
 *
 *   · «recebi» — «Sim, recebi» (depois de o cliente dizer que pagou) ou «O cliente
 *     já me pagou» (sem o cliente ter dito nada). O pedido passa a «Pago».
 *   · «nao_recebi» — «Ainda não recebi», só depois de o cliente dizer que pagou:
 *     fica o selo «Pagamento em dúvida» na Mesa.
 *
 * A regra, as guardas e os avisos estão em `pagamento-registado-no-servidor.ts`.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const limite = await limitarPorConta("profissional-pagamento", `prof:${sessao.providerId}`, 30, 300);
  if (limite.erro) return limite.erro;

  let corpo: { negociacaoId?: unknown; accao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  if (corpo.accao !== ACCAO_RECEBI && corpo.accao !== ACCAO_NAO_RECEBI) {
    return NextResponse.json({ error: "Resposta desconhecida." }, { status: 400 });
  }

  try {
    const n = await negociacaoNoTerreno(negociacaoId);
    if (!n || Number(n.providerId) !== sessao.providerId) {
      return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    }
    const dados = { pedidoId: Number(n.pedidoId), negociacaoId, providerId: sessao.providerId, autorNome: sessao.nome };
    const r = corpo.accao === ACCAO_RECEBI ? await parceiroRecebeu(dados) : await parceiroNaoRecebeu(dados);
    return NextResponse.json(r.corpo, { status: r.status });
  } catch (error) {
    console.error("[profissionais/trabalho/pagamento]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível registar." }, { status: 500 });
  }
}
