import { appendOrderHistory, registarSemFalhar } from "./db";
import { trabalhoVistoPeloBackoffice } from "./acesso-ao-pagamento";
import { fraseDaAnulacao, motivoDaAnulacao } from "./anular-a-referencia";
import { gerarReferenciaDaDivida } from "./cobrar-divida-do-profissional";
import { marcasDasNegociacoes } from "./marcas-da-divida-na-base";
import { fecharSemPagar, pagamentosDaNegociacao } from "./pagamentos-na-base";
import { MOTIVO_DA_RESERVA_RETIRADA } from "./reserva";
import { negociacoesComReservaGravada, reservaLigada } from "./reserva-na-base";
import { estadoDaParteDaClyon, ESTADO_EM_PALAVRAS, fraseDoRefazer, refazSe, type EstadoDaParteDaClyon } from "./refazer-sem-reserva";

/**
 * REFAZER SEM A RESERVA, NA BASE — d101 (dono, 24-11-2026). A regra é
 * `refazer-sem-reserva.ts`. Só números de pedido, de negociação e valores:
 * nada de nomes nem telefones.
 */

export type TrabalhoComReserva = {
  pedidoId: number;
  negociacaoId: number;
  valorUnico: number | null;
  valorAcordado: number | null;
  /** A reserva gravada (d39), em euros — já não conta com o interruptor desligado. */
  reservaGravada: number;
  estado: EstadoDaParteDaClyon;
  estadoEmPalavras: string;
  /** As referências por pagar desta negociação. */
  pendentes: Array<{ pagamentoId: number; metodo: string; valor: number; referencia: string | null }>;
  /** O que já está pago nesta negociação (pagamentos «pago»). */
  pago: number;
  /** Do modelo de 15-11 (o parceiro passa a parte da CLYON). Fora dele, não se mexe. */
  noModeloNovo: boolean | null;
};

export async function trabalhosComReserva(): Promise<TrabalhoComReserva[]> {
  const gravadas = await negociacoesComReservaGravada();
  const marcas = await marcasDasNegociacoes(gravadas.map((g) => g.negociacaoId));
  const lista: TrabalhoComReserva[] = [];
  for (const g of gravadas) {
    const pagamentos = await pagamentosDaNegociacao(g.negociacaoId);
    const estado = estadoDaParteDaClyon(pagamentos, marcas.get(g.negociacaoId) ?? []);
    const acesso = await trabalhoVistoPeloBackoffice(g.negociacaoId).catch(() => null);
    lista.push({
      pedidoId: g.pedidoId,
      negociacaoId: g.negociacaoId,
      valorUnico: g.valorUnicoCliente,
      valorAcordado: g.valorAcordado,
      reservaGravada: g.reservaCent / 100,
      estado,
      estadoEmPalavras: ESTADO_EM_PALAVRAS[estado],
      pendentes: pagamentos
        .filter((p) => p.estado === "pendente")
        .map((p) => ({ pagamentoId: p.id, metodo: p.metodo, valor: p.valor, referencia: p.referencia ?? null })),
      pago: Math.round(pagamentos.filter((p) => p.estado === "pago").reduce((s, p) => s + (Number(p.valor) || 0), 0) * 100) / 100,
      noModeloNovo: acesso?.ok ? acesso.trabalho.novoModelo : null,
    });
  }
  return lista;
}

export type ResultadoDoRefazer = {
  refeitas: Array<{
    pedidoId: number;
    negociacaoId: number;
    anuladas: Array<{ pagamentoId: number; valor: number }>;
    nova: { pagamentoId: number; valor: number; referencia: string | null } | null;
    porqueSemNova: string | null;
  }>;
  /** Pagas (no todo ou em parte): não se mexeu. Para o dono decidir. */
  pagas: TrabalhoComReserva[];
  /** Fora do modelo de 15-11, ou que não se leram: não se mexeu. */
  porVer: Array<TrabalhoComReserva & { porque: string }>;
};

export async function refazerSemReserva(quem: {
  id: number | null;
  nome: string;
  papel: string | null;
}): Promise<{ ok: true; resultado: ResultadoDoRefazer } | { ok: false; erro: string }> {
  // Com a reserva ligada, a referência nova voltava a levá-la.
  if (await reservaLigada()) {
    return { ok: false, erro: "A «Reserva do valor único» está ligada nas Configs: desligue-a antes de refazer." };
  }
  const by = quem.id != null ? { id: quem.id, nome: quem.nome, role: quem.papel ?? "admin" } : null;
  const resultado: ResultadoDoRefazer = { refeitas: [], pagas: [], porVer: [] };

  for (const t of await trabalhosComReserva()) {
    if (!refazSe(t.estado)) {
      resultado.pagas.push(t);
      continue;
    }
    if (t.noModeloNovo !== true) {
      resultado.porVer.push({
        ...t,
        porque: t.noModeloNovo == null ? "Não se leu o trabalho." : "Não é do modelo de 15-11: o parceiro não passa a parte da CLYON.",
      });
      continue;
    }

    // 1. A nova, pelo caminho de sempre — a conta já sem a reserva (interruptor desligado).
    //    Primeiro a nova, depois anular as velhas: o parceiro nunca fica sem referência por um euPago a falhar.
    const g = await gerarReferenciaDaDivida(t.negociacaoId, { metodo: "multibanco", autor: { tipo: "clyon", nome: quem.nome } });
    const nova = g.ok ? { pagamentoId: g.pagamento.id, valor: g.pagamento.valor, referencia: g.pagamento.referencia ?? null } : null;
    const porqueSemNova = g.ok ? null : g.porque;
    if (!g.ok && t.pendentes.length > 0 && !/ainda não foi confirmado/i.test(g.porque)) {
      // Sem a nova (o euPago falhou, ou outra razão), a velha fica — e diz-se porquê.
      resultado.porVer.push({ ...t, porque: `A referência nova não se gerou: ${g.porque}` });
      continue;
    }

    // 2. As velhas, por pagar, ficam «cancelado» (nunca se apagam) — o caminho do «Anular a referência».
    const anuladas: Array<{ pagamentoId: number; valor: number }> = [];
    for (const p of t.pendentes) {
      if (nova && p.pagamentoId === nova.pagamentoId) continue;
      const r = await fecharSemPagar(p.pagamentoId, "cancelado", { motivo: motivoDaAnulacao(quem.nome, MOTIVO_DA_RESERVA_RETIRADA) });
      if (!r.feito) continue;
      anuladas.push({ pagamentoId: p.pagamentoId, valor: p.valor });
      const frase = fraseDaAnulacao(p, { quem: quem.nome, motivo: MOTIVO_DA_RESERVA_RETIRADA });
      await registarSemFalhar({
        acontecimento: "referencia_anulada",
        pedidoId: t.pedidoId,
        negociacaoId: t.negociacaoId,
        autorTipo: "clyon",
        autorNome: quem.nome,
        resumo: frase,
        valor: p.valor,
        detalhe: { pagamentoId: p.pagamentoId, metodo: p.metodo, referencia: p.referencia, motivo: MOTIVO_DA_RESERVA_RETIRADA, euPagoAvisado: false, d101: true },
      });
    }

    // 3. Uma linha no histórico do pedido.
    await appendOrderHistory(t.pedidoId, {
      type: "note",
      by,
      message: fraseDoRefazer({ negociacaoId: t.negociacaoId, anuladas, nova, porqueSemNova, quem: quem.nome }),
    }).catch((e) => console.error("[refazer-sem-reserva] histórico:", e instanceof Error ? e.message : e));

    resultado.refeitas.push({ pedidoId: t.pedidoId, negociacaoId: t.negociacaoId, anuladas, nova, porqueSemNova });
  }
  return { ok: true, resultado };
}
