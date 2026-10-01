import {
  appendOrderHistory,
  levantamentosDoProfissional,
  negociacoesDoProfissional,
  registarSemFalhar,
} from "./db";
import { trabalhosDaCarteira } from "./carteira-do-profissional";
import {
  carteiraDe,
  dividasDe,
  planoDeAbatimento,
  type DividaNaCarteira,
} from "./carteira";
import { METODO_DO_ABATIMENTO } from "./divida-do-profissional";
import { registarRecebimentoAMao } from "./pagamentos-na-base";
import { configuracaoDoEupago } from "./eupago";

/**
 * ABATER NO SALDO AS DÍVIDAS DO PROFISSIONAL — 01-10-2026.
 *
 * "E se o profissional não pagar a dívida? — Abater no saldo + bloquear." —
 * decisão do dono, 01-10-2026.
 *
 * COMO FUNCIONA, DE PONTA A PONTA
 *
 *   1. Enquanto deve, o que deve fica RESERVADO no disponível: só pode pedir
 *      a transferência do resto (`levantavelDe`, na rota do levantamento).
 *   2. A CLYON faz a transferência e marca o levantamento como pago.
 *   3. AQUI: lê-se a carteira outra vez — já com esse levantamento pago — e o
 *      que sobra no disponível é o que estava reservado. As dívidas que lá
 *      cabem, inteiras e das mais antigas para as mais novas
 *      (`planoDeAbatimento`), ficam pagas com esse saldo.
 *   4. Cada uma fica escrita em três sítios: uma linha `abatimento` em
 *      `pagamentos`, com o valor e o número do levantamento (é ela que dá a
 *      dívida por paga, pelo mesmo índice único de um pagamento qualquer); o
 *      registo permanente (`divida_abatida`); e o histórico do pedido.
 *   5. A carteira passa a tirar esse valor do disponível (`abatidoEmDividas`),
 *      e o bloqueio dos trabalhos em dinheiro levanta-se sozinho.
 *
 * PORQUE NÃO SE MEXE EM DINHEIRO SOZINHO. Nada disto transfere, desconta ou
 * cobra: a transferência foi feita por uma pessoa, do valor que ele pediu, e
 * o que aqui se escreve é que a parte do saldo que já estava reservada foi a
 * forma de pagamento da dívida. É o mesmo que registar à mão «pagou por
 * transferência» — só que o «como» é o saldo dele, e o «quando» é o
 * levantamento.
 *
 * O QUE PODE CORRER MAL, E O QUE ACONTECE:
 *   · ele paga a referência no mesmo minuto — a base recusa a segunda linha
 *     (`uq_uma_paga`) e essa dívida fica paga por referência, sem abatimento;
 *   · já tinha uma Multibanco viva — passa a `substituido`, como em qualquer
 *     pagamento à mão. Se ainda a pagar no homebanking, o euPago avisa e o
 *     webhook regista-a como pagamento em duplicado, para devolver;
 *   · isto falha a meio — o levantamento já está pago, e as dívidas que não
 *     se escreveram continuam reservadas no disponível (o limite do passo 1
 *     não deixa levantar esse dinheiro). Abatem-se no levantamento seguinte.
 *
 * Nunca lança: quem chama acabou de marcar uma transferência como feita, e uma
 * falha aqui não a pode desfazer. Devolve o que fez, para o ecrã o dizer.
 */

export type ResultadoDoAbatimento = {
  abatidas: Array<{ negociacaoId: number; pedidoId: number | null; valor: number }>;
  /** As que ficaram por pagar — não cabiam no saldo, ou falharam. */
  ficam: Array<{ negociacaoId: number; valor: number }>;
  totalAbatido: number;
  erro?: string;
};

function euros(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

/**
 * O plano, lido da base — o mesmo para o abatimento e para a previsão que o
 * backoffice mostra antes de marcar o levantamento como pago.
 *
 * Um levantamento por transferir já sai do disponível («a caminho»), e por
 * isso o plano é o mesmo antes e depois de ele ser dado por pago: o que se vê
 * na previsão é o que vai acontecer.
 */
async function lerOPlano(providerId: number, agora: Date) {
  const [linhas, levantamentos] = await Promise.all([
    negociacoesDoProfissional(providerId),
    levantamentosDoProfissional(providerId),
  ]);
  const trabalhos = await trabalhosDaCarteira(linhas);
  const dividas = dividasDe(trabalhos, agora).filter((d) => !d.paga);
  const carteira = carteiraDe(
    trabalhos,
    levantamentos.map((l) => ({ id: l.id, valor: Number(l.valor), estado: l.estado })),
    agora,
  );
  return { linhas, dividas, plano: planoDeAbatimento(dividas, carteira.disponivel) };
}

/**
 * O QUE VAI ACONTECER se este levantamento for dado por pago — para o
 * backoffice o dizer antes de alguém carregar no botão. Nunca lança.
 */
export async function previsaoDoAbatimento(
  providerId: number,
  agora: Date = new Date(),
): Promise<{ aPagarAClyon: number; abate: number; ficaPorPagar: number } | null> {
  try {
    const { dividas, plano } = await lerOPlano(providerId, agora);
    if (dividas.length === 0) return null;
    const aPagarAClyon = Math.round(dividas.reduce((s, d) => s + d.total, 0) * 100) / 100;
    return {
      aPagarAClyon,
      abate: plano.totalAbatido,
      ficaPorPagar: Math.round((aPagarAClyon - plano.totalAbatido) * 100) / 100,
    };
  } catch (e) {
    console.error("[abater-dividas-no-saldo] previsão:", e);
    return null;
  }
}

export async function abaterDividasNoSaldo(
  providerId: number,
  opcoes: {
    /** O levantamento que acabou de ser pago. */
    levantamentoId: number;
    /** Quem marcou o levantamento como pago. */
    autor: string;
    agora?: Date;
  },
): Promise<ResultadoDoAbatimento> {
  const vazio: ResultadoDoAbatimento = { abatidas: [], ficam: [], totalAbatido: 0 };
  try {
    const agora = opcoes.agora ?? new Date();
    const { linhas, dividas, plano } = await lerOPlano(providerId, agora);
    if (dividas.length === 0) return vazio;

    const conf = configuracaoDoEupago(process.env);
    const ambiente = conf.ok ? conf.config.ambiente : "producao";

    const saida: ResultadoDoAbatimento = {
      abatidas: [],
      ficam: plano.ficam.map((d) => ({ negociacaoId: d.negociacaoId, valor: d.total })),
      totalAbatido: 0,
    };

    for (const d of plano.abater) {
      const feita = await abaterUma(d, {
        providerId,
        pedidoId: linhas.find((l) => l.id === d.negociacaoId)?.pedidoId ?? null,
        levantamentoId: opcoes.levantamentoId,
        autor: opcoes.autor,
        ambiente,
        agora,
      });
      if (feita) {
        saida.abatidas.push(feita);
        saida.totalAbatido = Math.round((saida.totalAbatido + feita.valor) * 100) / 100;
      } else {
        saida.ficam.push({ negociacaoId: d.negociacaoId, valor: d.total });
      }
    }
    return saida;
  } catch (e) {
    console.error("[abater-dividas-no-saldo]", e);
    return { ...vazio, erro: e instanceof Error ? e.message : String(e) };
  }
}

async function abaterUma(
  d: DividaNaCarteira,
  c: {
    providerId: number;
    pedidoId: number | null;
    levantamentoId: number;
    autor: string;
    ambiente: "producao" | "sandbox";
    agora: Date;
  },
): Promise<{ negociacaoId: number; pedidoId: number | null; valor: number } | null> {
  const r = await registarRecebimentoAMao({
    negociacaoId: d.negociacaoId,
    pedidoId: c.pedidoId ?? 0,
    providerId: c.providerId,
    metodo: METODO_DO_ABATIMENTO,
    valor: d.total,
    quando: c.agora,
    ambiente: c.ambiente,
    levantamentoId: c.levantamentoId,
  });
  // Já paga entretanto (por referência, ou outro abatimento): a base disse
  // que não, e é ela que manda. Fica como estava.
  if (!r.feito) return null;

  const resumo =
    `Dívida de ${euros(d.total)} (IVA ${euros(d.iva)} + comissão ${euros(d.comissao)}) ` +
    `abatida no saldo do profissional, no levantamento #${c.levantamentoId}.`;

  await registarSemFalhar({
    acontecimento: "divida_abatida",
    pedidoId: c.pedidoId,
    negociacaoId: d.negociacaoId,
    levantamentoId: c.levantamentoId,
    providerId: c.providerId,
    autorTipo: "clyon",
    autorNome: c.autor,
    valor: d.total,
    resumo,
    detalhe: {
      pagamentoId: r.pagamentoId,
      levantamentoId: c.levantamentoId,
      iva: d.iva,
      comissao: d.comissao,
      decisao: "Abater no saldo + bloquear — decisão do dono, 01-10-2026.",
    },
  });

  if (c.pedidoId != null) {
    await appendOrderHistory(c.pedidoId, {
      type: "created",
      by: null,
      message: `${resumo} Marcado por ${c.autor}.`,
    }).catch(() => {});
  }

  return { negociacaoId: d.negociacaoId, pedidoId: c.pedidoId, valor: d.total };
}
