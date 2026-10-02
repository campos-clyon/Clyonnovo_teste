import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  appendOrderHistory,
  atribuirOfertaClyon,
  registarSemFalhar,
} from "@/lib/db";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { avisarProfissionalEscolhido } from "@/lib/avisar-escolhido-da-oferta";

export const runtime = "nodejs";

/**
 * A CLYON ESCOLHE QUEM FAZ O TRABALHO — entre os que aceitaram a oferta.
 *
 * *«Quando é distribuído a vários, quem fica com o trabalho?» — «A CLYON
 * escolhe.»* — 02-10-2026.
 *
 * A escolha é uma transacção (`atribuirOfertaClyon`): o escolhido fica com o
 * trabalho, os outros que estavam à espera ficam «morta» — a mesma palavra de
 * quem perde um pedido normal para outro profissional — e uma segunda escolha
 * para o mesmo trabalho é recusada em vez de dar o trabalho a dois.
 */
const PORQUE: Record<string, { status: number; erro: string }> = {
  nao_encontrada: { status: 404, erro: "Negociação não encontrada." },
  nao_e_oferta: { status: 409, erro: "Isto não é um trabalho CLYON de valor fixo." },
  nao_aceitou: { status: 409, erro: "Este profissional não aceitou (ou desistiu entretanto)." },
  ja_atribuida: { status: 409, erro: "Este trabalho já tem profissional." },
};

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Negociação não indicada." }, { status: 400 });
  }

  try {
    const r = await atribuirOfertaClyon(negociacaoId);
    if (!r.ok) {
      const p = PORQUE[r.porque];
      return NextResponse.json({ error: p.erro }, { status: p.status });
    }

    const quem = colab?.nome ?? "a CLYON";
    const aviso = await avisarProfissionalEscolhido({
      negociacaoId,
      pedidoId: r.pedidoId,
      providerId: r.providerId,
      baseUrl: urlDeAccaoDoPedido(req.headers),
    });
    const resumo =
      `CLYON (${quem}) escolheu ${aviso.profissional || `o profissional #${r.providerId}`} para o trabalho de valor fixo` +
      (r.encerradas > 0 ? `; ${r.encerradas} outro(s) que tinham aceitado ficaram de fora.` : ".");

    await appendOrderHistory(r.pedidoId, { type: "created", by: null, message: resumo });
    await registarSemFalhar({
      acontecimento: "negociacao_fechada",
      pedidoId: r.pedidoId,
      negociacaoId,
      providerId: r.providerId,
      providerNome: aviso.profissional || null,
      autorTipo: "clyon",
      autorNome: quem,
      valor: aviso.valor,
      valorProfissional: aviso.valor,
      resumo,
      visivelProfissional: true,
    });

    return NextResponse.json({ ok: true, encerradas: r.encerradas, avisado: aviso.saiu });
  } catch (e) {
    console.error("[admin/trabalhos-clyon/escolher]", e);
    return NextResponse.json({ error: "Não foi possível escolher." }, { status: 500 });
  }
}
