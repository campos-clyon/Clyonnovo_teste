/**
 * PEDIR O QUE FALTA, SOZINHO — d88 passo 1 (CEO e dono, 23-11-2026), sobre os
 * lembretes do que falta da d71 (19-11-2026): o mesmo ciclo, a mesma tabela e o
 * mesmo interruptor («Lembretes do que falta»), num ritmo novo.
 *
 * Todo o pedido INCOMPLETO dos «Orçamentos novos» (do simulador, do formulário,
 * do WhatsApp ou registado na Mesa), sem pessoa atribuída, recebe o «Pedir o que
 * falta» com o MESMO texto do modelo da Mesa (`mensagemDoQueFalta`), para a
 * Vitória reconhecer a resposta e a gravar no pedido (d86):
 *
 *   · a 1.ª mensagem 30 minutos depois de o pedido entrar, e nunca com o cliente
 *     a escrever há menos de 30 minutos (não se pisa a conversa a meio);
 *   · a 2.ª no dia seguinte, à mesma hora (ou às 10h, se essa hora cair fora);
 *     a 3.ª no dia a seguir a essa; no máximo 3 mensagens no total;
 *   · sem resposta, no dia a seguir à 3.ª o pedido é ARQUIVADO (nunca apagado),
 *     com a mensagem a dizer que pode voltar a pedir quando quiser;
 *   · tudo das 8h às 21h de Lisboa; o que cai fora sai às 9h
 *     (`janela-das-mensagens-automaticas.ts`); e nunca no dia em que já saiu
 *     outra mensagem automática a esse cliente (a uma-por-dia comum, d85);
 *   · a equipa que carrega à mão em «Pedir o que falta» conta como a 1.ª
 *     mensagem: o ciclo segue daí, com a 2.ª no dia seguinte;
 *   · a 2.ª e a 3.ª são o modelo mais a frase da d71 («responda 2 e cancelamos
 *     o pedido»); o «2» cancela, qualquer outra resposta pára o ciclo e segue a
 *     conversa da Vitória;
 *   · UM ciclo por pedido, nunca outro: o que já teve o da d71 não recomeça.
 *
 * Ficam de fora: os atribuídos a uma pessoa, os que a equipa pôs em «precisa
 * info» com uma pergunta escrita à mão («Pedir info»), os Trabalhos CLYON, o «Outro
 * serviço» (e os serviços fora da lista), as contas de teste, os números
 * bloqueados, as conversas com uma pessoa (d73) e os clientes noutra língua sem
 * tradução fixa da mensagem (esses passam à equipa).
 *
 * Pelo WhatsApp (a fila da ponte, 20 a 45 s entre cada); sem telemóvel, mas
 * com email, por email de geral@; sem nenhum dos dois, não se envia.
 *
 * PURO: quem entra, o calendário, os textos e a leitura do «2». A base, a
 * rotina e a fila estão em `lembrete-do-que-falta-na-base.ts`.
 */

import { diaEmLisboa, instanteDaBase, pecasEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { aHoraDoDia, diaEHoraCurtos, momentoDeSaida, naJanelaDasMensagensAutomaticas, podeSairAgora } from "./janela-das-mensagens-automaticas";
import {
  arrumarAsFaltas,
  cumprimentoPelaHora,
  mensagemDoQueFalta,
  oPedidoEmPalavras,
  type ChaveDaFalta,
  type PedidoDaMensagem,
} from "./mensagem-do-que-falta";
import { pedidoFechado } from "./pedido-arrumado";
import { lerRespostaAoLembrete } from "./validade-do-orcamento";

/** O nome do interruptor, como aparece nas Configs. */
export const NOME_DO_INTERRUPTOR_DO_QUE_FALTA = "Lembretes do que falta";

/** A 1.ª mensagem sai 30 min depois de o pedido entrar. */
export const MINUTOS_ANTES_DO_PRIMEIRO = 30;
/** O cliente escreveu há menos disto: espera-se (não se pisa a conversa a meio). */
export const MINUTOS_DE_SOSSEGO = 30;
/** Quando a hora do dia anterior cai fora da janela, a seguinte sai a esta hora. */
export const HORA_DOS_LEMBRETES = 10;
/** Quantas mensagens, no máximo (a da equipa conta como a 1.ª). */
export const LEMBRETES_NO_MAXIMO = 3;
/** Dias entre cada passo: o dia seguinte. */
export const DIAS_ENTRE_PASSOS = 1;

export type PassoDoQueFalta = "lembrete1" | "lembrete2" | "lembrete3" | "arquivar";
export type CanalDoLembrete = "whatsapp" | "email";

/** A frase do fim da 2.ª e da 3.ª mensagens. É também por ela que se reconhece o lembrete na conversa. */
export const SE_JA_NAO_PRECISAR = "Se já não precisar do orçamento, responda 2 e cancelamos o pedido.";

/** Das 8h às 21h de Lisboa: a rotina e a fila só trabalham dentro. */
export function naJanelaDosLembretes(agora: Date): boolean {
  return naJanelaDasMensagensAutomaticas(agora);
}

/* ── Quem entra ──────────────────────────────────────────────────────────── */

export type MotivoDeFora =
  | "fechado"
  | "ja_foi_enviado"
  | "completo"
  | "recente"
  | "atribuido"
  | "pedir_info"
  | "outro_servico"
  | "de_teste"
  | "sem_contacto"
  | "bloqueado"
  | "cliente_escreveu"
  | "com_uma_pessoa"
  | "noutra_lingua"
  | "ja_teve_ciclo";

export const MOTIVOS_DE_FORA: Record<MotivoDeFora, string> = {
  fechado: "arquivado, cancelado ou concluído",
  ja_foi_enviado: "já foi aos parceiros (ou é um Trabalho CLYON)",
  completo: "o pedido está completo",
  recente: `criado há menos de ${MINUTOS_ANTES_DO_PRIMEIRO} min`,
  atribuido: "atribuído a uma pessoa da equipa",
  pedir_info: "a equipa já pediu outra informação à mão («Pedir info»)",
  outro_servico: "«Outro serviço» (ou um serviço fora da lista)",
  de_teste: "conta de teste",
  sem_contacto: "sem telemóvel nem email",
  bloqueado: "número bloqueado",
  cliente_escreveu: `o cliente escreveu há menos de ${MINUTOS_DE_SOSSEGO} min`,
  com_uma_pessoa: "a conversa está com uma pessoa da equipa",
  noutra_lingua: "cliente noutra língua, sem tradução fixa da mensagem: passa à equipa",
  ja_teve_ciclo: "já teve o seu ciclo de lembretes (um por pedido)",
};

/** Os serviços que não recebem o «Pedir o que falta» sozinho: o «Outro serviço» e os que saíram da lista (25-10-2026). */
export const SERVICOS_DE_FORA: readonly string[] = ["outro", "montagem_moveis", "jardinagem"];

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
  /** O último «Pedir o que falta» da equipa (do histórico do pedido): conta como a 1.ª mensagem. */
  equipaPediuEm: Date | null;
  /** A última mensagem do cliente no WhatsApp. */
  clienteEscreveuEm: Date | null;
  /** A conversa do WhatsApp está entregue a uma pessoa, ou a equipa falou há pouco (d73). */
  comUmaPessoa: boolean;
  /** Já tem uma linha de ciclo (seja qual for o estado). */
  jaTeveCiclo: boolean;
  /** Atribuído a uma pessoa da equipa (a Mesa). */
  atribuido?: boolean;
  /** O serviço (`serviceType`). */
  servico?: string | null;
  /** O número está bloqueado no WhatsApp da plataforma. */
  bloqueado?: boolean;
  /** O cliente fala outra língua e a mensagem não tem tradução fixa (a língua, ou null). */
  linguaSemTraducao?: string | null;
  /** Em «precisa info» por um «Pedir info» escrito à mão pela equipa (não o «Pedir o que falta»). */
  pedirInfoDaEquipa?: boolean;
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

const minutosDesde = (d: Date | null, agora: Date) => (d ? (agora.getTime() - d.getTime()) / 60_000 : Number.POSITIVE_INFINITY);

/**
 * PORQUE FICA DE FORA — ou null (entra). Pura. Pela ordem: um ciclo por
 * pedido; fechado; já enviado; completo; atribuído; «Outro serviço»; recente
 * (menos de 30 min); de teste; sem contacto; bloqueado; o cliente escreveu há
 * menos de 30 min; a conversa com uma pessoa; noutra língua sem tradução.
 * A equipa ter carregado em «Pedir o que falta» NÃO deixa de fora: conta como
 * a 1.ª mensagem do ciclo.
 */
export function porqueFicaDeFora(c: CandidatoAoLembrete, agora: Date, emailsDeTeste: ReadonlySet<string> = new Set()): MotivoDeFora | null {
  if (c.jaTeveCiclo) return "ja_teve_ciclo";
  if (pedidoFechado(c.status)) return "fechado";
  if (c.jaFoiEnviado) return "ja_foi_enviado";
  if (arrumarAsFaltas(c.faltas).length === 0) return "completo";
  if (c.atribuido) return "atribuido";
  if (c.pedirInfoDaEquipa) return "pedir_info";
  if (SERVICOS_DE_FORA.includes(String(c.servico ?? "").trim())) return "outro_servico";
  if (!c.criadoEm || minutosDesde(c.criadoEm, agora) < MINUTOS_ANTES_DO_PRIMEIRO) return "recente";
  if (eDeTeste(c.contactName, c.contactEmail, emailsDeTeste)) return "de_teste";
  const canal = canalDoLembrete(c);
  if (!canal) return "sem_contacto";
  if (canal === "whatsapp" && c.bloqueado) return "bloqueado";
  if (minutosDesde(c.clienteEscreveuEm, agora) < MINUTOS_DE_SOSSEGO) return "cliente_escreveu";
  if (canal === "whatsapp" && c.comUmaPessoa) return "com_uma_pessoa";
  if (canal === "whatsapp" && c.linguaSemTraducao) return "noutra_lingua";
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
  /** A 1.ª foi o «Pedir o que falta» da equipa, à mão (d88). */
  lembrete1PelaEquipa?: boolean;
};

export function cicloTerminado(c: CicloDoQueFalta): boolean {
  return Boolean(c.arquivadoEm || c.canceladoEm || c.paradoEm);
}

/** Quantas mensagens já saíram (0 a 3). */
export function lembretesEnviados(c: CicloDoQueFalta): number {
  return [c.lembrete1Em, c.lembrete2Em, c.lembrete3Em].filter((d) => d instanceof Date).length;
}

/** A última mensagem que saiu do ciclo, ou null. */
function ultimaDoCiclo(c: CicloDoQueFalta): Date | null {
  return c.lembrete3Em ?? c.lembrete2Em ?? c.lembrete1Em ?? null;
}

/**
 * O DIA SEGUINTE À MESMA HORA — o instante a partir do qual sai o passo a
 * seguir a `ultimo`. Se essa hora cair fora das 8h–21h (a 1.ª foi a da equipa,
 * às 22h), às 10h. Pura.
 */
export function noDiaSeguinte(ultimo: Date): Date {
  const { hora, minuto } = pecasEmLisboa(ultimo);
  const dia = somarDiasAoDia(diaEmLisboa(ultimo), DIAS_ENTRE_PASSOS);
  const dentro = hora >= 8 && hora < 21;
  return dentro ? aHoraDoDia(dia, hora, minuto) : aHoraDoDia(dia, HORA_DOS_LEMBRETES);
}

/** A 1.ª pode sair a partir de: 30 min depois de o pedido entrar. */
export function devidoDoPrimeiro(criadoEm: Date | null | undefined): Date | null {
  return criadoEm instanceof Date ? new Date(criadoEm.getTime() + MINUTOS_ANTES_DO_PRIMEIRO * 60_000) : null;
}

/** O passo que toca a seguir, sem olhar ao relógio. */
function passoSeguinte(c: CicloDoQueFalta): PassoDoQueFalta | null {
  if (cicloTerminado(c)) return null;
  if (!c.lembrete1Em) return "lembrete1";
  if (!c.lembrete2Em) return "lembrete2";
  if (!c.lembrete3Em) return "lembrete3";
  return "arquivar";
}

/**
 * A PARTIR DE QUANDO SAI O PASSO SEGUINTE — ou null. Pura. A 1.ª 30 min depois
 * de o pedido entrar (`desde`; sem ele, já); cada uma das outras, e o arquivo,
 * no dia seguinte ao da anterior, à mesma hora.
 */
export function devidoDoProximoPasso(c: CicloDoQueFalta, desde?: Date | null): Date | null {
  const passo = passoSeguinte(c);
  if (!passo) return null;
  if (passo === "lembrete1") return desde ?? new Date(0);
  const ultimo = ultimaDoCiclo(c);
  return ultimo ? noDiaSeguinte(ultimo) : null;
}

/**
 * O PASSO QUE TOCA AGORA — ou null. Pura. O passo seguinte do ciclo, se já
 * passou a hora dele e estamos dentro da janela (o que ficou fora, às 9h). Um
 * passo atrasado empurra os seguintes: cada um conta-se do que saiu de facto,
 * e nunca saem dois no mesmo dia.
 */
export function proximoPassoDoQueFalta(c: CicloDoQueFalta, agora: Date, desde?: Date | null): PassoDoQueFalta | null {
  const passo = passoSeguinte(c);
  if (!passo) return null;
  const devido = devidoDoProximoPasso(c, desde);
  if (!devido || !podeSairAgora(devido, agora)) return null;
  const ultimo = ultimaDoCiclo(c);
  if (ultimo && diaEmLisboa(ultimo) === diaEmLisboa(agora)) return null;
  return passo;
}

/**
 * PORQUE PÁRA UM CICLO A CORRER — ou null. Pura. O pedido saiu dos «Orçamentos
 * novos» (fechado, ou foi aos parceiros), ficou completo, foi atribuído a uma
 * pessoa, o cliente respondeu depois da 1.ª mensagem, ou a equipa pediu o que
 * falta à mão depois dela.
 */
export function porqueParaOCiclo(
  c: CicloDoQueFalta,
  p: Pick<CandidatoAoLembrete, "status" | "jaFoiEnviado" | "faltas" | "clienteEscreveuEm" | "equipaPediuEm"> & { atribuido?: boolean },
): string | null {
  if (cicloTerminado(c)) return null;
  if (pedidoFechado(p.status)) return "o pedido foi fechado";
  if (p.jaFoiEnviado) return "o pedido foi aos parceiros";
  if (arrumarAsFaltas(p.faltas).length === 0) return "o pedido ficou completo";
  if (p.atribuido) return "o pedido foi atribuído a uma pessoa da equipa";
  const desde = c.lembrete1Em?.getTime();
  if (desde != null && p.clienteEscreveuEm && p.clienteEscreveuEm.getTime() > desde) return "o cliente respondeu";
  if (desde != null && p.equipaPediuEm && p.equipaPediuEm.getTime() > desde + 60_000) return "a equipa pediu o que falta à mão";
  return null;
}

/* ── Os textos ───────────────────────────────────────────────────────────── */

/** A assinatura do modelo — a frase da d71 entra antes dela. */
const ASSINATURA_DO_MODELO = "Obrigado,\nEquipa CLYON";

function oPedido(p: PedidoDaMensagem): string {
  const em = oPedidoEmPalavras(p);
  return `#${p.id}${em ? ` (${em})` : ""}`;
}

/** O modelo com o «responda 2» antes da assinatura. */
function comOResponda2(modelo: string): string {
  if (!modelo) return "";
  if (modelo.endsWith(ASSINATURA_DO_MODELO)) {
    return `${modelo.slice(0, -ASSINATURA_DO_MODELO.length)}${SE_JA_NAO_PRECISAR}\n\n${ASSINATURA_DO_MODELO}`;
  }
  return `${modelo}\n\n${SE_JA_NAO_PRECISAR}`;
}

/**
 * A 1.ª — o «Pedir o que falta» da Mesa, TAL E QUAL (`mensagemDoQueFalta`):
 * é por ele que a Vitória reconhece a resposta (d86). Sem faltas, "".
 */
export function textoDoLembrete1(p: PedidoDaMensagem, faltas: readonly ChaveDaFalta[], quando: Date): string {
  return mensagemDoQueFalta(p, faltas, quando);
}

/** A 2.ª, no dia seguinte — o modelo, mais o «responda 2» da d71. Sem faltas, "". */
export function textoDoLembrete2(p: PedidoDaMensagem, faltas: readonly ChaveDaFalta[], quando: Date): string {
  return comOResponda2(mensagemDoQueFalta(p, faltas, quando));
}

/** A 3.ª e última — o mesmo texto da 2.ª. Sem faltas, "". */
export function textoDoLembrete3(p: PedidoDaMensagem, faltas: readonly ChaveDaFalta[], quando: Date): string {
  return comOResponda2(mensagemDoQueFalta(p, faltas, quando));
}

/** No dia a seguir à 3.ª — o pedido foi arquivado sem resposta: pode voltar a pedir quando quiser. */
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
 * DESTE pedido, com o «responda 2»? Só então o «2» responde a ele. Outra
 * mensagem pelo meio (da Vitória ou da equipa), o lembrete de outro pedido, ou
 * a 1.ª (que não pede o «2»), e não é. O registo das saídas fica em português.
 * Pura.
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

/**
 * O ESTADO NO CARTÃO DO PEDIDO — «Mensagem 1/3 enviada a 23/11 · a 2.ª a 24/11
 * às 14h35», «Cancelado pelo cliente (respondeu 2)», «Arquivado sem resposta».
 * Com o interruptor desligado, os passos por dar dizem «sairia»/«arquivaria».
 * Sem ciclo, null. Pura.
 */
export function linhaDoLembreteNaMesa(c: CicloDoQueFalta | null | undefined, ligado: boolean, agora: Date = new Date()): string | null {
  if (!c) return null;
  if (c.canceladoEm) return `Cancelado pelo cliente (respondeu 2) a ${ddmm(c.canceladoEm)}`;
  if (c.arquivadoEm) return `Arquivado sem resposta a ${ddmm(c.arquivadoEm)}`;
  const n = lembretesEnviados(c);
  const ultimo = ultimaDoCiclo(c);
  const daEquipa = n === 1 && c.lembrete1PelaEquipa;
  const enviada = (d: Date) =>
    daEquipa ? `«Pedir o que falta» da equipa a ${ddmm(d)} (conta como a 1.ª)` : `Mensagem ${n}/${LEMBRETES_NO_MAXIMO} enviada a ${ddmm(d)}`;
  if (c.paradoEm) {
    const antes = n > 0 && ultimo ? `${enviada(ultimo)} · ` : "";
    return `${antes}mensagens paradas a ${ddmm(c.paradoEm)}${c.paradoPorque ? `: ${c.paradoPorque}` : ""}`;
  }
  if (n === 0 || !ultimo) return ligado ? "Mensagem 1/3 do que falta na fila" : "Mensagem 1/3 do que falta sairia em breve";
  const devido = devidoDoProximoPasso(c);
  const quando = devido ? diaEHoraCurtos(momentoDeSaida(devido, agora)) : null;
  const seguinte = !quando
    ? ""
    : n < LEMBRETES_NO_MAXIMO
      ? ` · a ${n + 1}.ª ${ligado ? "a" : "sairia a"} ${quando}`
      : ` · ${ligado ? "arquiva" : "arquivaria"} a ${quando} sem resposta`;
  return `${enviada(ultimo)}${seguinte}`;
}

/** Um exemplo inventado, para as Configs mostrarem os textos tal como saem. */
export const PEDIDO_DE_EXEMPLO: PedidoDaMensagem = { id: 1234, serviceType: "recolha_monos", city: "Almada" };
export const FALTAS_DE_EXEMPLO: ChaveDaFalta[] = ["fotografias", "andar", "elevador"];
