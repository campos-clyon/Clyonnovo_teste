/**
 * O CLIENTE CANCELA PELA CONVERSA — d93, ponto 2 (CEO e dono, 23-11-2026).
 *
 * «Quero cancelar o pedido», «já não preciso, cancelem» — frase clara: cancela
 * logo, pela função de cancelar de sempre. «Cancelar a data», «se calhar já
 * não» — frase ambígua: pergunta «Confirma que quer cancelar o pedido #N?
 * Responda CANCELAR.», e só o CANCELAR cancela.
 *
 * Ao cancelar por aqui, os dados saem NA HORA (não daqui a 7 dias): o pedido é
 * anonimizado (`anonimizarPedido`, o da retenção), a conversa apaga-se, e o
 * número fica marcado para NÃO voltar a ser contactado por nenhuma rotina
 * (`nao-contactar.ts`). A mensagem ao cliente diz isso mesmo.
 *
 * Ficam com a equipa (a lei obriga a guardar, ou há um acordo de pé): o
 * trabalho contratado ou com data marcada, o pago, o que tem uma referência
 * de pagamento viva, o faturado.
 *
 * PURO. A base está em `cancelar-pelo-cliente-na-base.ts`.
 */

import { semAcentos } from "./leitor-da-recolha";
import { SE_FOR_O_VALOR_OU_A_DATA, textoDaConfirmacaoDoCancelamento } from "./validade-do-orcamento";
import { listaDePedidos } from "./porque-cancelou";

export type PedidoDeCancelamento = "claro" | "ambiguo";

const limpar = (texto: string) =>
  semAcentos(texto)
    .replace(/[’']/g, "'")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/[#°º]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** O que se cancela: o pedido, o serviço, a recolha… (e não a data, nem a hora). */
const O_PEDIDO = "(o |a |o meu |a minha |este |esta |esse |essa )?(pedido|servico|recolha|mudanca|esvaziamento|trabalho|orcamento|reparacao|marcacao)";

const CLAROS: readonly RegExp[] = [
  new RegExp(`\\b(quero|queria|gostaria de|pode|podem|podiam|por favor|pf|favor) (de )?cancelar ${O_PEDIDO}\\b`),
  new RegExp(`\\b(cancelem|cancele|cancela|cancelar) ${O_PEDIDO}\\b`),
  /\b(ja nao preciso|nao preciso mais|ja nao e preciso|ja nao quero)\b.*\b(cancelem|cancele|cancelar|pode cancelar|podem cancelar)\b/,
  /\b(cancelem|cancele|pode cancelar|podem cancelar)\b.*\b(ja nao preciso|nao preciso mais|ja nao quero)\b/,
  /\b(ja nao preciso|nao preciso mais|ja nao quero|desisto) (d[oa] |de )(meu |minha |este |esta )?(pedido|servico|recolha|mudanca|esvaziamento|trabalho|orcamento|reparacao)\b/,
  /\b(please cancel|i want to cancel|i'?d like to cancel|cancel) (my|the|this) (request|order|booking|job)\b/,
  /\b(je veux|je voudrais|merci d'?|veuillez) annuler (ma|la|cette) (demande|commande|reservation)\b|\bannulez (ma|la) (demande|commande)\b/,
  /\b(quiero|quisiera|por favor) cancelar (mi|el|este) (pedido|servicio|encargo)\b|\bcancelen (mi|el) pedido\b/,
];

const AMBIGUOS: readonly RegExp[] = [
  /\bcancel(ar|em|e|a|o)\b/,
  /\b(se calhar|talvez|acho que|se calhar ja|possivelmente) (ja )?nao\b/,
  /\b(ja nao preciso|nao preciso mais|ja nao e preciso|ja nao quero|desisto)\b/,
  /\b(no longer need|don'?t need it anymore|cancel)\b/,
  /\b(annuler|plus besoin)\b/,
  /\b(ya no (lo )?necesito)\b/,
];

/**
 * O CLIENTE QUER CANCELAR? Pura. «claro» (cancela logo), «ambiguo» (pergunta
 * o CANCELAR), ou null. Uma pergunta («posso cancelar?») é ambígua: não se
 * cancela por uma pergunta. O CANCELAR sozinho é a resposta à pergunta —
 * quem chama vê primeiro se a pergunta foi feita.
 */
export function querCancelar(texto: string | null | undefined): PedidoDeCancelamento | null {
  const cru = String(texto ?? "").trim();
  if (!cru || cru.length > 300) return null;
  const t = limpar(cru);
  const ePergunta = /\?/.test(cru);
  if (!ePergunta && CLAROS.some((re) => re.test(t))) return "claro";
  if (AMBIGUOS.some((re) => re.test(t))) return "ambiguo";
  return null;
}

/** O número do pedido que ele escreveu («cancelar o pedido #812»), ou null. */
export function pedidoNaFrase(texto: string | null | undefined): number | null {
  const m = /#\s?(\d{2,7})\b|\bpedido (?:n\.?º?\s?|numero\s)?(\d{2,7})\b/i.exec(String(texto ?? ""));
  const n = Number(m?.[1] ?? m?.[2]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * TODOS OS PEDIDOS QUE ELE ESCREVEU — d126 (25-11-2026). «Cancelar pedido 685
 * e pedido 684», «cancelem os pedidos #684 e #685»: os dois. Pura; sem
 * repetidos, pela ordem em que aparecem. Um código postal («1675-155») não é
 * um pedido: só conta o número a seguir a «#» ou a «pedido(s)».
 */
export function pedidosNaFrase(texto: string | null | undefined): number[] {
  const t = String(texto ?? "");
  const ids: number[] = [];
  const juntar = (n: number) => {
    if (Number.isInteger(n) && n > 0 && !ids.includes(n)) ids.push(n);
  };
  const re =
    /(?:#\s?|\bpedidos?\s(?:n\.?\s?º?\s?|n[uú]mero\s)?)(\d{2,7})\b((?:\s*(?:,|\be\b|\band\b|\bet\b|\by\b|&)\s*(?:(?:o |do |no )?pedido\s)?#?\s?\d{2,7}\b)*)/gi;
  for (const m of t.matchAll(re)) {
    juntar(Number(m[1]));
    for (const n of (m[2] ?? "").matchAll(/\d{2,7}/g)) juntar(Number(n[0]));
  }
  return ids;
}

/** A pergunta (a de sempre, d2/d91); com vários pedidos, no plural (d126). */
export function perguntaDoCancelamento(pedidos: number | readonly number[]): string {
  const ids = typeof pedidos === "number" ? [pedidos] : [...pedidos];
  if (ids.length === 1) return textoDaConfirmacaoDoCancelamento(ids[0]);
  return `Confirma que quer cancelar os pedidos ${listaDePedidos(ids)}? Responda CANCELAR. ${SE_FOR_O_VALOR_OU_A_DATA}`;
}

/**
 * OS PEDIDOS DA PERGUNTA DO CANCELAR QUE LHE SAIU POR ÚLTIMO — d126. A
 * pergunta de um pedido («Confirma que quer cancelar o pedido #684?») ou de
 * vários («…os pedidos #684 e #685?»), há menos de 48 h, seja qual for o
 * caminho que a fez (a conversa, d93, ou um lembrete): o CANCELAR responde-lhe
 * a ela. Só os que ainda estão em `abertos`. Pura.
 */
export function pedidosDaPerguntaDoCancelar(
  ultimaSaida: { texto: string; haSegundos: number | null } | null | undefined,
  abertos: readonly number[],
): number[] {
  if (!ultimaSaida || ultimaSaida.haSegundos == null || ultimaSaida.haSegundos > HORAS_PARA_O_CANCELAR * 3600) return [];
  const t = ultimaSaida.texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const m = /confirma que quer cancelar (?:o pedido|os pedidos) ([^?]*)\?\s*responda cancelar/.exec(t);
  if (!m) return [];
  const ids = [...m[1].matchAll(/#(\d{2,7})(?!\d)/g)].map((x) => Number(x[1]));
  return ids.filter((id, i) => abertos.includes(id) && ids.indexOf(id) === i);
}

/**
 * QUANDO NÃO SE CANCELA AQUI, DIZ-SE PORQUÊ — d126. O porquê das regras
 * (`porqueFicaComAEquipa`) em palavras para o cliente; o que não for do
 * dinheiro nem do acordo fica com a frase de sempre.
 */
export function passoOCancelamentoAEquipa(pedidoId: number, porque: string): string {
  const razao: Array<[RegExp, string]> = [
    [/faturado/, "já tem uma fatura emitida"],
    [/pagamento por pagar|referencia|referência/, "tem uma referência de pagamento por pagar"],
    [/pagamento/, "já tem um pagamento"],
    [/contratado/, "já tem um trabalho combinado com um parceiro"],
    [/data marcada/, "já tem uma data marcada"],
  ];
  const r = razao.find(([re]) => re.test(porque))?.[1];
  if (!r) return PASSO_O_CANCELAMENTO_A_EQUIPA;
  return `Percebi que quer cancelar o pedido #${pedidoId}. Como ele ${r}, não o consigo cancelar daqui: passo já a uma pessoa da equipa, que trata disso consigo por aqui.`;
}

/** A mensagem ao cliente, depois de cancelar (d93, letra a letra) — fora da conversa (o link, a conta, a app). Pela conversa, a da d126 (`porque-cancelou.ts`). */
export function mensagemDoCancelamentoPeloCliente(pedidoId: number): string {
  return `O seu pedido #${pedidoId} foi cancelado. Não voltaremos a contactá-lo e os seus dados foram apagados.`;
}

/** Quando o pedido não se pode cancelar por aqui — o que se diz, e o motivo para a equipa. */
export const PASSO_O_CANCELAMENTO_A_EQUIPA =
  "Percebi que quer cancelar. Como este pedido já tem um trabalho combinado (ou um pagamento), passo já a uma pessoa da equipa, que trata disso consigo por aqui.";

/* ── Porque fica com a equipa ────────────────────────────────────────────── */

export type OPedidoParaCancelar = {
  existe: boolean;
  status: string | null;
  anonimizado: boolean;
  /** Uma negociação acordada, ou um trabalho confirmado, entregue ou pago ao profissional. */
  contratado: boolean;
  /** Uma data marcada no pedido. */
  dataMarcada: boolean;
  /** Um pagamento recebido (e não devolvido). */
  pago: boolean;
  /** Uma referência de pagamento por pagar e ainda válida. */
  referenciaViva: boolean;
  /** Uma fatura emitida. */
  faturado: boolean;
};

/**
 * PORQUE NÃO SE CANCELA AQUI — ou null (pode cancelar-se e anonimizar-se já).
 * Pura. Um fechado não se cancela (d27); um contratado, pago, com referência
 * viva ou faturado vai à equipa (a lei obriga a guardar o que se faturou ou
 * pagou, e há um parceiro com um acordo de pé).
 */
export function porqueFicaComAEquipa(p: OPedidoParaCancelar): string | null {
  if (!p.existe) return "o pedido já não existe";
  if (p.anonimizado) return "o pedido já foi anonimizado";
  const s = String(p.status ?? "");
  if (["cancelado", "arquivado", "rejeitado", "concluido"].includes(s)) return `o pedido já está ${s === "concluido" ? "concluído" : s}`;
  if (p.faturado) return "o pedido já foi faturado";
  if (p.pago) return "o pedido já tem um pagamento";
  if (p.referenciaViva) return "o pedido tem uma referência de pagamento por pagar";
  if (p.contratado) return "o trabalho já está contratado";
  if (p.dataMarcada) return "o pedido tem data marcada";
  return null;
}

/** Quanto tempo vale a pergunta do CANCELAR (as mesmas 48 h da d2). */
export const HORAS_PARA_O_CANCELAR = 48;

/**
 * A ÚLTIMA MENSAGEM QUE LHE SAIU É A PERGUNTA DO CANCELAR DESTE PEDIDO, há
 * menos de 48 h? Pura. É a única porta do CANCELAR por este caminho.
 */
export function aPerguntaDoCancelarVale(
  ultimaSaida: { texto: string; haSegundos: number | null } | null | undefined,
  pedidoId: number,
): boolean {
  if (!ultimaSaida || ultimaSaida.haSegundos == null || ultimaSaida.haSegundos > HORAS_PARA_O_CANCELAR * 3600) return false;
  const t = ultimaSaida.texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return new RegExp(`#${pedidoId}(?!\\d)`).test(t) && t.includes("confirma que quer cancelar o pedido") && t.includes("responda cancelar");
}
