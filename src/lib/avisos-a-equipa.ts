import { pecasEmLisboa } from "./hora-de-lisboa";
import { haQuanto } from "./mesa-das-conversas";
import type { LinhaDoNossoLado } from "./do-nosso-lado";
import { telefoneLegivel } from "./telefone-legivel";

/**
 * OS AVISOS À EQUIPA — o que está parado chega ao telemóvel. d23, 10-11-2026.
 *
 * Até aqui a Mesa sabia o que esperava por nós («Do nosso lado», d14) e não o
 * dizia a ninguém: só o via quem a tivesse aberta. Três momentos passam a
 * avisar a equipa (o administrador e as assistentes com a secção):
 *
 *   1. uma linha do «Do nosso lado» há mais de 2 h — a MESMA conta do cartão
 *      da Mesa (`doNossoLado`), e não uma conta nova;
 *   2. um pedido no «Por decidir» há mais de 1 h (ainda não foi a ninguém);
 *   3. a Vitória entregou a conversa a uma pessoa.
 *
 * SÓ PARA DENTRO. Nenhuma mensagem nova a clientes nem a profissionais.
 *
 * UM AVISO POR PEDIDO E POR ESTADO. Cada aviso tem uma chave (o estado e o
 * pedido, ou o telefone) e o instante em que a espera começou. A mesma espera
 * nunca avisa duas vezes; uma espera NOVA do mesmo pedido (o cliente voltou a
 * escrever depois de lhe respondermos, outra proposta chegou depois do envio)
 * avisa outra vez — é outra coisa à espera de nós.
 *
 * SÓ EM HORÁRIO, 08h–21h em Lisboa. Fora de horas nada se envia: o que está
 * parado continua parado e é contado na primeira passagem das 08h; as
 * entregas a uma pessoa ficam guardadas e saem nessa passagem.
 *
 * PURO, com as leituras e o envio passados por fora (`DependenciasDosAvisos`),
 * para os testes correrem sem base. A base está em `avisos-a-equipa-na-base.ts`.
 */

/** A partir de que hora (inclusive) e até que hora (exclusive), em Lisboa. */
export const HORA_EM_QUE_COMECA = 8;
export const HORA_EM_QUE_ACABA = 21;

/** Mais de 2 h no «Do nosso lado». */
export const PRAZO_DO_NOSSO_LADO_S = 2 * 3600;
/** Mais de 1 h no «Por decidir». */
export const PRAZO_DO_POR_DECIDIR_S = 3600;

/**
 * A folga para dizer «é a mesma espera». O instante de onde se conta vem de
 * segundos arredondados (`esperaS`) — muda um segundo de passagem para
 * passagem. Dez minutos chegam para a mesma espera e são muito menos do que
 * o prazo de qualquer espera nova.
 */
export const FOLGA_DA_MESMA_ESPERA_MS = 10 * 60 * 1000;

/** Uma entrega guardada fora de horas que ninguém viu em 16 h já não é notícia. */
export const ENTREGA_VALE_MS = 16 * 3600 * 1000;

/** Que parte da equipa o recebe: a Mesa ou o WhatsApp (o administrador recebe tudo). */
export type SeccaoDoAviso = "mesa" | "whatsapp";

export type TipoDoAviso = "nosso_lado" | "por_decidir" | "entregue";

export type AvisoAEquipa = {
  /** Única por pedido e por estado — ver `chaveDoAviso`. */
  chave: string;
  tipo: TipoDoAviso;
  pedidoId: number | null;
  /** Só sem pedido: é por ele que se encontra a conversa. */
  telefone: string | null;
  /** Desde quando está à espera. */
  desde: Date;
  seccao: SeccaoDoAviso;
  titulo: string;
  corpo: string;
  /** Para onde leva ao tocar — sem dados de pessoas no endereço. */
  url: string;
};

/** O pedido no «Por decidir» — ainda sem negociações, não fechado. */
export type PedidoPorDecidir = { id: number; criadoEm: Date | null };

/** Está na hora de avisar a equipa? 08h–21h em Lisboa, seja qual for o fuso do servidor. */
export function emHorarioDaEquipa(agora: Date): boolean {
  const h = pecasEmLisboa(agora).hora;
  return h >= HORA_EM_QUE_COMECA && h < HORA_EM_QUE_ACABA;
}

const nove = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "").slice(-9);

/** A chave: o estado e o pedido — ou, sem pedido, o telefone (os 9 dígitos). */
export function chaveDoAviso(tipo: string, pedidoId: number | null, telefone: string | null): string {
  return pedidoId != null ? `${tipo}:p${pedidoId}` : `${tipo}:t${nove(telefone)}`;
}

/**
 * É uma espera nova? Sem nada guardado, sim; com uma espera guardada que
 * começou noutro instante (mais do que a folga), também.
 */
export function eUmaEsperaNova(guardadaDesde: Date | null | undefined, desde: Date): boolean {
  if (!guardadaDesde) return true;
  return Math.abs(guardadaDesde.getTime() - desde.getTime()) > FOLGA_DA_MESMA_ESPERA_MS;
}

const ligacaoDoPedido = (seccao: SeccaoDoAviso, pedidoId: number | null) =>
  seccao === "whatsapp" && pedidoId == null
    ? "/admin?section=whatsapp"
    : `/admin?section=${seccao === "whatsapp" ? "whatsapp" : "negociacoes_clyon"}${
        pedidoId != null ? `&procurar=${encodeURIComponent(`#${pedidoId}`)}` : ""
      }`;

/** Os avisos do «Do nosso lado»: as linhas do cartão da Mesa há mais de 2 h. */
export function avisosDoNossoLado(linhas: readonly LinhaDoNossoLado[], agora: Date): AvisoAEquipa[] {
  const out: AvisoAEquipa[] = [];
  for (const l of linhas) {
    if (l.esperaS <= PRAZO_DO_NOSSO_LADO_S) continue;
    const seccao: SeccaoDoAviso = l.tipo === "conversa" ? "whatsapp" : "mesa";
    const quem = l.pedidoId != null ? `Pedido #${l.pedidoId}` : `Conversa ${telefoneLegivel(l.telefone ?? "")}`;
    out.push({
      chave: chaveDoAviso(`nosso_lado:${l.tipo}`, l.pedidoId, l.telefone),
      tipo: "nosso_lado",
      pedidoId: l.pedidoId,
      telefone: l.pedidoId != null ? null : l.telefone,
      desde: new Date(agora.getTime() - l.esperaS * 1000),
      seccao,
      titulo: `Do nosso lado ${haQuanto(l.esperaS)}`,
      corpo: `${quem}: ${l.oQue}.`,
      url: ligacaoDoPedido(seccao, l.pedidoId),
    });
  }
  return out;
}

/** Os avisos do «Por decidir»: os pedidos que ainda não foram a ninguém há mais de 1 h. */
export function avisosDoPorDecidir(pedidos: readonly PedidoPorDecidir[], agora: Date): AvisoAEquipa[] {
  const out: AvisoAEquipa[] = [];
  for (const p of pedidos) {
    if (!p.criadoEm) continue;
    const esperaS = Math.floor((agora.getTime() - p.criadoEm.getTime()) / 1000);
    if (esperaS <= PRAZO_DO_POR_DECIDIR_S) continue;
    out.push({
      chave: chaveDoAviso("por_decidir", p.id, null),
      tipo: "por_decidir",
      pedidoId: p.id,
      telefone: null,
      desde: p.criadoEm,
      seccao: "mesa",
      titulo: `Por decidir ${haQuanto(esperaS)}`,
      corpo: `Pedido #${p.id}: ainda não foi a ninguém — decida se é valor fixo ou negociação.`,
      url: ligacaoDoPedido("mesa", p.id),
    });
  }
  return out;
}

/**
 * O aviso de uma conversa entregue a uma pessoa. Com o n.º do pedido, se o
 * houver; sem ele, o contacto. A chave leva o instante: cada entrega é uma.
 */
export function avisoDaEntrega(dados: {
  telefone: string;
  pedidoId: number | null;
  motivo: string | null;
  agora: Date;
}): AvisoAEquipa {
  const quem =
    dados.pedidoId != null
      ? `Pedido #${dados.pedidoId} (${telefoneLegivel(dados.telefone)})`
      : `Conversa ${telefoneLegivel(dados.telefone)}`;
  const motivo = (dados.motivo ?? "").trim();
  return {
    chave: `entregue:t${nove(dados.telefone)}:${Math.floor(dados.agora.getTime() / 60000)}`,
    tipo: "entregue",
    pedidoId: dados.pedidoId,
    telefone: dados.telefone,
    desde: dados.agora,
    seccao: "whatsapp",
    titulo: "A Vitória passou-lhe uma conversa",
    corpo: `${quem}${motivo ? `: ${motivo.slice(0, 140)}` : ""}. Responda no WhatsApp.`,
    url: "/admin?section=whatsapp",
  };
}

/* ── A passagem ─────────────────────────────────────────────────────────── */

export type DependenciasDosAvisos = {
  /** As linhas do «Do nosso lado», pela conta da Mesa. Pode lançar: conta como «não lido». */
  lerDoNossoLado: () => Promise<LinhaDoNossoLado[]>;
  lerPorDecidir: () => Promise<PedidoPorDecidir[]>;
  /**
   * Guarda o aviso se for uma espera nova e devolve `true`; com a mesma
   * espera já guardada, `false`. Com `enviado`, fica dado como enviado.
   */
  reservar: (aviso: AvisoAEquipa, enviado: boolean) => Promise<boolean>;
  /** As entregas guardadas e ainda por enviar. */
  entregasPorEnviar: () => Promise<AvisoAEquipa[]>;
  /** A conversa continua entregue a uma pessoa? Uma já devolvida não se anuncia. */
  aindaEntregue: (telefone: string) => Promise<boolean>;
  marcarEnviado: (chave: string, como: "enviado" | "dispensado") => Promise<void>;
  /** Envia à equipa da secção; devolve a quantos aparelhos foi (0 = ninguém com avisos ligados). */
  enviar: (aviso: AvisoAEquipa) => Promise<number>;
};

export type ResultadoDosAvisos = {
  emHorario: boolean;
  /** Os que estão hoje acima dos prazos (o que se avisaria numa primeira passagem). */
  acimaDosPrazos: number;
  enviados: number;
  entregasEnviadas: number;
  linhas: string[];
  falhas: string[];
};

/**
 * Uma passagem. Fora de horas não lê nem envia nada — o que estiver parado às
 * 08h é contado nessa passagem. Em horário: as entregas guardadas primeiro,
 * depois o «Do nosso lado» e o «Por decidir». Nunca lança.
 */
export async function correrOsAvisosDaEquipa(
  deps: DependenciasDosAvisos,
  agora: Date = new Date(),
): Promise<ResultadoDosAvisos> {
  const r: ResultadoDosAvisos = {
    emHorario: emHorarioDaEquipa(agora),
    acimaDosPrazos: 0,
    enviados: 0,
    entregasEnviadas: 0,
    linhas: [],
    falhas: [],
  };
  if (!r.emHorario) return r;

  // 1. As entregas que ficaram guardadas (fora de horas, ou o envio falhou).
  try {
    for (const a of await deps.entregasPorEnviar()) {
      if (agora.getTime() - a.desde.getTime() > ENTREGA_VALE_MS || !(a.telefone && (await deps.aindaEntregue(a.telefone)))) {
        await deps.marcarEnviado(a.chave, "dispensado");
        continue;
      }
      await deps.enviar(a);
      await deps.marcarEnviado(a.chave, "enviado");
      r.entregasEnviadas++;
      r.linhas.push(`Entrega anunciada: ${a.pedidoId != null ? `#${a.pedidoId}` : "conversa sem pedido"}.`);
    }
  } catch (e) {
    r.falhas.push(`entregas: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. O que está parado.
  const avisos: AvisoAEquipa[] = [];
  await deps
    .lerDoNossoLado()
    .then((l) => avisos.push(...avisosDoNossoLado(l, agora)))
    .catch((e) => r.falhas.push(`do nosso lado: ${e instanceof Error ? e.message : String(e)}`));
  await deps
    .lerPorDecidir()
    .then((p) => avisos.push(...avisosDoPorDecidir(p, agora)))
    .catch((e) => r.falhas.push(`por decidir: ${e instanceof Error ? e.message : String(e)}`));
  r.acimaDosPrazos = avisos.length;

  for (const a of avisos) {
    try {
      if (!(await deps.reservar(a, true))) continue;
      await deps.enviar(a);
      r.enviados++;
      r.linhas.push(`${a.tipo === "por_decidir" ? "Por decidir" : "Do nosso lado"}: ${a.pedidoId != null ? `#${a.pedidoId}` : "conversa sem pedido"}.`);
    } catch (e) {
      r.falhas.push(`${a.chave}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return r;
}

/**
 * A ENTREGA A UMA PESSOA, no momento. Em horário sai já (e fica dada como
 * enviada); fora de horas fica guardada e sai na passagem das 08h. Nunca lança.
 */
export async function anunciarAEntrega(
  deps: Pick<DependenciasDosAvisos, "reservar" | "enviar">,
  aviso: AvisoAEquipa,
  agora: Date = new Date(),
): Promise<"enviado" | "guardado" | "repetido"> {
  try {
    const ja = emHorarioDaEquipa(agora);
    if (!(await deps.reservar(aviso, ja))) return "repetido";
    if (!ja) return "guardado";
    await deps.enviar(aviso);
    return "enviado";
  } catch (e) {
    console.error("[avisos-a-equipa] entrega:", e instanceof Error ? e.message : e);
    return "guardado";
  }
}
