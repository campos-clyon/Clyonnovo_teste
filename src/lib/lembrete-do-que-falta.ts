/**
 * OS LEMBRETES DO QUE FALTA — d71 (CEO e dono, 19-11-2026).
 *
 * Os pedidos em «Orçamentos novos» (ainda não foram a ninguém) a que falta
 * informação recebem, às 10h de Lisboa, uma mensagem a pedir ao cliente que
 * complete o pedido, para os parceiros lhe poderem enviar orçamento:
 *
 *   · dia 1, dia 3 e dia 5, contados a partir do primeiro envio (no máximo 3);
 *   · sem resposta a nenhum, no dia 7 o pedido é ARQUIVADO (nunca apagado),
 *     com uma mensagem final a dizer que pode voltar a pedir quando quiser;
 *   · «2» (ou «cancelar», «já não preciso»), com um lembrete destes em aberto
 *     para aquele número e pedido, cancela o pedido; uma resposta ambígua, com
 *     fotografias ou com dados não cancela: segue a conversa da Vitória;
 *   · o ciclo pára quando o cliente responde, quando o pedido fica completo ou
 *     sai dos «Orçamentos novos». UM ciclo por pedido, nunca outro.
 *
 * Pelo WhatsApp (a fila da ponte, 20 a 45 s entre cada); sem telemóvel, mas
 * com email, por email de geral@; sem nenhum dos dois, não se envia.
 *
 * DESLIGADO POR OMISSÃO (o interruptor «Lembretes do que falta», nas Configs).
 *
 * PURO: quem entra, o calendário, os textos e a leitura do «2». A base, a
 * rotina e a fila estão em `lembrete-do-que-falta-na-base.ts`.
 */

import { diaEmLisboa, instanteDaBase, pecasEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import {
  arrumarAsFaltas,
  cumprimentoPelaHora,
  linhaDaFalta,
  listaPorExtenso,
  oPedidoEmPalavras,
  rotuloDaFalta,
  type ChaveDaFalta,
  type PedidoDaMensagem,
} from "./mensagem-do-que-falta";
import { pedidoFechado } from "./pedido-arrumado";
import { lerRespostaAoLembrete } from "./validade-do-orcamento";

/** O nome do interruptor, como aparece nas Configs. */
export const NOME_DO_INTERRUPTOR_DO_QUE_FALTA = "Lembretes do que falta";

/** A hora dos lembretes, em Lisboa. */
export const HORA_DOS_LEMBRETES = 10;
/** Quantos lembretes, no máximo. */
export const LEMBRETES_NO_MAXIMO = 3;
/** Dias entre cada passo: dia 1, dia 3, dia 5 e o arquivo no dia 7. */
export const DIAS_ENTRE_PASSOS = 2;
/** Um pedido só entra com mais de 12 h: não se pisa a Vitória a meio da conversa. */
export const HORAS_ANTES_DE_ENTRAR = 12;
/** A equipa carregou em «Pedir o que falta», ou o cliente escreveu, há menos disto: fica de fora. */
export const HORAS_DE_SOSSEGO = 24;

export type PassoDoQueFalta = "lembrete1" | "lembrete2" | "lembrete3" | "arquivar";
export type CanalDoLembrete = "whatsapp" | "email";

/** A frase do fim de cada lembrete. É também por ela que se reconhece o lembrete na conversa. */
export const SE_JA_NAO_PRECISAR = "Se já não precisar do orçamento, responda 2 e cancelamos o pedido.";

/** É a hora dos lembretes (10h de Lisboa)? O cron corre em UTC, às 9h e às 10h: só uma das duas é a das 10h em Lisboa. */
export function eAHoraDosLembretes(agora: Date): boolean {
  return pecasEmLisboa(agora).hora === HORA_DOS_LEMBRETES;
}

/* ── Quem entra ──────────────────────────────────────────────────────────── */

export type MotivoDeFora =
  | "fechado"
  | "ja_foi_enviado"
  | "completo"
  | "recente"
  | "de_teste"
  | "sem_contacto"
  | "equipa_pediu"
  | "cliente_escreveu"
  | "com_uma_pessoa"
  | "ja_teve_ciclo";

export const MOTIVOS_DE_FORA: Record<MotivoDeFora, string> = {
  fechado: "arquivado, cancelado ou concluído",
  ja_foi_enviado: "já foi aos parceiros (ou é um Trabalho CLYON)",
  completo: "o pedido está completo",
  recente: `criado há menos de ${HORAS_ANTES_DE_ENTRAR} h`,
  de_teste: "conta de teste",
  sem_contacto: "sem telemóvel nem email",
  equipa_pediu: `a equipa pediu o que falta há menos de ${HORAS_DE_SOSSEGO} h`,
  cliente_escreveu: `o cliente escreveu há menos de ${HORAS_DE_SOSSEGO} h`,
  com_uma_pessoa: "a conversa está com uma pessoa da equipa",
  ja_teve_ciclo: "já teve o seu ciclo de lembretes (um por pedido)",
};

/** O pedido, como a rotina o vê. */
export type CandidatoAoLembrete = {
  id: number;
  status: string | null;
  /** Já tem negociações, ou proposta enviada, ou é um Trabalho CLYON: já foi a alguém. */
  jaFoiEnviado: boolean;
  criadoEm: Date | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  faltas: readonly ChaveDaFalta[];
  /** O último «Pedir o que falta» da equipa (do histórico do pedido). */
  equipaPediuEm: Date | null;
  /** A última mensagem do cliente no WhatsApp. */
  clienteEscreveuEm: Date | null;
  /** A conversa do WhatsApp está entregue a uma pessoa. */
  comUmaPessoa: boolean;
  /** Já tem uma linha de ciclo (seja qual for o estado). */
  jaTeveCiclo: boolean;
};

/** Um nome ou email com «teste»/«test» como palavra é de teste (o critério do resto do site). */
const PARECE_DE_TESTE = /(^|[^\p{L}])tes?te([^\p{L}]|$)/iu;

export function eDeTeste(nome: string | null | undefined, email: string | null | undefined, emailsDeTeste: ReadonlySet<string> = new Set()): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (e && emailsDeTeste.has(e)) return true;
  if (e && PARECE_DE_TESTE.test(e.split("@")[0] ?? "")) return true;
  return PARECE_DE_TESTE.test(nome ?? "");
}

/** Um telemóvel português, como o aviso aos profissionais o lê: «3519XXXXXXXX», ou null. */
export function telemovelPortugues(telefone: string | null | undefined): string | null {
  if (typeof telefone !== "string") return null;
  const d = telefone.replace(/\D/g, "");
  if (/^9\d{8}$/.test(d)) return `351${d}`;
  if (/^3519\d{8}$/.test(d)) return d;
  if (/^003519\d{8}$/.test(d)) return d.slice(2);
  return null;
}

export function emailValido(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

/** Por onde vai: o WhatsApp, se houver telemóvel; senão o email; senão, nada. */
export function canalDoLembrete(p: { contactPhone: string | null; contactEmail: string | null }): CanalDoLembrete | null {
  if (telemovelPortugues(p.contactPhone)) return "whatsapp";
  if (emailValido(p.contactEmail)) return "email";
  return null;
}

const horasDesde = (d: Date | null, agora: Date) => (d ? (agora.getTime() - d.getTime()) / 3_600_000 : Number.POSITIVE_INFINITY);

/**
 * PORQUE FICA DE FORA — ou null (entra). Pura. Pela ordem: um ciclo por
 * pedido; fechado; já enviado; completo; recente; de teste; sem contacto; a
 * equipa pediu ou o cliente escreveu há menos de 24 h; a conversa com uma pessoa.
 */
export function porqueFicaDeFora(c: CandidatoAoLembrete, agora: Date, emailsDeTeste: ReadonlySet<string> = new Set()): MotivoDeFora | null {
  if (c.jaTeveCiclo) return "ja_teve_ciclo";
  if (pedidoFechado(c.status)) return "fechado";
  if (c.jaFoiEnviado) return "ja_foi_enviado";
  if (arrumarAsFaltas(c.faltas).length === 0) return "completo";
  if (!c.criadoEm || horasDesde(c.criadoEm, agora) < HORAS_ANTES_DE_ENTRAR) return "recente";
  if (eDeTeste(c.contactName, c.contactEmail, emailsDeTeste)) return "de_teste";
  if (!canalDoLembrete(c)) return "sem_contacto";
  if (horasDesde(c.equipaPediuEm, agora) < HORAS_DE_SOSSEGO) return "equipa_pediu";
  if (horasDesde(c.clienteEscreveuEm, agora) < HORAS_DE_SOSSEGO) return "cliente_escreveu";
  if (c.comUmaPessoa) return "com_uma_pessoa";
  return null;
}

/**
 * O ÚLTIMO «PEDIR O QUE FALTA» DA EQUIPA, lido do histórico do pedido — as
 * frases de `registoDoQueFalta` (mensagem-do-que-falta.ts). Os lembretes
 * automáticos escrevem outra frase, e não contam. Pura.
 */
export function ultimoPedirOQueFalta(historyJson: string | null | undefined): Date | null {
  if (typeof historyJson !== "string" || !historyJson.trim()) return null;
  let lista: unknown;
  try {
    lista = JSON.parse(historyJson);
  } catch {
    return null;
  }
  if (!Array.isArray(lista)) return null;
  let ultimo: Date | null = null;
  for (const e of lista) {
    const msg = typeof e?.message === "string" ? e.message : "";
    if (!/pediu ao cliente, por (?:WhatsApp|email), as informações em falta|copiou a mensagem que pede ao cliente as informações em falta/.test(msg)) continue;
    const em = instanteDaBase(typeof e?.createdAt === "string" ? e.createdAt : null);
    if (em && (!ultimo || em.getTime() > ultimo.getTime())) ultimo = em;
  }
  return ultimo;
}

/* ── O calendário ────────────────────────────────────────────────────────── */

/** O ciclo de um pedido. Datas como instantes. */
export type CicloDoQueFalta = {
  lembrete1Em?: Date | null;
  lembrete2Em?: Date | null;
  lembrete3Em?: Date | null;
  arquivadoEm?: Date | null;
  canceladoEm?: Date | null;
  paradoEm?: Date | null;
  paradoPorque?: string | null;
};

export function cicloTerminado(c: CicloDoQueFalta): boolean {
  return Boolean(c.arquivadoEm || c.canceladoEm || c.paradoEm);
}

/** Quantos lembretes já saíram (0 a 3). */
export function lembretesEnviados(c: CicloDoQueFalta): number {
  return [c.lembrete1Em, c.lembrete2Em, c.lembrete3Em].filter((d) => d instanceof Date).length;
}

/** O dia (Lisboa) em que toca o próximo passo, contado do último que saiu — ou null sem nenhum. */
export function diaDoProximoPasso(c: CicloDoQueFalta): string | null {
  const ultimo = c.lembrete3Em ?? c.lembrete2Em ?? c.lembrete1Em ?? null;
  return ultimo ? somarDiasAoDia(diaEmLisboa(ultimo), DIAS_ENTRE_PASSOS) : null;
}

/**
 * O PASSO QUE TOCA HOJE — ou null. Pura. O primeiro lembrete no primeiro dia
 * (dia 1); o 2.º dois dias depois do 1.º (dia 3); o 3.º dois dias depois do 2.º
 * (dia 5); o arquivo dois dias depois do 3.º (dia 7). Um passo atrasado (a
 * rotina não correu) empurra os seguintes: nunca dois no mesmo dia.
 */
export function proximoPassoDoQueFalta(c: CicloDoQueFalta, agora: Date): PassoDoQueFalta | null {
  if (cicloTerminado(c)) return null;
  if (!c.lembrete1Em) return "lembrete1";
  const dia = diaDoProximoPasso(c);
  if (!dia || diaEmLisboa(agora) < dia) return null;
  if (!c.lembrete2Em) return "lembrete2";
  if (!c.lembrete3Em) return "lembrete3";
  return "arquivar";
}

/**
 * PORQUE PÁRA UM CICLO A CORRER — ou null. Pura. O pedido saiu dos «Orçamentos
 * novos» (fechado, ou foi aos parceiros), ficou completo, o cliente respondeu
 * depois do 1.º lembrete, ou a equipa pediu o que falta à mão.
 */
export function porqueParaOCiclo(
  c: CicloDoQueFalta,
  p: Pick<CandidatoAoLembrete, "status" | "jaFoiEnviado" | "faltas" | "clienteEscreveuEm" | "equipaPediuEm">,
): string | null {
  if (cicloTerminado(c)) return null;
  if (pedidoFechado(p.status)) return "o pedido foi fechado";
  if (p.jaFoiEnviado) return "o pedido foi aos parceiros";
  if (arrumarAsFaltas(p.faltas).length === 0) return "o pedido ficou completo";
  const desde = c.lembrete1Em?.getTime();
  if (desde != null && p.clienteEscreveuEm && p.clienteEscreveuEm.getTime() > desde) return "o cliente respondeu";
  if (desde != null && p.equipaPediuEm && p.equipaPediuEm.getTime() > desde) return "a equipa pediu o que falta à mão";
  return null;
}

/* ── Os textos ───────────────────────────────────────────────────────────── */

/**
 * A voz e as faltas de `mensagem-do-que-falta.ts` (d31): uma pessoa a escrever,
 * sem emojis, reticências, travessões nem aspas tipográficas, sem preços. Ao
 * cliente diz-se «parceiros». O 2.º e o 3.º são mais curtos; o 3.º diz que é o
 * último aviso.
 */
function oPedido(p: PedidoDaMensagem): string {
  const em = oPedidoEmPalavras(p);
  return `#${p.id}${em ? ` (${em})` : ""}`;
}

function faltasPorExtenso(p: PedidoDaMensagem, faltas: readonly ChaveDaFalta[]): string {
  return listaPorExtenso(arrumarAsFaltas(faltas).map((c) => rotuloDaFalta(c, p.serviceType)));
}

/** Dia 1 — o primeiro lembrete, com a lista inteira do que falta. Sem faltas, "". */
export function textoDoLembrete1(p: PedidoDaMensagem, faltas: readonly ChaveDaFalta[], quando: Date): string {
  const lista = arrumarAsFaltas(faltas);
  if (lista.length === 0) return "";
  const falta = lista.length === 1 ? "porque falta uma informação:" : "porque faltam algumas informações:";
  return [
    `${cumprimentoPelaHora(quando)}! Aqui é a equipa da CLYON.`,
    `O seu pedido ${oPedido(p)} ainda não seguiu para os parceiros da sua zona, ${falta}`,
    lista.map((c) => `- ${linhaDaFalta(c, p.serviceType)}`).join("\n"),
    "Pode responder a esta mensagem com o que falta, e o pedido segue para os parceiros lhe enviarem orçamento.",
    SE_JA_NAO_PRECISAR,
    "Obrigado,\nEquipa CLYON",
  ].join("\n\n");
}

/** Dia 3 — o segundo, mais curto. Sem faltas, "". */
export function textoDoLembrete2(p: PedidoDaMensagem, faltas: readonly ChaveDaFalta[], quando: Date): string {
  const oQue = faltasPorExtenso(p, faltas);
  if (!oQue) return "";
  return [
    `${cumprimentoPelaHora(quando)}! Aqui é a equipa da CLYON. O seu pedido ${oPedido(p)} continua à espera para seguir para os parceiros. Ainda falta: ${oQue}. Basta responder a esta mensagem.`,
    SE_JA_NAO_PRECISAR,
    "Equipa CLYON",
  ].join("\n\n");
}

/** Dia 5 — o terceiro e último aviso. Sem faltas, "". */
export function textoDoLembrete3(p: PedidoDaMensagem, faltas: readonly ChaveDaFalta[], quando: Date): string {
  const oQue = faltasPorExtenso(p, faltas);
  if (!oQue) return "";
  return [
    `${cumprimentoPelaHora(quando)}! Aqui é a equipa da CLYON, com o último aviso sobre o seu pedido ${oPedido(p)}. Para o pedido seguir para os parceiros, ainda falta: ${oQue}. Sem resposta, o pedido fica arquivado daqui a dois dias.`,
    SE_JA_NAO_PRECISAR,
    "Equipa CLYON",
  ].join("\n\n");
}

/** Dia 7 — o pedido foi arquivado sem resposta: pode voltar a pedir quando quiser. */
export function textoDoArquivo(p: PedidoDaMensagem, quando: Date): string {
  return [
    `${cumprimentoPelaHora(quando)}! Como não tivemos resposta, arquivámos o seu pedido ${oPedido(p)}. Pode voltar a pedir quando quiser, pela plataforma clyon.pt ou por aqui, e teremos todo o gosto em ajudar.`,
    "Equipa CLYON",
  ].join("\n\n");
}

/** O texto de cada passo. */
export function textoDoPasso(passo: PassoDoQueFalta, p: PedidoDaMensagem, faltas: readonly ChaveDaFalta[], quando: Date): string {
  if (passo === "lembrete1") return textoDoLembrete1(p, faltas, quando);
  if (passo === "lembrete2") return textoDoLembrete2(p, faltas, quando);
  if (passo === "lembrete3") return textoDoLembrete3(p, faltas, quando);
  return textoDoArquivo(p, quando);
}

/** O assunto do email (sem travessões). */
export function assuntoDoLembrete(passo: PassoDoQueFalta, pedidoId: number): string {
  if (passo === "arquivar") return `Pedido #${pedidoId} arquivado`;
  if (passo === "lembrete3") return `Pedido #${pedidoId}: último aviso, informações em falta`;
  return `Pedido #${pedidoId}: informações em falta`;
}

/* ── A resposta: o «2» cancela, o resto segue a conversa ────────────────── */

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/[!.,;:…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O CLIENTE QUER CANCELAR? Pura. Só o que é claro: o «2» (ou «opção 2»), ou
 * «cancelar», «já não preciso», «desisto», «já resolvi» e semelhantes — as
 * frases do lembrete do orçamento (`lerRespostaAoLembrete`, d62/d63). Outro
 * número, uma pergunta, um «mas», fotografias ou dados: não cancela.
 */
export function querCancelarPeloLembrete(texto: string | null | undefined): boolean {
  const cru = texto ?? "";
  const t = normalizar(cru);
  if (!t) return false;
  const numero = /^(?:opcao|op|numero|n)?\s*(\d+)$/.exec(t)?.[1];
  if (numero != null) return numero === "2";
  if (/\?/.test(cru)) return false;
  return lerRespostaAoLembrete(cru) === "cancelar";
}

/**
 * A ÚLTIMA MENSAGEM QUE SAIU PARA ESTE TELEFONE é um lembrete do que falta
 * DESTE pedido? Só então o «2» responde a ele. Outra mensagem pelo meio (da
 * Vitória ou da equipa), ou o lembrete de outro pedido, e não é. O registo das
 * saídas fica em português. Pura.
 */
export function eLembreteDoQueFalta(texto: string | null | undefined, pedidoId: number): boolean {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return false;
  const t = (texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!new RegExp(`#${pedidoId}(?!\\d)`).test(t)) return false;
  return t.includes("responda 2 e cancelamos o pedido");
}

/* ── A linha da Mesa ─────────────────────────────────────────────────────── */

const ddmm = (d: Date) => {
  const dia = diaEmLisboa(d);
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
};
const ddmmDoDia = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/**
 * O ESTADO NO CARTÃO DO PEDIDO — «Lembrete 1/3 enviado a 19/11 · o 2.º a 21/11
 * às 10h», «Cancelado pelo cliente (respondeu 2)», «Arquivado sem resposta».
 * Com o interruptor desligado, os passos por dar dizem «sairia»/«arquivaria».
 * Sem ciclo, null. Pura.
 */
export function linhaDoLembreteNaMesa(c: CicloDoQueFalta | null | undefined, ligado: boolean): string | null {
  if (!c) return null;
  if (c.canceladoEm) return `Cancelado pelo cliente (respondeu 2) a ${ddmm(c.canceladoEm)}`;
  if (c.arquivadoEm) return `Arquivado sem resposta a ${ddmm(c.arquivadoEm)}`;
  const n = lembretesEnviados(c);
  const ultimo = c.lembrete3Em ?? c.lembrete2Em ?? c.lembrete1Em ?? null;
  if (c.paradoEm) {
    const antes = n > 0 && ultimo ? `Lembrete ${n}/${LEMBRETES_NO_MAXIMO} enviado a ${ddmm(ultimo)} · ` : "";
    return `${antes}lembretes parados a ${ddmm(c.paradoEm)}${c.paradoPorque ? `: ${c.paradoPorque}` : ""}`;
  }
  if (n === 0 || !ultimo) return ligado ? "Lembrete 1/3 na fila" : null;
  const dia = diaDoProximoPasso(c);
  const seguinte = !dia
    ? ""
    : n < LEMBRETES_NO_MAXIMO
      ? ` · o ${n + 1}.º ${ligado ? "a" : "sairia a"} ${ddmmDoDia(dia)} às ${HORA_DOS_LEMBRETES}h`
      : ` · ${ligado ? "arquiva" : "arquivaria"} a ${ddmmDoDia(dia)} às ${HORA_DOS_LEMBRETES}h sem resposta`;
  return `Lembrete ${n}/${LEMBRETES_NO_MAXIMO} enviado a ${ddmm(ultimo)}${seguinte}`;
}

/** Um exemplo inventado, para as Configs mostrarem os textos tal como saem. */
export const PEDIDO_DE_EXEMPLO: PedidoDaMensagem = { id: 1234, serviceType: "recolha_monos", city: "Almada" };
export const FALTAS_DE_EXEMPLO: ChaveDaFalta[] = ["fotografias", "andar", "elevador"];
