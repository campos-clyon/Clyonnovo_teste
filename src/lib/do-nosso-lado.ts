import { naAgenda } from "./agenda-dos-trabalhos";
import { instanteDaBase } from "./hora-de-lisboa";
import { ESPERA_RECENTE_S, haQuanto } from "./mesa-das-conversas";
import { estaExpirada, type Proposta as PropostaDoMotor } from "./negociacao";
import { quemNegoceia } from "./quem-negoceia";

/**
 * «DO NOSSO LADO» — o que está à espera da CLYON, no topo da Mesa. d14,
 * 03-11-2026 (aprovada pelo dono a 04-11).
 *
 * Perde-se mais na espera do que no preço: conversas em que o cliente esperava
 * por nós há dias, Trabalhos CLYON com parceiros a aceitar e o preço por
 * enviar, trabalhos feitos que ninguém fechou. Cada coisa estava no seu ecrã — a mesa das
 * conversas, a Mesa, a Agenda — e nenhum dizia, junto, o que esperava por
 * nós. Este cartão diz, por quatro perguntas:
 *
 *   1. conversas em que o cliente falou por último há mais de 2 h;
 *   2. Trabalhos CLYON aceites por um parceiro e sem o preço enviado ao cliente;
 *   3. propostas de parceiros por enviar ao cliente (os pedidos que a CLYON negoceia);
 *   4. trabalhos com a data passada e sem «Está feito».
 *
 * SÓ LEITURA, E SEM DADOS NOVOS: lê o que a Mesa e a mesa do WhatsApp já
 * carregam, pelas mesmas regras — o «Por responder» da mesa das conversas, a
 * fase «escolher» dos Trabalhos CLYON, a divisão «Precisa de si» / «A
 * aguardar cliente» da Mesa (`orcamentoEnviadoCobre`), e o «atrasado» da
 * Agenda (`naAgenda`). PURO: o painel dá os dados e o relógio.
 */

/** Mais de 2 h sem resposta a um cliente é já «do nosso lado». */
export const DUAS_HORAS_S = 2 * 3600;

export type TipoDoNossoLado = "conversa" | "preco_clyon" | "propostas" | "data_passada" | "sem_resposta";

export type LinhaDoNossoLado = {
  tipo: TipoDoNossoLado;
  /** O n.º do pedido — nulo numa conversa sem pedido. */
  pedidoId: number | null;
  /** O telefone, só numa conversa sem pedido: é por ele que se abre. */
  telefone: string | null;
  /** Há quantos segundos está à espera. */
  esperaS: number;
  /** O que espera, em poucas palavras. */
  oQue: string;
};

export type GrupoDoNossoLado = {
  tipo: TipoDoNossoLado;
  titulo: string;
  linhas: LinhaDoNossoLado[];
};

export const TITULOS_DO_NOSSO_LADO: Record<TipoDoNossoLado, string> = {
  conversa: "Conversas à espera de resposta há mais de 2 h",
  preco_clyon: "Trabalhos CLYON aceites, com o preço por enviar ao cliente",
  propostas: "Propostas de parceiros por enviar ao cliente",
  data_passada: "Trabalhos com a data passada e sem «Está feito»",
  sem_resposta: "Mudanças: o parceiro escolhido não respondeu no prazo",
};

/* ── As formas que se lêem — o mínimo de cada fonte ─────────────────────── */

export type ConversaParaOLado = {
  telefone: string;
  estado: string;
  haSegundos: number | null;
  pedido: { id: number; fechado: boolean } | null;
};

type PropostaLida = { por?: unknown; estado?: unknown; criadaEm?: unknown };

export type NegociacaoParaOLado = {
  estado: string;
  propostasJson: string | null;
  execucaoEnviadaEm?: string | null;
  confirmadoEm?: string | null;
  dataCombinada?: string | null;
  actualizadaEm?: string | null;
  /** Escolhido pelo cliente na lista das mudanças (1), e até quando devia responder (11-11-2026). */
  escolhidoPeloCliente?: number | string | boolean | null;
  prazoRespostaEm?: string | null;
};

export type PedidoParaOLado = {
  id: number;
  status: string | null;
  origem: string | null;
  contactEmail: string | null;
  propostaEnviadaEm?: string | null;
  dataAgendada?: string | null;
  negociacoes: NegociacaoParaOLado[];
};

export type TrabalhoClyonParaOLado = {
  pedidoId: number;
  estadoDoPedido: string | null;
  dataAgendada: string | null;
  propostaEnviadaEm?: string | null;
  negociacoes: Array<{
    estado: string;
    dataCombinada: string | null;
    execucaoEnviadaEm: string | null;
    confirmadoEm: string | null;
    actualizadaEm?: string | null;
  }>;
  resumo: { fase: string };
};

/* ── Ajudas ─────────────────────────────────────────────────────────────── */

const FECHADO = new Set(["cancelado", "arquivado", "concluido", "rejeitado"]);
const VIVA = (estado: string) => estado !== "morta" && estado !== "desistida";

function segundosDesde(v: unknown, agora: Date): number | null {
  const d = instanteDaBase(v as string | Date | null | undefined);
  if (!d) return null;
  return Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 1000));
}

function propostasDe(json: string | null): PropostaLida[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as PropostaLida[]) : [];
  } catch {
    return [];
  }
}

/** «há 3 h», «há 2 dias» — o mesmo relógio da mesa das conversas. */
export function haQuantoEspera(segundos: number): string {
  return haQuanto(segundos);
}

/* ── 1. As conversas ────────────────────────────────────────────────────── */

/**
 * O «Por responder» da mesa das conversas (o cliente falou por último, e não
 * só para agradecer), há mais de 2 h. As bloqueadas e as resolvidas já lá não
 * estão. Com pedido, a linha leva o número; sem pedido, o telefone.
 */
export function conversasDoNossoLado(linhas: ConversaParaOLado[]): LinhaDoNossoLado[] {
  return linhas
    .filter((l) => l.estado === "por_responder" && l.haSegundos != null && l.haSegundos >= DUAS_HORAS_S)
    .map((l) => ({
      tipo: "conversa" as const,
      pedidoId: l.pedido?.id ?? null,
      telefone: l.pedido ? null : l.telefone,
      esperaS: l.haSegundos as number,
      oQue: l.pedido ? "o cliente escreveu e ninguém respondeu" : "o cliente escreveu e ninguém respondeu (sem pedido)",
    }));
}

/* ── 2. Os Trabalhos CLYON aceites, com o preço por enviar ──────────────── */

/**
 * A fase «escolher» (alguém aceitou) e a proposta ainda não foi ao cliente
 * (`propostaEnviadaEm` nula). Espera desde o primeiro «aceitou».
 */
export function precosClyonDoNossoLado(trabalhos: TrabalhoClyonParaOLado[], agora: Date): LinhaDoNossoLado[] {
  const out: LinhaDoNossoLado[] = [];
  for (const t of trabalhos) {
    if (FECHADO.has(t.estadoDoPedido ?? "")) continue;
    if (t.resumo.fase !== "escolher" || t.propostaEnviadaEm) continue;
    const aceites = t.negociacoes.filter((n) => n.estado === "aguarda_contratacao");
    const esperas = aceites.map((n) => segundosDesde(n.actualizadaEm, agora)).filter((s): s is number => s != null);
    const quantos = aceites.length;
    out.push({
      tipo: "preco_clyon",
      pedidoId: t.pedidoId,
      telefone: null,
      esperaS: esperas.length > 0 ? Math.max(...esperas) : 0,
      oQue: `${quantos} ${quantos === 1 ? "parceiro aceitou" : "parceiros aceitaram"} — o preço ainda não foi ao cliente`,
    });
  }
  return out;
}

/* ── 3. As propostas por enviar ─────────────────────────────────────────── */

/**
 * As propostas que esperam por nós, pela regra da Mesa: um pedido que a CLYON
 * negoceia (`quemNegoceia`), com uma proposta de parceiro pendente — ou um
 * parceiro que aceitou o valor e falta contratar — e o orçamento ainda não
 * enviado depois dela (`orcamentoEnviadoCobre`, no painel). Os feitos por
 * confirmar ficam de fora: são o bloco deles.
 */
export function propostasDoNossoLado(pedidos: PedidoParaOLado[], agora: Date): LinhaDoNossoLado[] {
  const out: LinhaDoNossoLado[] = [];
  for (const p of pedidos) {
    if (FECHADO.has(p.status ?? "")) continue;
    if (p.negociacoes.some((n) => n.confirmadoEm != null)) continue;
    if (quemNegoceia(p) !== "clyon") continue;
    const vivas = p.negociacoes.filter((n) => VIVA(n.estado) && n.estado !== "acordada");
    if (p.negociacoes.some((n) => VIVA(n.estado) && n.execucaoEnviadaEm != null && n.confirmadoEm == null)) continue;
    const enviado = instanteDaBase(p.propostaEnviadaEm ?? null)?.getTime() ?? null;

    /* Os instantes de cada proposta à espera de nós — as de depois do envio. */
    const desde: number[] = [];
    let quantas = 0;
    for (const n of vivas) {
      const propostas = propostasDe(n.propostasJson);
      if (n.estado === "aguarda_contratacao") {
        const aceite = [...propostas].reverse().find((x) => x.estado === "aceite");
        const t = instanteDaBase((aceite?.criadaEm as string) ?? n.actualizadaEm ?? null)?.getTime();
        if (t != null && (enviado == null || t > enviado)) {
          desde.push(t);
          quantas += 1;
        }
        continue;
      }
      for (const x of propostas) {
        if (x.por !== "profissional" || x.estado !== "pendente") continue;
        if (estaExpirada(x as unknown as PropostaDoMotor, agora)) continue;
        const t = instanteDaBase(x.criadaEm as string)?.getTime();
        if (t == null || (enviado != null && t <= enviado)) continue;
        desde.push(t);
        quantas += 1;
      }
    }
    if (quantas === 0) continue;
    out.push({
      tipo: "propostas",
      pedidoId: p.id,
      telefone: null,
      esperaS: Math.max(0, Math.floor((agora.getTime() - Math.min(...desde)) / 1000)),
      oQue: `${quantas} ${quantas === 1 ? "proposta" : "propostas"} de parceiros por enviar ao cliente`,
    });
  }
  return out;
}

/* ── 4. A data passada, sem «Está feito» ────────────────────────────────── */

/**
 * O «atrasado» da Agenda (`naAgenda`): o dia passou — ou, sendo hoje, 3 h
 * depois da hora marcada — e ninguém deu o trabalho por feito. Nas
 * negociações da Mesa e nos Trabalhos CLYON atribuídos. Espera desde a data.
 */
export function datasPassadasDoNossoLado(
  pedidos: PedidoParaOLado[],
  trabalhos: TrabalhoClyonParaOLado[],
  agora: Date,
): LinhaDoNossoLado[] {
  const out: LinhaDoNossoLado[] = [];
  const vistos = new Set<number>();
  const juntar = (
    pedidoId: number,
    estadoDoPedido: string | null,
    n: { dataCombinada?: string | null; execucaoEnviadaEm?: string | null; confirmadoEm?: string | null },
    dataAgendada: string | null | undefined,
  ) => {
    if (vistos.has(pedidoId) || FECHADO.has(estadoDoPedido ?? "")) return;
    const a = naAgenda(
      {
        dataCombinada: instanteDaBase(n.dataCombinada ?? null),
        dataAgendada: instanteDaBase(dataAgendada ?? null),
        execucaoEnviadaEm: n.execucaoEnviadaEm ?? null,
        confirmadoEm: n.confirmadoEm ?? null,
      },
      agora,
    );
    if (a.estado !== "atrasado" || !a.quando) return;
    vistos.add(pedidoId);
    out.push({
      tipo: "data_passada",
      pedidoId,
      telefone: null,
      esperaS: Math.max(0, Math.floor((agora.getTime() - a.quando.getTime()) / 1000)),
      oQue:
        a.diasDeAtraso > 0
          ? `o dia passou há ${a.diasDeAtraso} ${a.diasDeAtraso === 1 ? "dia" : "dias"} e ninguém disse «Está feito»`
          : "a hora passou e ninguém disse «Está feito»",
    });
  };
  for (const t of trabalhos) {
    if (t.resumo.fase !== "atribuida") continue;
    const n = t.negociacoes.find((x) => x.estado === "acordada");
    if (n) juntar(t.pedidoId, t.estadoDoPedido, n, t.dataAgendada);
  }
  for (const p of pedidos) {
    const n = p.negociacoes.find((x) => x.estado === "acordada");
    if (n) juntar(p.id, p.status, n, p.dataAgendada);
  }
  return out;
}

/* ── 5. O parceiro escolhido que não respondeu ───────────────────────────── */

/** A negociação foi escolhida pelo cliente na lista das mudanças? (1, "1" ou true) */
const escolhidaPeloCliente = (n: NegociacaoParaOLado) =>
  n.escolhidoPeloCliente === true || Number(n.escolhidoPeloCliente) === 1;

/** Respondeu: pôs um número, aceitou, ficou acordada ou tem o trabalho confirmado. */
const respondeu = (n: NegociacaoParaOLado) =>
  n.estado === "aguarda_contratacao" ||
  n.estado === "acordada" ||
  n.confirmadoEm != null ||
  propostasDe(n.propostasJson).some((x) => x.por === "profissional");

/**
 * 11-11-2026: numa mudança em que o cliente escolheu os parceiros da lista, o
 * pedido foi logo a eles, sem passar pela Mesa. Se o prazo de resposta
 * (`prazoRespostaEm`) passou e nenhum dos escolhidos respondeu, o pedido
 * fica à espera de nós: «parceiro não respondeu». Espera desde o prazo.
 */
export function semRespostaDoNossoLado(pedidos: PedidoParaOLado[], agora: Date): LinhaDoNossoLado[] {
  const out: LinhaDoNossoLado[] = [];
  for (const p of pedidos) {
    if (FECHADO.has(p.status ?? "")) continue;
    const escolhidas = p.negociacoes.filter(escolhidaPeloCliente);
    if (escolhidas.length === 0 || escolhidas.some(respondeu)) continue;
    const prazos = escolhidas
      .map((n) => instanteDaBase(n.prazoRespostaEm ?? null)?.getTime())
      .filter((t): t is number => t != null);
    if (prazos.length === 0) continue;
    const prazo = Math.max(...prazos);
    if (prazo > agora.getTime()) continue;
    const quantos = escolhidas.length;
    out.push({
      tipo: "sem_resposta",
      pedidoId: p.id,
      telefone: null,
      esperaS: Math.max(0, Math.floor((agora.getTime() - prazo) / 1000)),
      oQue:
        quantos === 1
          ? "parceiro não respondeu — o escolhido pelo cliente deixou passar o prazo"
          : `parceiro não respondeu — nenhum dos ${quantos} escolhidos pelo cliente respondeu no prazo`,
    });
  }
  return out;
}

/* ── Tudo junto ─────────────────────────────────────────────────────────── */

/**
 * Os quatro grupos, pela ordem da decisão; dentro de cada um, quem espera há
 * mais tempo primeiro. Nas conversas, como no «Por responder» da mesa delas
 * (`ordenarNaMesa`): primeiro as dos últimos 3 dias, e só depois as antigas —
 * uma conversa de há semanas pode ter sido respondida por telefone, e não
 * pode empurrar as de hoje para baixo.
 */
export function doNossoLado(fontes: {
  conversas: ConversaParaOLado[] | null;
  pedidos: PedidoParaOLado[];
  trabalhosClyon: TrabalhoClyonParaOLado[];
  agora: Date;
}): GrupoDoNossoLado[] {
  const porEspera = (l: LinhaDoNossoLado[]) =>
    [...l].sort((a, b) => {
      if (a.tipo === "conversa") {
        const antigaA = a.esperaS > ESPERA_RECENTE_S;
        const antigaB = b.esperaS > ESPERA_RECENTE_S;
        if (antigaA !== antigaB) return antigaA ? 1 : -1;
        if (antigaA) return a.esperaS - b.esperaS;
      }
      return b.esperaS - a.esperaS;
    });
  const grupos: Array<[TipoDoNossoLado, LinhaDoNossoLado[]]> = [
    ["conversa", fontes.conversas ? conversasDoNossoLado(fontes.conversas) : []],
    ["preco_clyon", precosClyonDoNossoLado(fontes.trabalhosClyon, fontes.agora)],
    ["propostas", propostasDoNossoLado(fontes.pedidos, fontes.agora)],
    ["data_passada", datasPassadasDoNossoLado(fontes.pedidos, fontes.trabalhosClyon, fontes.agora)],
    ["sem_resposta", semRespostaDoNossoLado(fontes.pedidos, fontes.agora)],
  ];
  return grupos.map(([tipo, linhas]) => ({ tipo, titulo: TITULOS_DO_NOSSO_LADO[tipo], linhas: porEspera(linhas) }));
}
