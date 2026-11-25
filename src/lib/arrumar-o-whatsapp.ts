import { PRAZO_PARA_DESCARTAR_S } from "./fila-do-cliente";
import { ESTADOS_DE_PEDIDO_FECHADO } from "./pedido-arrumado";
import { NEGOCIACOES_CONTRATADAS, PEDIDOS_CONTRATADOS } from "./pedidos-contratados";

/**
 * A SECÇÃO WHATSAPP ARRUMADA — d124 (25-11-2026).
 *
 * *«Hoje está uma confusão.»* — o dono, com conversas de 11 a 36 dias de
 * pedidos já concluídos no «Por responder», mensagens velhas inteiras na fila
 * e o telefone de cada cliente à vista. As regras desta arrumação vivem aqui,
 * puras, para se poderem provar sem base:
 *
 *   · a conversa de um pedido fechado (concluído, arquivado, cancelado ou
 *     recusado) em que o cliente não escreve há mais de 3 dias sai da vista —
 *     passa a «Resolvidas», como o «Fechar» faz, e volta sozinha se ele
 *     escrever (`mesa-das-conversas.ts`, `semNovidadeDeUmPedidoFechado`);
 *   · uma mensagem atrasada na fila descarta-se sozinha (não sai) quando o
 *     pedido já tem parceiro contratado, quando está fechado, ou quando passou
 *     das 48 h — e fica escrito quem e porquê (`porqueDescartarSozinha`);
 *   · o telefone não se mostra: a linha diz quem é, ou o pedido
 *     (`quemNaLinha`), e o número só aparece a pedido.
 *
 * Nada se apaga: as conversas continuam na base e nas «Resolvidas», e as
 * mensagens descartadas continuam na fila, riscadas, com o porquê.
 */

/** Três dias sem o cliente escrever, com o pedido fechado, e a conversa sai da vista. */
export const SAI_DA_VISTA_S = 3 * 86400;

/** Quem descartou sozinho — o sistema, e não uma pessoa. */
export const DESCARTADA_SOZINHA = "sozinha";

export const PORQUE_DESCARTADA = {
  fechado: "descartada sozinha: pedido já fechado",
  contratado: "descartada sozinha: o pedido já tem parceiro contratado",
  velha: "descartada sozinha: mais de 48 h na fila (as propostas seguem as regras novas)",
  equipa: "descartada pela equipa",
  limpeza: "fila limpa pela equipa",
} as const;

const FECHADOS: readonly string[] = ESTADOS_DE_PEDIDO_FECHADO;

export function pedidoEstaFechado(status: string | null | undefined): boolean {
  return FECHADOS.includes(String(status ?? ""));
}

/** O pedido tem parceiro contratado — pelo estado do pedido ou por uma negociação acordada. */
export function temParceiroContratado(p: { status: string | null; negociacaoContratada?: boolean } | null): boolean {
  if (!p) return false;
  return (PEDIDOS_CONTRATADOS as readonly string[]).includes(String(p.status ?? "")) || p.negociacaoContratada === true;
}

/** Os estados das negociações contratadas, para um `IN (…)` de SQL. */
export const NEGOCIACOES_CONTRATADAS_SQL = `(${NEGOCIACOES_CONTRATADAS.map((s) => `'${s}'`).join(", ")})`;

export type PedidoDoNumero = { id: number; status: string | null; negociacaoContratada?: boolean };

/**
 * O pedido vivo e o último de um número, a partir das linhas da base do mais
 * novo para o mais velho — a mesma regra de `pedidosPorTelefoneWhatsApp`.
 */
export function vivoEUltimo(
  pedidos: ReadonlyArray<PedidoDoNumero>,
): { vivo: PedidoDoNumero | null; ultimo: PedidoDoNumero | null } {
  const ordenados = [...pedidos].sort((a, b) => b.id - a.id);
  return {
    ultimo: ordenados[0] ?? null,
    vivo: ordenados.find((p) => !pedidoEstaFechado(p.status)) ?? null,
  };
}

/**
 * Uma mensagem ATRASADA na fila (já não sai sozinha) descarta-se sozinha?
 * Devolve o porquê, ou `null` para a deixar à equipa.
 *
 *   · o pedido vivo já tem parceiro contratado — o que ela dizia já passou;
 *   · não há pedido vivo e o último está fechado;
 *   · passou das 48 h — as propostas já seguem as regras novas.
 *
 * Só para as atrasadas: o que está dentro do prazo sai como sempre.
 */
export function porqueDescartarSozinha(l: {
  atrasada: boolean;
  idadeS: number;
  vivo: PedidoDoNumero | null;
  ultimo: PedidoDoNumero | null;
}): string | null {
  if (!l.atrasada) return null;
  if (l.vivo && temParceiroContratado(l.vivo)) return PORQUE_DESCARTADA.contratado;
  if (!l.vivo && l.ultimo && pedidoEstaFechado(l.ultimo.status)) return PORQUE_DESCARTADA.fechado;
  if (l.idadeS > PRAZO_PARA_DESCARTAR_S) return PORQUE_DESCARTADA.velha;
  return null;
}

/** Os últimos 3 dígitos — para distinguir dois contactos sem nome, sem mostrar o número. */
export function finalDoNumero(telefone: string): string {
  const d = telefone.replace(/\D/g, "");
  return d.length >= 3 ? `…${d.slice(-3)}` : "";
}

/**
 * QUEM É, SEM O NÚMERO — o nome do profissional ou do contacto, ou o pedido.
 * O telefone inteiro nunca entra aqui; só aparece no «ver número».
 */
export function quemNaLinha(l: {
  telefone: string;
  nome?: string | null;
  profissional?: { nome: string } | null;
  pedido?: { id: number } | null;
}): string {
  const nome = (l.profissional?.nome || l.nome || "").replace(/\s+/g, " ").trim();
  // Um «nome» que é só algarismos é o número outra vez.
  if (nome && !/^[\d\s+().-]+$/.test(nome)) return nome.length > 40 ? `${nome.slice(0, 39)}…` : nome;
  if (l.pedido) return `Pedido #${l.pedido.id}`;
  const fim = finalDoNumero(l.telefone);
  return fim ? `Sem nome (${fim})` : "Sem nome";
}

/** A primeira linha de um texto longo — a fila recolhida, uma linha por mensagem. */
export function inicioDoTexto(texto: string, max = 90): string {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** De quem é a vez — «quem tem a bola» numa palavra. */
export function deQuemEAVez(l: { estado: string; dono: "assistente" | "equipa" }): { texto: string; nossa: boolean } {
  switch (l.estado) {
    case "por_responder":
      return { texto: l.dono === "equipa" ? "Vez da equipa" : "Vez nossa", nossa: true };
    case "a_meio":
    case "a_espera":
      return { texto: "Vez do cliente", nossa: false };
    case "com_pedido":
      return { texto: "No pedido", nossa: false };
    case "resolvida":
      return { texto: "Resolvida", nossa: false };
    default:
      return { texto: "Bloqueada", nossa: false };
  }
}

/** A conversa pede uma pessoa: está por responder e a Vitória não lhe responde (entregue, ou deixou-a anotada). */
export function pedeUmaPessoa(l: { estado: string; dono: "assistente" | "equipa"; porque: string }): boolean {
  return l.estado === "por_responder" && (l.dono === "equipa" || /anotada para uma pessoa/i.test(l.porque));
}

/**
 * O QUE SE LÊ NO TOPO — quantas por responder, a mais antiga à espera (das
 * dos últimos 3 dias: as mais velhas têm a linha delas) e as que pedem uma
 * pessoa.
 */
export function resumoDoTopo(
  linhas: ReadonlyArray<{ estado: string; dono: "assistente" | "equipa"; porque: string; haSegundos: number | null }>,
): { porResponder: number; maisAntigaHaSegundos: number | null; pedemUmaPessoa: number } {
  const por = linhas.filter((l) => l.estado === "por_responder");
  const recentes = por
    .map((l) => l.haSegundos)
    .filter((s): s is number => s != null && Number.isFinite(s) && s <= SAI_DA_VISTA_S);
  return {
    porResponder: por.length,
    maisAntigaHaSegundos: recentes.length > 0 ? Math.max(...recentes) : null,
    pedemUmaPessoa: por.filter(pedeUmaPessoa).length,
  };
}

/**
 * OS SEPARADORES À VISTA E OS DO «MAIS» — d124. Os quatro de todos os dias à
 * vista; os outros (A meio, Com pedido — que se trata na Mesa dos pedidos —,
 * Guardadas e Bloqueadas) num «Mais».
 */
export const SEPARADORES_A_VISTA = ["por_responder", "a_espera", "profissionais", "resolvida"] as const;
export const SEPARADORES_NO_MAIS = ["a_meio", "com_pedido", "guardada", "bloqueada"] as const;
