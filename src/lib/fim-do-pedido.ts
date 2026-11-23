/**
 * O FIM DE UM PEDIDO CHEGA A TODOS OS PROFISSIONAIS — d94 (dono, 23-11-2026).
 *
 * *«O estado de um pedido tem de chegar a TODAS as contas dos profissionais,
 * sem excepção.»* Cancelado, arquivado ou apagado: o pedido sai de onde
 * estiver na conta de cada profissional que o tinha (feed, negociação,
 * contratado), vai para «Cancelados» ou «Arquivados» (o apagado desaparece) e
 * cada um recebe UMA notificação com o motivo.
 *
 * Este ficheiro é puro (sem base, sem `process.env`): as regras e as frases. O
 * painel e a app Pro importam-no os dois — o separador, a frase da
 * notificação e o aviso do sino são os mesmos nos dois lados. A parte que
 * escreve na base é `fim-do-pedido-na-base.ts` (`fimDoPedido`), e é por ela
 * que passam todos os caminhos que cancelam, arquivam ou apagam.
 */

import { rotuloDoMotivo } from "./motivo-do-fecho";

export type FimDoPedido = "cancelado" | "arquivado" | "apagado";

/** O fim que um estado de pedido quer dizer — `null` se o pedido está vivo (ou concluído). */
export function fimDoEstado(status: string | null | undefined): Exclude<FimDoPedido, "apagado"> | null {
  const s = String(status ?? "");
  if (s === "cancelado") return "cancelado";
  if (s === "arquivado" || s === "rejeitado") return "arquivado";
  return null;
}

type Marcos = {
  estado: unknown;
  execucaoEnviadaEm?: unknown;
  confirmadoEm?: unknown;
  pagoEm?: unknown;
};

/** Ele já fez o trabalho (deu-o por feito, foi confirmado ou pago). */
function trabalhoFeito(n: Marcos): boolean {
  return n.execucaoEnviadaEm != null || n.confirmadoEm != null || n.pagoEm != null;
}

/**
 * EM QUE SEPARADOR DA CONTA DELE FICA O TRABALHO, PELO ESTADO DO PEDIDO.
 *
 *   · cancelado → «Cancelados», sempre — até um contratado, até um dado por
 *     concluído por engano: o pedido não vai acontecer (ou não aconteceu);
 *   · arquivado (ou rejeitado) → «Arquivados», a não ser que ele já tenha
 *     feito o trabalho: arquivar um pedido concluído para arrumar a Mesa não
 *     lhe tira o trabalho dos Terminados (d27: «o que já está feito fica»);
 *   · vivo ou concluído → `null`: decide o estado da negociação, como sempre.
 *
 * A carteira não lê isto: o dinheiro conta pelas regras dela.
 */
export function fimParaOProfissional(statusDoPedido: string | null | undefined, n: Marcos): Exclude<FimDoPedido, "apagado"> | null {
  const fim = fimDoEstado(statusDoPedido);
  if (fim === "cancelado") return "cancelado";
  if (fim === "arquivado") return trabalhoFeito(n) ? null : "arquivado";
  return null;
}

/** Os estados de uma negociação em que o profissional ainda tinha o pedido «na mão». */
const COM_O_PEDIDO = new Set(["aberta", "aguarda_contratacao", "acordada"]);

/** Ele já pôs um número nesta negociação. */
function propostaDele(propostasJson: unknown): boolean {
  if (typeof propostasJson !== "string" || !propostasJson.trim()) return false;
  try {
    const l = JSON.parse(propostasJson);
    return Array.isArray(l) && l.some((x: { por?: unknown }) => x?.por === "profissional");
  } catch {
    return false;
  }
}

/**
 * No arquivo, quem estava mesmo no pedido: propôs, aceitou o valor ou foi
 * contratado — e ainda não tinha feito o trabalho. Quem só o tinha no feed
 * vê-o passar para «Arquivados», sem notificação (as rotinas da validade e do
 * seguimento já avisavam assim, d62/d83).
 */
function noPedidoPorFazer(n: NegociacaoDoFim): boolean {
  const e = String(n.estado ?? "");
  if (e === "aguarda_contratacao") return true;
  if (e === "aberta") return propostaDele(n.propostasJson);
  return e === "acordada" && !trabalhoFeito(n);
}

export type NegociacaoDoFim = Marcos & { id: unknown; providerId: unknown; propostasJson?: unknown };
export type QuemSabeDoFim = { negociacaoId: number; providerId: number };

/**
 * A QUEM CHEGA A NOTIFICAÇÃO — lido ANTES de fechar (depois estão todas «morta»).
 *
 *   · cancelado e apagado: quem o via no feed, quem negociava e quem estava
 *     contratado (aberta, à espera da contratação, acordada);
 *   · arquivado: só quem estava mesmo no pedido e o arquivo lho tira (propôs,
 *     aceitou ou foi contratado, sem o trabalho feito). Quem já fez o trabalho
 *     não é avisado de que a Mesa foi arrumada.
 *
 * Um profissional que já tinha perdido o pedido (morta, desistida) não volta a
 * ser incomodado. Um por profissional, mesmo com duas negociações.
 */
export function quemSabeDoFim(fim: FimDoPedido, negociacoes: readonly NegociacaoDoFim[]): QuemSabeDoFim[] {
  const vistos = new Set<number>();
  const out: QuemSabeDoFim[] = [];
  for (const n of negociacoes ?? []) {
    const entra = fim === "arquivado" ? noPedidoPorFazer(n) : COM_O_PEDIDO.has(String(n.estado ?? ""));
    if (!entra) continue;
    const providerId = Number(n.providerId);
    const negociacaoId = Number(n.id);
    if (!Number.isInteger(providerId) || providerId <= 0 || !Number.isInteger(negociacaoId)) continue;
    if (vistos.has(providerId)) continue;
    vistos.add(providerId);
    out.push({ negociacaoId, providerId });
  }
  return out;
}

/** O motivo como vai no texto: uma linha, sem espaços a mais, até 160 caracteres. */
export function motivoLimpo(motivo: string | null | undefined): string | null {
  const m = String(motivo ?? "").replace(/\s+/g, " ").trim();
  if (!m) return null;
  return m.length > 160 ? `${m.slice(0, 157).trimEnd()}…` : m;
}

/**
 * O MOTIVO QUE VAI AO PROFISSIONAL: o que a equipa escreveu, ou — sem texto —
 * a escolha da lista do fecho (d54) em minúsculas («já não precisa», «preço»).
 * «Outro» não diz nada a ninguém, e fica de fora.
 */
export function motivoAoProfissional(textoLivre: unknown, chaveDoMotivo?: string | null): string | null {
  const livre = typeof textoLivre === "string" ? motivoLimpo(textoLivre) : null;
  if (livre) return livre;
  if (!chaveDoMotivo || chaveDoMotivo === "outro") return null;
  const rotulo = rotuloDoMotivo(chaveDoMotivo);
  return rotulo ? rotulo.charAt(0).toLowerCase() + rotulo.slice(1) : null;
}

/**
 * A FRASE DA NOTIFICAÇÃO — a mesma no telemóvel, no sino da app e no do painel.
 *
 *   «Pedido #630 cancelado — a cliente desistiu»
 *   «Pedido #630 arquivado» / «Pedido #630 arquivado — o cliente não respondeu ao orçamento»
 *   «Pedido #630 apagado — repetido»
 */
export function textoDoFim(fim: FimDoPedido, pedidoId: number, motivo?: string | null): string {
  const m = motivoLimpo(motivo);
  return `Pedido #${pedidoId} ${fim}${m ? ` — ${m}` : ""}`;
}

/** O título e o corpo do aviso no telemóvel. O título é curto (ecrã de bloqueio). */
export function avisoDoFimNoTelemovel(fim: FimDoPedido, pedidoId: number, motivo?: string | null): { title: string; body: string } {
  const m = motivoLimpo(motivo);
  const corpo =
    fim === "apagado"
      ? "O pedido saiu da plataforma e da sua lista."
      : fim === "cancelado"
        ? "O pedido não vai acontecer. Está nos seus «Cancelados»."
        : "O pedido foi arquivado. Está nos seus «Arquivados».";
  const motivoComPonto = m ? (/[.!?…]$/.test(m) ? m : `${m}.`) : null;
  return { title: `Pedido #${pedidoId} ${fim}`, body: motivoComPonto ? `Motivo: ${motivoComPonto} ${corpo}` : corpo };
}

/** O que a rota `meus-pedidos` manda de cada notificação do fim de um pedido. */
export type AvisoDoFimNoServidor = {
  id: number;
  pedidoId: number;
  /** A negociação dele nesse pedido; `null` num apagado (já não há para onde abrir). */
  negociacaoId: number | null;
  fim: FimDoPedido;
  texto: string;
  /** ISO. */
  em: string;
};

/**
 * O AVISO DO SINO (`avisos-do-profissional.ts`) feito de uma notificação do
 * servidor. O id é o da linha (`fim-<id>`): o mesmo acontecimento é sempre o
 * mesmo aviso, e um pedido restaurado e cancelado outra vez é outro. Um
 * apagado leva `negociacaoId: 0` — não abre nada.
 */
export function avisosDoSinoDoFim(lista: readonly AvisoDoFimNoServidor[] | null | undefined): Array<{
  id: string;
  texto: string;
  negociacaoId: number;
  em: string;
  lido: boolean;
}> {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((a) => a && Number.isInteger(Number(a.id)) && typeof a.texto === "string")
    .map((a) => ({
      id: `fim-${Number(a.id)}`,
      texto: a.texto,
      negociacaoId: a.fim === "apagado" ? 0 : Number(a.negociacaoId ?? 0) || 0,
      em: typeof a.em === "string" ? a.em : new Date(0).toISOString(),
      lido: false,
    }));
}

/**
 * O DINHEIRO QUE PRENDE UM PEDIDO — não se apaga o que tem dinheiro (d94).
 *
 * Apagar leva a linha do pedido e as negociações, e com elas o que a carteira,
 * os Pagamentos, as faturas e as comissões lêem. Um pedido com qualquer destes
 * fica: cancela-se ou arquiva-se.
 */
export type DinheiroDoPedido = {
  /** A CLYON já pagou ao profissional (negociação com `pagoEm`). */
  pagoAoProfissional: boolean;
  /** O trabalho foi confirmado — o valor conta na carteira. */
  confirmado: boolean;
  /** O cliente pagou à CLYON (marcado na negociação). */
  clientePagou: boolean;
  /** Referências Multibanco / MB WAY pagas ou ainda por pagar. */
  pagamentos: number;
  faturas: number;
  /** Partes da taxa e do IVA cobradas ao profissional (as dívidas). */
  dividas: number;
  movimentosDaCarteira: number;
  comprovativos: number;
  /** O pedido entra numa comissão de assistente já paga. */
  comissoes: number;
};

export const SEM_DINHEIRO: DinheiroDoPedido = {
  pagoAoProfissional: false,
  confirmado: false,
  clientePagou: false,
  pagamentos: 0,
  faturas: 0,
  dividas: 0,
  movimentosDaCarteira: 0,
  comprovativos: 0,
  comissoes: 0,
};

/** O que prende o pedido, em palavras; lista vazia = pode apagar-se. */
export function oQuePrendeOPedido(d: DinheiroDoPedido): string[] {
  const r: string[] = [];
  if (d.pagoAoProfissional) r.push("a CLYON já pagou o trabalho");
  if (d.confirmado) r.push("tem um trabalho confirmado");
  if (d.clientePagou) r.push("o cliente já pagou");
  if (d.pagamentos > 0) r.push("tem referências de pagamento");
  if (d.faturas > 0) r.push("tem faturas");
  if (d.dividas > 0) r.push("tem a taxa da plataforma ou o IVA já recebidos");
  if (d.movimentosDaCarteira > 0) r.push("tem movimentos na carteira");
  if (d.comprovativos > 0) r.push("tem comprovativos de pagamento");
  if (d.comissoes > 0) r.push("entra num pagamento já feito a um assistente");
  return r;
}

/** A frase do botão «Apagar» quando recusa. */
export function porQueNaoSeApaga(pedidoId: number, razoes: readonly string[]): string {
  return (
    `O pedido #${pedidoId} não se apaga: ${razoes.join(", ")}. ` +
    "Um pedido com dinheiro fica para as contas — cancele-o ou arquive-o."
  );
}
