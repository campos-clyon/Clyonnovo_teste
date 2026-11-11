import { horaEmLisboa, instanteDaBase, pecasEmLisboa } from "./hora-de-lisboa";

/**
 * OS ESCOLHIDOS SEM RESPOSTA — A REGRA (d6, 11-11-2026).
 *
 * Quando é que um pedido de mudança está «sem resposta dos escolhidos», o que
 * fica gravado no pedido e se a CLYON o pode enviar a mais parceiros. Sem
 * frases: os textos de cada leitor estão ao lado, e lêem-se todos por
 * `escolhidos-sem-resposta.ts` (a porta única). PURA: sem base, sem rede.
 */

const dois = (n: number) => String(n).padStart(2, "0");

/** «14:30» em Lisboa. */
export const horaEMinutos = (d: Date) => horaEmLisboa(d);
/** «11/11» em Lisboa. */
export function diaEMes(d: Date): string {
  const p = pecasEmLisboa(d);
  return `${dois(p.dia)}/${dois(p.mes)}`;
}
/** «11/11, 14:30» — o dia e a hora de Lisboa, seja qual for o fuso de quem lê. */
export function diaEHoraDoPrazo(prazo: Date): string {
  return `${diaEMes(prazo)}, ${horaEMinutos(prazo)}`;
}
/** Um instante da base (ou em ISO), ou null. */
export const instanteOuNull = (v: string | Date | null | undefined): Date | null => instanteDaBase(v ?? null);
const instante = instanteOuNull;

/* ── A regra ────────────────────────────────────────────────────────────── */

/** O mínimo de uma negociação para se saber se o escolhido respondeu. */
export type NegociacaoDoPedido = {
  estado?: string | null;
  propostasJson?: string | null;
  confirmadoEm?: string | Date | null;
  /** Escolhido pelo cliente na lista das mudanças (1, "1" ou true). */
  escolhidoPeloCliente?: number | string | boolean | null;
  prazoRespostaEm?: string | Date | null;
  profissionalNome?: string | null;
};

/** «sem_resposta»: o prazo passou calado. «disseram_que_nao»: todos carregaram em «Não estou interessado». */
export type CasoSemResposta = "sem_resposta" | "disseram_que_nao";

export type SemResposta = {
  caso: CasoSemResposta;
  /** Quando acabou o prazo (o último, se os escolhidos tiverem prazos diferentes). */
  prazo: Date;
  /** Quantos parceiros o cliente escolheu. */
  escolhidos: number;
  /** Os nomes dos escolhidos, pela ordem das negociações (só os que se conhecem). */
  nomes: string[];
  /** Os que continuam com a negociação aberta e sem proposta: ainda podem responder. */
  calados: NegociacaoDoPedido[];
};

/** A negociação foi escolhida pelo cliente na lista das mudanças? */
export const eEscolhida = (n: NegociacaoDoPedido) => n.escolhidoPeloCliente === true || Number(n.escolhidoPeloCliente) === 1;

/** Quantas propostas o parceiro já fez nesta negociação. */
export function propostasDoProfissional(json: string | null | undefined): number {
  if (!json) return 0;
  try {
    const l = JSON.parse(json) as Array<{ por?: string }>;
    return Array.isArray(l) ? l.filter((x) => x?.por === "profissional").length : 0;
  } catch {
    return 0;
  }
}

/** Há alguma coisa para o cliente decidir: um número de um parceiro, um aceite ou o trabalho já fechado. */
export const temResposta = (n: NegociacaoDoPedido) =>
  n.estado === "aguarda_contratacao" || n.estado === "acordada" || n.confirmadoEm != null || propostasDoProfissional(n.propostasJson) > 0;

/**
 * O PEDIDO ESTÁ SEM RESPOSTA DOS ESCOLHIDOS?
 *
 *   · «sem_resposta»: o prazo passou e NENHUM parceiro (escolhido ou não) pôs
 *     um número em cima da mesa. Se pelo menos um confirmou ou propôs, o
 *     cliente já tem o que decidir: não há selo nem aviso.
 *   · «disseram_que_nao»: todos os escolhidos disseram que não — trata-se
 *     logo, sem esperar pelo prazo.
 *
 * Null quando não é o caso (também num pedido sem escolhidos).
 */
export function semRespostaDosEscolhidos(negociacoes: readonly NegociacaoDoPedido[], agora: Date): SemResposta | null {
  const escolhidas = negociacoes.filter(eEscolhida);
  if (escolhidas.length === 0 || negociacoes.some(temResposta)) return null;
  const prazos = escolhidas.map((n) => instante(n.prazoRespostaEm)?.getTime()).filter((t): t is number => t != null);
  if (prazos.length === 0) return null;
  const ultimo = Math.max(...prazos);
  const nomes = escolhidas.map((n) => (n.profissionalNome ?? "").trim()).filter(Boolean);
  const calados = escolhidas.filter((n) => n.estado === "aberta");
  if (escolhidas.every((n) => n.estado === "desistida")) {
    return { caso: "disseram_que_nao", prazo: new Date(Math.min(ultimo, agora.getTime())), escolhidos: escolhidas.length, nomes, calados };
  }
  if (ultimo > agora.getTime()) return null;
  return { caso: "sem_resposta", prazo: new Date(ultimo), escolhidos: escolhidas.length, nomes, calados };
}

/* ── O que fica gravado no pedido (`escolhaDosParceirosJson`) ───────────── */

export type CanalDoAviso = "whatsapp" | "email" | "app";

/** A marca do aviso ao cliente, em `escolhaDosParceirosJson.semResposta`. É ela que faz o «uma só vez». */
export type MarcaSemResposta = {
  /** Quando o cliente foi avisado (ISO). */
  avisadoEm: string;
  prazoEm: string;
  escolhidos: number;
  caso: CasoSemResposta;
  /** Por onde saiu. Vazio = não saiu por nenhum canal (a equipa fala com ele). */
  canais: CanalDoAviso[];
  /** `null` enquanto o envio decorre. */
  saiu: boolean | null;
};

export type SaidaDoCliente = "esperar" | "escolher_outro" | "pedir_a_clyon";

/** O que o cliente respondeu ao aviso, em `escolhaDosParceirosJson.decisaoDoCliente`. */
export type DecisaoDoCliente = {
  saida: SaidaDoCliente;
  em: string;
  /** «equipa»: pedido feito por telefone ou WhatsApp e registado no backoffice. */
  por: "cliente" | "equipa";
  operador?: string | null;
  /** «escolher_outro»: quem escolheu a mais, e o prazo deles. */
  nomes?: string[];
  prazoEm?: string | null;
};

/** O que a Mesa e o cliente precisam de saber da escolha, lido do pedido. */
export type EscolhidosDoPedido = {
  /** Quando o pedido foi enviado aos escolhidos (ISO). */
  em: string | null;
  /** O cliente marcou «Pedir também à CLYON que procure mais parceiros» na lista. */
  procurarMais: boolean;
  marca: MarcaSemResposta | null;
  decisao: DecisaoDoCliente | null;
  /** A equipa enviou o pedido a mais profissionais, a pedido do cliente. */
  enviadoAMais: { em: string; quantos: number } | null;
};

function objecto(v: unknown): Record<string, unknown> | null {
  let o: unknown = v;
  if (typeof v === "string") {
    try {
      o = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
}

export function marcaDeJson(v: unknown): MarcaSemResposta | null {
  const m = objecto(v) as Partial<MarcaSemResposta> | null;
  if (!m || typeof m.avisadoEm !== "string" || !instante(m.avisadoEm)) return null;
  return {
    avisadoEm: m.avisadoEm,
    prazoEm: typeof m.prazoEm === "string" ? m.prazoEm : m.avisadoEm,
    escolhidos: Number(m.escolhidos) > 0 ? Number(m.escolhidos) : 1,
    caso: m.caso === "disseram_que_nao" ? "disseram_que_nao" : "sem_resposta",
    canais: Array.isArray(m.canais) ? m.canais.filter((c): c is CanalDoAviso => c === "whatsapp" || c === "email" || c === "app") : [],
    saiu: m.saiu === true ? true : m.saiu === false ? false : null,
  };
}

export function decisaoDeJson(v: unknown): DecisaoDoCliente | null {
  const d = objecto(v) as Partial<DecisaoDoCliente> | null;
  if (!d || typeof d.em !== "string" || !instante(d.em)) return null;
  if (d.saida !== "esperar" && d.saida !== "escolher_outro" && d.saida !== "pedir_a_clyon") return null;
  return {
    saida: d.saida,
    em: d.em,
    por: d.por === "equipa" ? "equipa" : "cliente",
    operador: typeof d.operador === "string" && d.operador.trim() ? d.operador.trim() : null,
    nomes: Array.isArray(d.nomes) ? d.nomes.filter((x): x is string => typeof x === "string") : undefined,
    prazoEm: typeof d.prazoEm === "string" ? d.prazoEm : null,
  };
}

/**
 * O resumo da escolha, a partir do JSON pequeno que a base devolve
 * (`{ em, procurarMais, semResposta, decisao, enviadoAMais }`). Null num pedido sem escolhidos.
 */
export function escolhidosDeJson(v: unknown): EscolhidosDoPedido | null {
  const o = objecto(v);
  if (!o) return null;
  const enviado = objecto(o.enviadoAMais);
  return {
    em: typeof o.em === "string" ? o.em : null,
    procurarMais: o.procurarMais === true || o.procurarMais === "true",
    marca: marcaDeJson(o.semResposta),
    decisao: decisaoDeJson(o.decisao ?? o.decisaoDoCliente),
    enviadoAMais:
      enviado && typeof enviado.em === "string" && instante(enviado.em)
        ? { em: enviado.em, quantos: Number(enviado.quantos) > 0 ? Number(enviado.quantos) : 0 }
        : null,
  };
}

/** O cliente pediu à CLYON que procure mais parceiros (na lista, no aviso, ou dito à equipa)? */
export function oClientePediuAClyon(e: Pick<EscolhidosDoPedido, "procurarMais" | "decisao"> | null | undefined): boolean {
  return !!e && (e.procurarMais || e.decisao?.saida === "pedir_a_clyon");
}

/**
 * A CLYON PODE ENVIAR ESTE PEDIDO A MAIS PARCEIROS? Num pedido em que o
 * cliente escolheu os parceiros da lista, só se ele o pedir. Um pedido sem
 * escolhidos (`null`) segue como sempre.
 */
export function podeAbrirAMaisParceiros(e: EscolhidosDoPedido | null | undefined): boolean {
  return e == null || oClientePediuAClyon(e);
}
