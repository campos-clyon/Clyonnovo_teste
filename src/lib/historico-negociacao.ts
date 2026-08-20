/**
 * O que se passou nesta negociação, do princípio ao fim.
 *
 * As propostas já estavam gravadas — cada uma com quem a fez, quanto e
 * quando. O que não existia era alguém a mostrá-las: o ecrã listava valores
 * sem data nenhuma, e só quando havia mais do que um. Com uma proposta só,
 * não se via nada.
 *
 * Isso chegava enquanto a negociação vivia numa troca de emails, onde a
 * caixa de correio servia de arquivo. Deixou de chegar quando passou a viver
 * dentro da conta: ao terceiro pedido, sem datas, ninguém sabe quem falou por
 * último nem há quanto tempo — e é sobre isso que se decide se ainda vale a
 * pena responder.
 *
 * As marcas do fim (feito, confirmado, pago, avaliado) entram na mesma lista.
 * São a mesma história: separá-las em dois sítios obrigava a lê-las por ordem
 * de cabeça.
 *
 * Nada disto é gravado de novo. É uma leitura do que já está na base — por
 * isso não se perde, e continua igual em qualquer ecrã que o mostre.
 */

import type { Proposta } from "./negociacao";

export type QuemFalou = "cliente" | "profissional" | "sistema";

export type EventoDaNegociacao = {
  /** Em ISO, para ordenar e formatar onde for mostrado. */
  quando: string;
  quem: QuemFalou;
  /** A frase, já do ponto de vista de quem lê. */
  texto: string;
  /** O valor em euros, quando o evento tem um. */
  valor: number | null;
  /** Se esta proposta ainda está de pé, ou o que lhe aconteceu. */
  estado: Proposta["estado"] | null;
};

export type MarcosDaNegociacao = {
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
  avaliadoEm?: Date | string | null;
  estrelas?: number | null;
  valorAcordado?: number | string | null;
};

/** Uma data utilizável, ou null. Nunca um "Invalid Date" a passar adiante. */
function data(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function numero(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const SUFIXO: Record<Proposta["estado"], string> = {
  pendente: "",
  aceite: " — aceite",
  recusada: " — recusada",
  expirada: " — expirou sem resposta",
};

/**
 * A lista de eventos, do mais antigo para o mais recente.
 *
 * `euDigo` é como o leitor se vê a si próprio: no painel do profissional as
 * propostas dele são "Você propôs", no ecrã do cliente são "O profissional
 * propôs". A mesma função serve os dois, e é por isso que a diferença é um
 * argumento e não uma segunda cópia disto.
 */
export function historicoDaNegociacao(
  propostas: Proposta[],
  marcos: MarcosDaNegociacao = {},
  euSou: QuemFalou = "profissional",
): EventoDaNegociacao[] {
  const eventos: EventoDaNegociacao[] = [];

  for (const p of propostas ?? []) {
    const quando = data(p.criadaEm);
    if (!quando) continue; // uma proposta sem data não se pode pôr numa linha do tempo

    const quem: QuemFalou = p.por === "cliente" ? "cliente" : "profissional";
    const nome = quem === euSou ? "Você" : quem === "cliente" ? "O cliente" : "O profissional";

    eventos.push({
      quando: quando.toISOString(),
      quem,
      texto: `${nome} propôs${SUFIXO[p.estado] ?? ""}`,
      valor: numero(p.valor),
      estado: p.estado,
    });
  }

  const acordado = numero(marcos.valorAcordado);

  const marco = (
    quando: Date | string | null | undefined,
    texto: string,
    valor: number | null = null,
  ) => {
    const d = data(quando);
    if (d) eventos.push({ quando: d.toISOString(), quem: "sistema", texto, valor, estado: null });
  };

  marco(marcos.execucaoEnviadaEm, "Trabalho marcado como feito, à espera do cliente");
  marco(marcos.confirmadoEm, "O cliente confirmou. O valor ficou disponível", acordado);
  marco(marcos.pagoEm, "Transferido", acordado);

  const estrelas = numero(marcos.estrelas);
  if (data(marcos.avaliadoEm) && estrelas != null) {
    marco(marcos.avaliadoEm, `O cliente avaliou com ${estrelas} de 5 estrelas`);
  }

  // Estável: duas coisas no mesmo instante mantêm a ordem em que entraram, que
  // é a ordem em que aconteceram. Um sort por data sozinho podia trocá-las.
  return eventos
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const d = Date.parse(a.e.quando) - Date.parse(b.e.quando);
      return d !== 0 ? d : a.i - b.i;
    })
    .map(({ e }) => e);
}

/**
 * "há 2 h", "há 3 dias".
 *
 * Uma data absoluta obriga a fazer a conta de cabeça para saber se ainda é
 * recente. O que interessa a quem está a decidir se responde é há quanto
 * tempo — não o dia.
 */
export function haQuantoTempo(quando: string, agora: Date): string {
  const minutos = Math.floor((agora.getTime() - Date.parse(quando)) / 60000);
  if (!Number.isFinite(minutos)) return "";
  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}
