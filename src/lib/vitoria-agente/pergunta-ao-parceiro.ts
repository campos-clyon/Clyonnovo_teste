/**
 * A PERGUNTA AO PARCEIRO, DE IDA E VOLTA — d97 (23-11-2026). PURO.
 *
 * Na d92 a pergunta ao parceiro (o cliente escolhe COM uma condição: «até
 * quinta», «só de manhã») não saía: passava à equipa com a mensagem pronta no
 * motivo, e o pedido ficava no «Precisa de si». Agora:
 *
 *  1. a pergunta SAI sozinha, pelo canal dos avisos ao profissional (o
 *     WhatsApp dos avisos, que ele ligou e o «parar» desliga, e o aviso na
 *     app Pro), e fica registada (tabela `vitoriaPerguntasAoParceiro`, uma por
 *     pedido + proposta + condição — idempotente);
 *  2. a RESPOSTA VOLTA: no WhatsApp (reconhecida por a última mensagem que lhe
 *     saiu ser a pergunta desse pedido) ou no painel; o código lê SIM / NÃO /
 *     uma data-hora (`lerARespostaDoParceiro`), e o Claude escreve ao cliente o
 *     resultado — com o sim, a pergunta do fecho («… Responda SIM.»); com o
 *     não, a alternativa. Resposta ambígua → uma pessoa da equipa;
 *  3. sem resposta em 2 h (contadas das 8h às 21h de Lisboa; fora disso,
 *     a partir das 8h) → uma pessoa da equipa, com o motivo no cartão.
 *
 * Aqui: as leituras e os textos (sem base). A orquestra da resposta
 * (`tratarARespostaDoParceiro`) recebe o mundo de fora — nos testes, fingido.
 */

import { createHash } from "node:crypto";
import { pecasEmLisboa, instanteEmLisboa, diaEmLisboa, somarDiasAoDia, horaEmLisboa } from "../hora-de-lisboa";
import type { ResultadoDoAgente } from "./cliente";
import type { FechoProposto } from "./propostas-do-agente";
import { motivoParaNaoFecharPeloAgente, perguntaDoFecho, type PedidoParaOFecho, type PropostaComOValorDoParceiro } from "./propostas-do-agente";
import type { PerguntaAoParceiro } from "./pendentes";

/** O prazo da resposta do parceiro: 2 h, contadas só dentro do horário. */
export const MINUTOS_PARA_O_PARCEIRO_RESPONDER = 120;
export const HORA_QUE_ABRE = 8;
export const HORA_QUE_FECHA = 21;

const dois = (n: number) => String(n).padStart(2, "0");
const emLisboa = (dia: string, hora: number, minuto = 0) => instanteEmLisboa(`${dia}T${dois(hora)}:${dois(minuto)}`) as Date;

/**
 * ATÉ QUANDO O PARCEIRO TEM PARA RESPONDER. As 2 h contam das 8h às 21h de
 * Lisboa: perguntado às 20h30, acaba às 9h30 do dia seguinte; perguntado às
 * 23h ou às 6h, às 10h (conta a partir das 8h).
 */
export function prazoDaPergunta(perguntadoEm: Date, minutos = MINUTOS_PARA_O_PARCEIRO_RESPONDER): Date {
  let dia = diaEmLisboa(perguntadoEm);
  const p = pecasEmLisboa(perguntadoEm);
  let inicio = perguntadoEm;
  if (p.hora < HORA_QUE_ABRE) inicio = emLisboa(dia, HORA_QUE_ABRE);
  else if (p.hora >= HORA_QUE_FECHA) {
    dia = somarDiasAoDia(dia, 1);
    inicio = emLisboa(dia, HORA_QUE_ABRE);
  }
  let falta = minutos * 60_000;
  for (let i = 0; i < 30; i += 1) {
    const fecha = emLisboa(dia, HORA_QUE_FECHA);
    const cabe = fecha.getTime() - inicio.getTime();
    if (falta <= cabe) return new Date(inicio.getTime() + falta);
    falta -= Math.max(0, cabe);
    dia = somarDiasAoDia(dia, 1);
    inicio = emLisboa(dia, HORA_QUE_ABRE);
  }
  return new Date(perguntadoEm.getTime() + minutos * 60_000);
}

const normal = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[!.,;:)(👍🙏😊🙂✅]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const DIAS = "segunda|terca|quarta|quinta|sexta|sabado|domingo";
/** As peças de uma data-hora, pela ordem em que aparecem: «quinta», «dia 26», «26/11», «às 15h», «de manhã». */
const PECA_DE_QUANDO = new RegExp(
  [
    `\\b(?:${DIAS})(?:-feira)?\\b`,
    "\\bamanha\\b",
    "\\bdepois de amanha\\b",
    "\\bhoje\\b",
    "\\bdia \\d{1,2}(?: de [a-z]+)?\\b",
    "\\b\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?\\b",
    "\\b(?:as |pelas |a partir das |ate as )?\\d{1,2}(?::\\d{2}| ?h(?:\\d{2})?)\\b",
    "\\bas \\d{1,2}\\b",
    "\\b(?:de|da|pela|a|ao) (?:manha|tarde|noite)\\b",
  ].join("|"),
  "g",
);

/** A DATA-HORA QUE O PARCEIRO DISSE, em palavras simples, ou null. */
export function quandoNaResposta(texto: string | null | undefined): string | null {
  const t = normal(String(texto ?? ""));
  const pecas = t.match(PECA_DE_QUANDO);
  if (!pecas || pecas.length === 0) return null;
  const vistas: string[] = [];
  for (const p of pecas) if (!vistas.includes(p)) vistas.push(p);
  return vistas
    .join(" ")
    .replace(/\bterca\b/g, "terça")
    .replace(/\bsabado\b/g, "sábado")
    .replace(/\bas (\d)/g, "às $1")
    .replace(/\bamanha\b/g, "amanhã")
    .replace(/\bmanha\b/g, "manhã")
    .slice(0, 80);
}

export type LeituraDoParceiro = { tipo: "sim"; quando: string | null } | { tipo: "nao" } | { tipo: "ambigua" };

const SIM = /^(?:sim|s|ok|okay|claro|consigo|confirmo|pode ser|combinado|da|dá|perfeito|certo|sim consigo|sim pode ser|sim claro|yes)\b/;
const NAO = /^(?:nao|n|no|impossivel|infelizmente nao|lamento|desculpe nao)\b|\bnao (?:consigo|da|posso|vai dar|e possivel)\b/;
/** O que torna um sim condicional («sim, mas só sexta») ou uma pergunta: não se adivinha, vai à equipa. */
const MAS = /\b(mas|so|apenas|depende|talvez|se calhar|nao sei|vou ver|ver se|preciso|primeiro|antes|pode ser que|acho)\b/;

/**
 * A RESPOSTA DO PARCEIRO, LIDA PELO CÓDIGO. «Sim», «sim, quinta às 15h»,
 * «consigo» → sim (com a data-hora, se a disse); «não», «não consigo» → não;
 * só uma data-hora («quinta às 15h») → sim nessa data; o resto («sim, mas só
 * sexta», «quanto é?», «vou ver») → ambígua, e vai a uma pessoa.
 */
export function lerARespostaDoParceiro(texto: string | null | undefined): LeituraDoParceiro {
  const cru = String(texto ?? "");
  const t = normal(cru);
  if (!t || t.length > 160 || /\?/.test(cru)) return { tipo: "ambigua" };
  const sim = SIM.test(t);
  const nao = NAO.test(t);
  if (sim && nao) return { tipo: "ambigua" };
  // «Não consigo quinta, só sexta» é uma contraproposta: vai a uma pessoa.
  if (nao) return /\b(so|mas|apenas|depende|talvez)\b/.test(t) ? { tipo: "ambigua" } : { tipo: "nao" };
  const quando = quandoNaResposta(t);
  if (sim) return MAS.test(t) ? { tipo: "ambigua" } : { tipo: "sim", quando };
  // Só uma data-hora, curta e sem condições: é um sim nessa data.
  if (quando && !MAS.test(t) && t.replace(PECA_DE_QUANDO, "").replace(/\b(?:e|pode|posso|vou|ir|la|na|no|ou)\b/g, "").trim().length <= 3) {
    return { tipo: "sim", quando };
  }
  return { tipo: "ambigua" };
}

/** A chave da pergunta: o pedido, a proposta e a condição (sem acentos nem espaços a mais) — a mesma pergunta só sai uma vez. */
export function chaveDaPergunta(p: Pick<PerguntaAoParceiro, "pedidoId" | "negociacaoId" | "condicao">): string {
  const cond = normal(p.condicao);
  return `${p.pedidoId}:${p.negociacaoId}:${createHash("sha256").update(cond).digest("hex").slice(0, 24)}`;
}

/** A pergunta ao parceiro reconhece-se pelo texto (o da d92, `mensagemAoParceiro`): o número do pedido, ou null. */
export function pedidoDaPergunta(texto: string | null | undefined): number | null {
  const t = String(texto ?? "");
  if (!/quer escolher a sua proposta/i.test(t) || !/Responda SIM ou NÃO/i.test(t)) return null;
  const m = t.match(/pedido #(\d{1,9})/);
  return m ? Number(m[1]) : null;
}

/* ── Os textos ──────────────────────────────────────────────────────────── */

/** O aviso na app Pro (o mesmo que vai no WhatsApp, mais curto). */
export function avisoDaPerguntaNaApp(p: Pick<PerguntaAoParceiro, "pedidoId" | "condicao">): { titulo: string; corpo: string } {
  return {
    titulo: `Pergunta do cliente — pedido #${p.pedidoId}`,
    corpo: `O cliente quer escolher a sua proposta, se conseguir: «${p.condicao}». Responda SIM ou NÃO no WhatsApp da CLYON ou no seu painel.`,
  };
}

/** O obrigado ao parceiro depois de responder no WhatsApp. */
export function obrigadoAoParceiro(pedidoId: number, leitura: LeituraDoParceiro): string {
  return leitura.tipo === "ambigua"
    ? `Obrigada! Passo a sua resposta sobre o pedido #${pedidoId} a uma pessoa da equipa da CLYON, que a confirma com o cliente.`
    : `Obrigada! Já passei a sua resposta ao cliente do pedido #${pedidoId}.`;
}

/** O motivo no cartão «Precisa de si» quando o parceiro não responde a tempo. */
export function motivoDoPrazo(p: Pick<PerguntaAoParceiro, "pedidoId" | "parceiro" | "condicao">): string {
  return `À espera do parceiro há 2 h — pedido #${p.pedidoId}: ${p.parceiro} não respondeu se consegue «${p.condicao}». Responder ao cliente`;
}

/** O motivo quando a resposta do parceiro não se lê sozinha. */
export function motivoDaRespostaAmbigua(p: Pick<PerguntaAoParceiro, "pedidoId" | "parceiro" | "condicao">, texto: string): string {
  return `Pedido #${p.pedidoId}: ${p.parceiro} respondeu «${texto.replace(/\s+/g, " ").trim().slice(0, 160)}» à pergunta «${p.condicao}» — ler e responder ao cliente`;
}

/** A linha do histórico do pedido quando o parceiro responde. */
export function linhaDoHistorico(p: Pick<PerguntaAoParceiro, "parceiro" | "condicao">, leitura: LeituraDoParceiro, origem: "whatsapp" | "painel"): string {
  const r = leitura.tipo === "sim" ? `SIM${leitura.quando ? ` (${leitura.quando})` : ""}` : leitura.tipo === "nao" ? "NÃO" : "uma resposta que não se lê sozinha";
  return `${p.parceiro} respondeu ${r} à pergunta da Vitória «${p.condicao}» (${origem === "painel" ? "no painel" : "no WhatsApp"}).`;
}

/** O que o modelo lê sobre a resposta do parceiro (vai na mensagem do turno, nunca no aviso fixo). */
export function notaParaOAgente(p: PerguntaAoParceiro, leitura: LeituraDoParceiro): string {
  const cab = `O parceiro ${p.parceiro} respondeu à pergunta do pedido #${p.pedidoId} («${p.condicao}»)`;
  if (leitura.tipo === "sim") {
    return (
      `${cab}: SIM${leitura.quando ? `, ${leitura.quando}` : ""}. Escreve ao cliente a dizer que o parceiro confirma` +
      `${leitura.quando ? " (e quando)" : ""} e chama aceitar_proposta (pedido ${p.pedidoId}, escolha «${p.parceiro}») para a pergunta do SIM ir na resposta, tal e qual.`
    );
  }
  return (
    `${cab}: NÃO consegue. Diz-lhe com delicadeza e oferece a alternativa: as outras propostas do pedido (lê propostas_vivas), ` +
    `ou manter esta proposta sem a condição. Não proponhas o fecho sem o cliente escolher.`
  );
}

/** A resposta ao cliente sem o modelo (o Claude falhou, ou não está ligado), com o sim: o resultado e a pergunta do fecho. */
export function aoClienteComOSim(p: PerguntaAoParceiro, quando: string | null, fraseDoFecho: string): string {
  return `Boa notícia: ${p.parceiro} confirma que consegue «${p.condicao}»${quando ? ` (${quando})` : ""}. ${fraseDoFecho}`;
}

/** …e com o não: diz-se, e oferece-se a alternativa. */
export function aoClienteComONao(p: PerguntaAoParceiro, outras: number): string {
  const alternativa =
    outras > 0
      ? `Tem ainda ${outras === 1 ? "outra proposta" : `${outras} outras propostas`} no pedido #${p.pedidoId} — quer que lhe diga qual é a melhor para si, ou prefere manter a de ${p.parceiro} sem essa condição?`
      : `Prefere manter a proposta de ${p.parceiro} sem essa condição, ou que uma pessoa da equipa veja outra solução consigo?`;
  return `Já falei com ${p.parceiro}: infelizmente não consegue «${p.condicao}». ${alternativa}`;
}

/* ── A orquestra da resposta ────────────────────────────────────────────── */

export type PerguntaRegistada = PerguntaAoParceiro & { id: number; telefoneCliente: string };

export type DependenciasDaResposta = {
  agora: Date;
  /** Marca a pergunta como respondida. false = já estava (ou expirou): não se faz nada outra vez. */
  marcarRespondida: (leitura: LeituraDoParceiro, texto: string) => Promise<boolean>;
  historico: (linha: string) => Promise<void>;
  /** Uma pessoa da equipa já tem a conversa do cliente? Então não se lhe escreve: fica no motivo. */
  clienteInterrompido: () => Promise<boolean>;
  propostas: () => Promise<PropostaComOValorDoParceiro[]>;
  pedidoParaOFecho: () => Promise<PedidoParaOFecho>;
  /** O Claude, com a nota do que o parceiro respondeu. null = não está disponível. */
  correrOAgente: (nota: string) => Promise<ResultadoDoAgente | null>;
  enviarAoCliente: (texto: string) => Promise<boolean>;
  gravarPendente: (f: FechoProposto) => Promise<void>;
  passarAEquipa: (motivo: string, mensagem: string | null) => Promise<void>;
  registar: (l: { texto: string | null; motivo: string | null; teriaFeito: string[]; resultado?: ResultadoDoAgente | null }) => Promise<void>;
};

export type DesfechoDaResposta = "ja_respondida" | "equipa" | "sim" | "nao";

/**
 * A RESPOSTA DO PARCEIRO CHEGOU (WhatsApp ou painel): lê-a, regista-a e
 * responde ao cliente. Nunca lança para fora do que as dependências lançarem.
 */
export async function tratarARespostaDoParceiro(
  p: PerguntaRegistada,
  texto: string,
  deps: DependenciasDaResposta,
  origem: "whatsapp" | "painel",
): Promise<DesfechoDaResposta> {
  const leitura = lerARespostaDoParceiro(texto);
  if (!(await deps.marcarRespondida(leitura, texto))) return "ja_respondida";
  await deps.historico(linhaDoHistorico(p, leitura, origem)).catch(() => {});
  const doParceiro = `o parceiro respondeu: ${leitura.tipo === "sim" ? `sim${leitura.quando ? ` (${leitura.quando})` : ""}` : leitura.tipo === "nao" ? "não" : "ambígua"} — #${p.pedidoId}, ${p.parceiro}`;

  const paraAEquipa = async (motivo: string) => {
    await deps.passarAEquipa(motivo, null);
    await deps.registar({ texto: null, motivo, teriaFeito: [doParceiro, `passou à equipa: ${motivo}`] });
    return "equipa" as const;
  };

  if (leitura.tipo === "ambigua") return paraAEquipa(motivoDaRespostaAmbigua(p, texto));
  if (await deps.clienteInterrompido()) {
    return paraAEquipa(`Pedido #${p.pedidoId}: ${linhaDoHistorico(p, leitura, origem)} Uma pessoa tem a conversa — dizer ao cliente`);
  }

  const lista = await deps.propostas();
  const prop = lista.find((x) => x.negociacaoId === p.negociacaoId);

  if (leitura.tipo === "sim") {
    if (!prop) return paraAEquipa(`Pedido #${p.pedidoId}: ${p.parceiro} disse SIM a «${p.condicao}», mas a proposta já não está disponível`);
    const travao = motivoParaNaoFecharPeloAgente(prop, await deps.pedidoParaOFecho(), deps.agora);
    if (travao) return paraAEquipa(`Pedido #${p.pedidoId}: ${p.parceiro} disse SIM a «${p.condicao}», mas ${travao}`);
    const r = await deps.correrOAgente(notaParaOAgente(p, leitura)).catch(() => null);
    if (r && r.estado === "ok" && r.texto && r.pendente?.tipo === "fecho" && r.pendente.negociacaoId === p.negociacaoId) {
      await deps.enviarAoCliente(r.texto);
      await deps.gravarPendente(r.pendente);
      await deps.registar({ texto: r.texto, motivo: null, teriaFeito: [doParceiro, ...r.teriaFeito], resultado: r });
      return "sim";
    }
    // Sem o modelo (ou sem a pergunta do SIM na resposta dele): o código escreve, com a frase do fecho.
    const frase = perguntaDoFecho(prop);
    const textoAoCliente = aoClienteComOSim(p, leitura.quando, frase);
    await deps.enviarAoCliente(textoAoCliente);
    const fecho: FechoProposto = {
      tipo: "fecho",
      pedidoId: p.pedidoId,
      negociacaoId: p.negociacaoId,
      parceiro: prop.parceiro,
      total: prop.conta.total,
      propostoEm: deps.agora.toISOString(),
    };
    await deps.gravarPendente(fecho);
    await deps.registar({
      texto: textoAoCliente,
      motivo: r ? `o Claude não trouxe a pergunta do SIM (${r.estado}): escreveu o código` : "sem o Claude: escreveu o código",
      teriaFeito: [doParceiro, `proposto o fecho do #${p.pedidoId} com ${prop.parceiro} (à espera do SIM)`],
      resultado: r,
    });
    return "sim";
  }

  // NÃO: a alternativa.
  const outras = lista.filter((x) => x.negociacaoId !== p.negociacaoId).length;
  const r = await deps.correrOAgente(notaParaOAgente(p, leitura)).catch(() => null);
  if (r && r.estado === "ok" && r.texto) {
    await deps.enviarAoCliente(r.texto);
    if (r.pendente?.tipo === "fecho") await deps.gravarPendente(r.pendente);
    await deps.registar({ texto: r.texto, motivo: null, teriaFeito: [doParceiro, ...r.teriaFeito], resultado: r });
    return "nao";
  }
  if (r && r.estado === "equipa") {
    await deps.passarAEquipa(r.motivo ?? `Pedido #${p.pedidoId}: ${p.parceiro} disse NÃO a «${p.condicao}»`, r.mensagemDeEquipa);
    await deps.registar({ texto: r.mensagemDeEquipa, motivo: r.motivo, teriaFeito: [doParceiro, ...r.teriaFeito], resultado: r });
    return "equipa";
  }
  const textoAoCliente = aoClienteComONao(p, outras);
  await deps.enviarAoCliente(textoAoCliente);
  await deps.registar({ texto: textoAoCliente, motivo: r ? `o Claude não respondeu (${r.estado}): escreveu o código` : "sem o Claude: escreveu o código", teriaFeito: [doParceiro], resultado: r });
  return "nao";
}

/** O prazo em palavras, para o histórico («até às 17h00 de hoje» / «até amanhã às 9h30»). */
export function prazoEmPalavras(prazo: Date, agora: Date): string {
  const mesmoDia = diaEmLisboa(prazo) === diaEmLisboa(agora);
  const amanha = diaEmLisboa(prazo) === somarDiasAoDia(diaEmLisboa(agora), 1);
  return `${mesmoDia ? "hoje" : amanha ? "amanhã" : diaEmLisboa(prazo)} às ${horaEmLisboa(prazo)}`;
}
