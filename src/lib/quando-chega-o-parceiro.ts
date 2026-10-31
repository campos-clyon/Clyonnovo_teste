import { semAcentos } from "./leitor-da-recolha";
import { quandoEmLisboa } from "./pedido-para-a-app";
import { naData } from "./frases-do-pedido";
import { estadoDaViagemParaOCliente, type Viagem } from "./viagem-ate-ao-cliente";

/**
 * «ELE VEM HOJE?», «A QUE HORAS CHEGA?» — 31-10-2026 (decisão d8).
 *
 * Um cliente com o trabalho contratado perguntava pelo WhatsApp se o parceiro
 * vinha hoje, e a Vitória respondia o NO_MESMO_DIA de quem ainda vai pedir
 * («Depende de haver parceiro disponível…»), ou «Está tudo a andar deste
 * lado». A app mostra-lhe o dia marcado e a viagem («O parceiro está a
 * caminho»). Aqui diz-se o mesmo, da mesma fonte: `quandoEmLisboa` da
 * `dataCombinada` e `estadoDaViagemParaOCliente` — e «parceiro», nunca
 * «profissional».
 */

/** A pergunta de quem quer saber quando chega o parceiro (não a de quem ainda vai pedir). */
export function perguntaQuandoChega(texto: string): boolean {
  const t = semAcentos(texto);
  const pergunta = /\?/.test(texto) || /^\s*(quando|a\s+que\s+horas|ja)\b/.test(t);
  if (!pergunta) return false;
  const quem = String.raw`(ele|ela|eles|elas|o\s+parceiro|a\s+parceira|o\s+senhor|a\s+senhora|o\s+rapaz|a\s+equipa|o\s+motorista|o\s+tecnico)`;
  const vem = String.raw`(vem|vem\s+ca|veem|vao\s+vir|chega|chegam|aparece|aparecem|passa|passam|esta\s+a\s+caminho|estao\s+a\s+caminho|vem\s+a\s+caminho)`;
  return (
    new RegExp(String.raw`\ba\s+que\s+horas\s+(e\s+que\s+)?(${quem}\s+)?${vem}\b`).test(t) ||
    new RegExp(String.raw`\bquando\s+(e\s+que\s+)?(${quem}\s+)?${vem}\b`).test(t) ||
    new RegExp(String.raw`\b${quem}\s+(ainda\s+|ja\s+|so\s+)?${vem}\b[^\n]*\b(hoje|amanha|quando|horas|ja|cedo|tarde|manha)\b`).test(t) ||
    new RegExp(String.raw`\b${quem}\s+(ainda\s+|ja\s+)?${vem}\s*\?`).test(t) ||
    new RegExp(String.raw`\b${vem}\s+(hoje|amanha|a\s+que\s+horas|quando)\b`).test(t) ||
    /\b(ja\s+)?(esta|estao|vem)\s+a\s+caminho\b/.test(t)
  );
}

export type TrabalhoContratado = Viagem & {
  pedidoId: number;
  /** O nome do parceiro; sem ele, «o parceiro». */
  nome: string | null;
  dataCombinada?: Date | string | null;
};

/** O primeiro nome, ou «o parceiro» (a meio da frase) — no que o cliente lê, nunca «profissional». */
export function nomeDoParceiro(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "o parceiro";
}

/**
 * A resposta: a viagem, se já começou; o dia marcado; e, sem dia, que ainda
 * não há (e a conversa passa a uma pessoa: `semDia`).
 */
export function respostaDeQuandoChega(t: TrabalhoContratado): { texto: string; semDia: boolean } {
  const nome = nomeDoParceiro(t.nome);
  const viagem = estadoDaViagemParaOCliente(t);
  const dia = quandoEmLisboa(t.dataCombinada ?? null);
  const partes = [`Pedido #${t.pedidoId}:`];
  if (viagem) partes.push(viagem);
  if (dia) {
    partes.push(`O trabalho com ${nome} está marcado ${naData(dia)}.`);
    if (!/às \d{2}:\d{2}$/.test(dia) && !viagem) partes.push(`A hora combina-a ${nome} consigo.`);
    return { texto: partes.join(" "), semDia: false };
  }
  if (viagem) return { texto: partes.join(" "), semDia: false };
  partes.push(`Ainda não há dia marcado com ${nome} na plataforma. Passo a sua pergunta a uma pessoa da CLYON, que confirma consigo.`);
  return { texto: partes.join(" "), semDia: true };
}

/** O trabalho contratado e ainda por fazer, entre as negociações dos pedidos dele. */
export function trabalhoPorFazer<
  N extends Viagem & {
    estado: string;
    execucaoEnviadaEm?: Date | string | null;
    confirmadoEm?: Date | string | null;
    dataCombinada?: Date | string | null;
    profissionalNome?: string | null;
  },
>(pedidoId: number, negociacoes: N[]): TrabalhoContratado | null {
  const n = negociacoes.find((x) => x.estado === "acordada" && !x.execucaoEnviadaEm && !x.confirmadoEm);
  if (!n) return null;
  return {
    pedidoId,
    nome: n.profissionalNome ?? null,
    dataCombinada: n.dataCombinada ?? null,
    aCaminhoEm: n.aCaminhoEm ?? null,
    proximoEm: n.proximoEm ?? null,
    chegouEm: n.chegouEm ?? null,
    chegadaConfirmadaEm: n.chegadaConfirmadaEm ?? null,
  };
}
