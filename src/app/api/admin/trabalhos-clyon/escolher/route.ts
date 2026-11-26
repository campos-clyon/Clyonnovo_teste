import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  appendOrderHistory,
  atribuirOfertaClyon,
  registarSemFalhar,
} from "@/lib/db";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { avisarOClienteDoPedido } from "@/lib/avisos-ao-cliente";
import { avisarProfissionalEscolhido } from "@/lib/avisar-escolhido-da-oferta";
import { guiaImpedeANegociacao } from "@/lib/guia-na-base";
import { confirmouSemGuia, notaSemGuia, RECUSA_SEM_A_CONFIRMACAO_DA_GUIA } from "@/lib/guia-no-backoffice";
import { faltaOSimDoCliente, HISTORICO as HISTORICO_DO_SIM, lerSimDoCliente, RECUSA_SEM_O_SIM_DO_CLIENTE } from "@/lib/sim-do-cliente";
import { getSimulatorOrderById } from "@/lib/db";

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

  let corpo: { negociacaoId?: unknown; semGuiaConfirmado?: unknown; simDoCliente?: unknown };
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
    /*
     * O SIM DO CLIENTE ANTES DE ESCOLHER — d130 (o #652). Sem ele: «reservar»
     * (a escolha faz-se quando o cliente aceitar) ou «telefone» (o sim fica
     * registado com quem carregou). Sem escolha, 409 com o aviso.
     */
    const quemEscolhe = colab?.nome ?? "a CLYON";
    const porQuem = colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null;
    const simDoCliente = lerSimDoCliente(corpo.simDoCliente);
    const base = await import("@/lib/sim-do-cliente-na-base");
    const daNegociacao = await base.pedidoDaNegociacao(negociacaoId);
    const doPedido = daNegociacao ? ((await getSimulatorOrderById(daNegociacao.pedidoId)) as unknown as Record<string, unknown> | undefined) : undefined;
    if (daNegociacao && doPedido && faltaOSimDoCliente(doPedido)) {
      if (!simDoCliente) return NextResponse.json(RECUSA_SEM_O_SIM_DO_CLIENTE, { status: 409 });
      if (simDoCliente === "reservar") {
        const semGuia = await guiaImpedeANegociacao(negociacaoId);
        if (semGuia && !confirmouSemGuia(corpo)) return NextResponse.json(RECUSA_SEM_A_CONFIRMACAO_DA_GUIA, { status: 409 });
        await base.gravarReserva({
          pedidoId: daNegociacao.pedidoId,
          tipo: "reserva",
          providerId: daNegociacao.providerId,
          negociacaoId,
          por: porQuem,
          semGuiaConfirmado: semGuia,
        });
        const r = await base.reservaDoPedido(daNegociacao.pedidoId);
        const nome = r?.profissional || `o parceiro #${daNegociacao.providerId}`;
        await appendOrderHistory(daNegociacao.pedidoId, { type: "note", by: porQuem, message: HISTORICO_DO_SIM.reservado(quemEscolhe, nome) });
        return NextResponse.json({ ok: true, reservado: true, profissional: nome, feito: `#${daNegociacao.pedidoId}: ${nome} reservado — à espera do sim do cliente.` });
      }
      if (!(await base.registarOSimPorTelefone(daNegociacao.pedidoId, { quem: quemEscolhe, por: porQuem }))) {
        return NextResponse.json({ error: "O sim do cliente não se gravou (o valor mudou entretanto?). Tente outra vez." }, { status: 409 });
      }
    }

    /*
     * A GUIA ANTES DE ESCOLHER — 04-11-2026 (d10.1). Num trabalho de resíduos,
     * quem tem a guia por verificar pode aceitar a oferta, mas não ser escolhido.
     */
    // d121 (25-11-2026): sem guia verificada, escolhe-se com o sim explícito; sem ele, 409 com a frase nova.
    const semGuia = await guiaImpedeANegociacao(negociacaoId);
    if (semGuia && !confirmouSemGuia(corpo)) {
      return NextResponse.json(RECUSA_SEM_A_CONFIRMACAO_DA_GUIA, { status: 409 });
    }
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
    if (semGuia) await appendOrderHistory(r.pedidoId, { type: "note", by: null, message: notaSemGuia(quem) }).catch(() => {});
    // O cliente fica a saber quem faz o trabalho (S10), como a CLYON já lho diz na adjudicação.
    await avisarOClienteDoPedido(r.pedidoId, "escolhido", { nome: aviso.profissional || null, negociacaoId });
    await registarSemFalhar({
      acontecimento: "negociacao_fechada",
      pedidoId: r.pedidoId,
      negociacaoId,
      providerId: r.providerId,
      providerNome: aviso.profissional || null,
      autorTipo: "clyon",
      autorNome: quem,
      valor: aviso.valorDoTrabalho ?? aviso.valor,
      valorProfissional: aviso.valor,
      resumo,
      visivelProfissional: true,
    });

    // d130: uma reserva de antes deixa de valer — o trabalho já tem quem o faça.
    await base.tirarReservaSemAvisar(r.pedidoId).catch(() => null);
    return NextResponse.json({ ok: true, encerradas: r.encerradas, avisado: aviso.saiu });
  } catch (e) {
    console.error("[admin/trabalhos-clyon/escolher]", e);
    return NextResponse.json({ error: "Não foi possível escolher." }, { status: 500 });
  }
}
