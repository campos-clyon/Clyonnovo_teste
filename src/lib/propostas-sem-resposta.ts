import type { Proposta } from "@/lib/negociacao";
import { propostasParaOCliente, trabalhoFechado } from "@/lib/mensagem-das-propostas";
import { eurosCurtos, valorComIva } from "@/lib/extra-no-local";
import { lerBase, unidadeDaBase } from "@/lib/base-do-preco";
import { pedidoFechado } from "@/lib/pedido-arrumado";
import { instanteDaBase } from "@/lib/hora-de-lisboa";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";

/**
 * PROPOSTAS HÁ MAIS DE 24 H SEM RESPOSTA DO CLIENTE — d54, 16-11-2026.
 *
 * O cliente recebeu propostas de parceiros e não disse nada. O Início mostra
 * esses pedidos (pelo n.º do pedido, do maior para o menor) com um botão
 * «Copiar mensagem»: a mensagem sai pronta, com os valores já postos, e NUNCA
 * se envia sozinha — quem a copia é quem a manda.
 *
 *   · às 24 h — a lembrança com a mais em conta («desde …»), ou a única;
 *   · às 72 h — a pergunta final: ainda precisa? o preço serve?
 *
 * Os textos são os do Vendas, conferidos pelo CEO (16-11-2026).
 *
 * «A MAIS EM CONTA» é a proposta com o MENOR TOTAL que o cliente paga, e não a
 * de menor valor sem IVA: com parceiros de regimes diferentes, as duas ordens
 * divergem. `propostasParaOCliente` já as devolve por esse total (`aPagar`).
 *
 * O VALOR diz-se como no resto das mensagens (`valorComIva`, d47): «105 € +
 * IVA = 129,15 €»; com um parceiro isento, o total e «(isento de IVA)». A
 * unidade («por carga», «por hora») vem da base do preço do pedido.
 *
 * «VERIFICADO» SÓ QUANDO É VERDADE (Termos §10, a regra q da orquestra): a
 * mensagem diz «parceiros verificados» quando todos os que propuseram têm as
 * três confirmações (`SQL_DO_VERIFICADO`, posto pela rota em `verificado`);
 * senão, diz só «parceiros».
 *
 * FICAM DE FORA: os pedidos fechados (cancelados, arquivados, concluídos), os
 * que já têm trabalho combinado, os de valor único enviado (d39 — a mensagem
 * desses é outra) e aqueles em que o cliente respondeu com uma contraproposta
 * que ainda está à espera do parceiro.
 */

export const HORAS_DA_PRIMEIRA_LEMBRANCA = 24;
export const HORAS_DA_ULTIMA_LEMBRANCA = 72;

/*
 * SEM LINK NA MENSAGEM — CEO, 16-11-2026. O link do cliente só se guarda em
 * hash: dar um link aqui obrigava a gerar um novo, e o antigo morria mesmo
 * que a mensagem nunca fosse enviada. A mensagem remete para o link que o
 * cliente já tem; um link novo, quando for preciso, pede-se de propósito no
 * reenviar que já existe.
 */
export const NO_LINK_QUE_TEM = "na ligação do pedido que lhe enviámos";

type NegociacaoDoLembrete = Parameters<typeof propostasParaOCliente>[0][number] & {
  id?: number | string;
  regimeIva?: string | null;
  /** O parceiro tem as três confirmações (posto pela rota, `parceirosParaOValorUnico`). */
  verificado?: boolean;
};

export type PedidoParaOLembrete = {
  id: number | string;
  status?: string | null;
  serviceType?: string | null;
  baseDoPreco?: string | null;
  /** Quando o orçamento foi ao cliente (o «Enviar orçamento» da Mesa). */
  propostaEnviadaEm?: string | Date | null;
  /** O valor único enviado (d39): com ele, o pedido fica fora desta lista. */
  valorUnicoCliente?: string | number | null;
  negociacoes: NegociacaoDoLembrete[];
};

export type FaseDoLembrete = "24h" | "72h";

export type Lembrete = {
  pedidoId: number;
  servico: string;
  fase: FaseDoLembrete;
  /** Há quantas horas inteiras o cliente tem as propostas. */
  horas: number;
  quantas: number;
  /** A mais em conta, já dita: «105 € + IVA = 129,15 €» ou «120 € (isento de IVA)». */
  valorDoCliente: string;
  /** « por carga», « por hora» ou "". */
  unidade: string;
  isento: boolean;
  /** Todos os que propuseram são verificados? Só então a mensagem o diz. */
  verificados: boolean;
};

function lerPropostas(json: string | null | undefined): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

/** O cliente fez uma contraproposta que ainda está à espera do parceiro? É uma resposta. */
function clienteRespondeu(negociacoes: readonly NegociacaoDoLembrete[]): boolean {
  return negociacoes.some((n) => {
    if (n.estado === "desistida" || n.estado === "morta") return false;
    const ultima = lerPropostas(n.propostasJson).at(-1);
    return ultima?.por === "cliente" && ultima.estado === "pendente";
  });
}

/**
 * Desde quando o cliente tem as propostas: desde que o orçamento lhe foi
 * enviado, ou — sem envio registado — desde a primeira das propostas em cima
 * da mesa (o parceiro propôs, ou aceitou o valor do cliente).
 */
function desdeQuando(p: PedidoParaOLembrete): Date | null {
  const enviada = instanteDaBase(p.propostaEnviadaEm ?? null);
  if (enviada) return enviada;
  let primeira: Date | null = null;
  for (const n of p.negociacoes) {
    if (n.estado === "acordada" || n.estado === "desistida" || n.estado === "morta") continue;
    const ultima = lerPropostas(n.propostasJson).at(-1);
    if (!ultima) continue;
    const conta = ultima.por === "profissional" || (ultima.por === "cliente" && ultima.estado === "aceite");
    if (!conta || ultima.estado === "recusada" || ultima.estado === "expirada") continue;
    const d = instanteDaBase(ultima.criadaEm as string | Date);
    if (d && (!primeira || d.getTime() < primeira.getTime())) primeira = d;
  }
  return primeira;
}

/** O lembrete de um pedido, ou `null` se não precisa de nenhum (ainda, ou já). */
export function lembreteDasPropostas(p: PedidoParaOLembrete, agora: Date): Lembrete | null {
  if (pedidoFechado(p.status)) return null;
  if (p.valorUnicoCliente != null && String(p.valorUnicoCliente).trim() !== "") return null;
  if (trabalhoFechado(p.negociacoes)) return null;
  if (clienteRespondeu(p.negociacoes)) return null;

  const propostas = propostasParaOCliente(p.negociacoes);
  if (propostas.length === 0) return null;

  const desde = desdeQuando(p);
  if (!desde) return null;
  const horas = (agora.getTime() - desde.getTime()) / 3_600_000;
  if (horas < HORAS_DA_PRIMEIRA_LEMBRANCA) return null;

  // Já ordenadas pelo total que o cliente paga: a primeira é a mais em conta.
  const maisEmConta = propostas[0];
  const negociacao = p.negociacoes.find((n) => Number(n.id) === maisEmConta.negociacaoId);
  const regime = maisEmConta.contaDoNovoModelo?.regime ?? (negociacao?.regimeIva === "isento" ? "isento" : null);
  const isento = regime === "isento";
  const verificados = propostas.every(
    (x) => p.negociacoes.find((n) => Number(n.id) === x.negociacaoId)?.verificado === true,
  );

  return {
    pedidoId: Number(p.id),
    servico: p.serviceType ? servicoEmPalavras(p.serviceType) : "serviço",
    fase: horas >= HORAS_DA_ULTIMA_LEMBRANCA ? "72h" : "24h",
    horas: Math.floor(horas),
    quantas: propostas.length,
    valorDoCliente: isento
      ? `${eurosCurtos(maisEmConta.total)} (isento de IVA)`
      : valorComIva(maisEmConta.semIva, maisEmConta.total),
    unidade: unidadeDaBase(lerBase(p.baseDoPreco)),
    isento,
    verificados,
  };
}

/** A mensagem pronta a copiar — sem link: remete para o que o cliente já recebeu. */
export function mensagemDoLembrete(l: Lembrete): string {
  // Textos do Vendas desde 17-11-2026 (d66): mais vendedores, sem emoji; o 72h continua sem link.
  if (l.fase === "72h") {
    return (
      `Olá! ${l.quantas === 1 ? `A proposta do pedido #${l.pedidoId} continua válida.` : `As propostas do pedido #${l.pedidoId} continuam válidas.`} ` +
      `Se ainda quiser avançar, responda SIM e reservamos ${l.quantas === 1 ? "a proposta" : "a mais em conta"}. ` +
      `Se o preço não serve, diga quanto queria pagar e passamos isso aos parceiros. ` +
      `Se já resolveu de outra forma, diga-nos e fechamos o pedido.`
    );
  }
  if (l.quantas === 1) {
    return (
      `Olá! O seu pedido #${l.pedidoId} já tem uma proposta de um parceiro${l.verificados ? " verificado" : ""}: ` +
      `${l.valorDoCliente}${l.unidade}. Quer que a reservemos? ` +
      `Responda SIM, ou veja-a ${NO_LINK_QUE_TEM}. ` +
      `Se o dia ou o valor não lhe servirem, diga-nos e falamos com o parceiro.`
    );
  }
  return (
    `Olá! O seu pedido #${l.pedidoId} já tem ${l.quantas} propostas de parceiros${l.verificados ? " verificados" : ""}, ` +
    `desde ${l.valorDoCliente}${l.unidade}. Quer que reservemos a mais em conta? ` +
    `Responda SIM, ou escolha ${NO_LINK_QUE_TEM}. ` +
    `Se nenhuma servir, diga-nos o que precisa e falamos com os parceiros.`
  );
}

/** A lista do Início, pelo n.º do pedido, do maior para o menor. */
export function lembretesDasPropostas(pedidos: readonly PedidoParaOLembrete[], agora: Date): Lembrete[] {
  const saida: Lembrete[] = [];
  for (const p of pedidos) {
    const l = lembreteDasPropostas(p, agora);
    if (l) saida.push(l);
  }
  return saida.sort((a, b) => b.pedidoId - a.pedidoId);
}
