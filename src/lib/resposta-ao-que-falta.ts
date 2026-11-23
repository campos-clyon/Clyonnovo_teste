import type { CamposCrus } from "./whatsapp-compreensao";
import {
  factosSoltos,
  fundirCampos,
  juntarAoPedidoOQueDisse,
  juntarNota,
  lerMensagemLivre,
  quandoNoResumo,
  type DadosDaRecolha,
} from "./whatsapp-recolha";
import { datasDitas } from "./datas-ditas";
import { semAcentos } from "./leitor-da-recolha";
import { eDaEquipa } from "./rajada-do-whatsapp";
import { pedidoDoEnvioDeModelo } from "./envio-de-modelo";
import { ABERTURA_DO_QUE_FALTA, arrumarAsFaltas, rotuloDaFalta, type ChaveDaFalta } from "./mensagem-do-que-falta";
import { QUEM_FALA, SORRISO } from "./voz-da-vitoria";

/**
 * A RESPOSTA AO «PEDIR O QUE FALTA» — 22-11-2026 (decisão d86, CEO e dono).
 *
 * O caso (pedido, nomes e frases inventados): a equipa carregou em «Pedir o
 * que falta» num pedido de recolha de móveis em «precisa info»; saiu a
 * mensagem de modelo a pedir as fotografias, o estacionamento e o dia. A
 * cliente respondeu com tudo menos a fotografia — as medidas do sofá, o
 * estacionamento com condicionantes, «sexta-feira dia 27 a partir das 14h15,
 * com flexibilidade» — e ficou sem resposta, e nada entrou no pedido.
 *
 * Agora, quando o cliente responde ao último envio de modelo daquele pedido,
 * desse número (`respostaAoEnvioDeModelo`), a Vitória:
 *
 *   · lê a resposta parte a parte (`lerARespostaAoQueFalta`) e grava no pedido
 *     o que lá está, pelos validadores de sempre (`fundirCampos`,
 *     `juntarAoPedidoOQueDisse`): a descrição e as medidas, o dia e a hora (a
 *     flexibilidade fica nas notas), o estacionamento (o campo, quando dá para
 *     escolher; as condicionantes nas notas), o andar e o elevador. Nunca por
 *     cima do que lá está; o que não se percebe fica nas notas, dito pelo
 *     cliente;
 *   · responde UMA mensagem curta (`respostaAoQueFalta`): agradece, diz o que
 *     ficou anotado, o que ainda falta e o passo seguinte;
 *   · com o pedido completo, ele sai de «precisa info» como um pedido que a
 *     Vitória registou: volta à fila «por enviar» (`podeSairDoPrecisaInfo`),
 *     onde a equipa o confere e o envia aos parceiros.
 *
 * Queixas, desistências, pedidos de uma pessoa e perguntas que a Vitória não
 * sabe responder seguem para a equipa como sempre (`responderNoPedidoAberto`).
 *
 * PURO. A base e o envio estão em `whatsapp-negociacao.ts`
 * (`responderAoEnvioDeModelo`).
 */

/** Dias em que a resposta a um envio de modelo ainda é a resposta a ele (o ciclo dos lembretes da d71). */
export const DIAS_PARA_RESPONDER_AO_MODELO = 7;

type MensagemDoFio = { direccao?: string; texto?: string; haSegundos?: number | null };

/** «Recebi a fotografia — ficou anexada ao pedido #N.» — o agradecimento automático da fotografia, que não é uma resposta. */
function eAgradecimentoDaFotografia(texto: string): boolean {
  return /^Recebi a fotografia\b.*ficou anexada ao pedido #\d+\.?$/.test(texto.trim());
}

/**
 * O CLIENTE ESTÁ A RESPONDER A UM ENVIO DE MODELO? — o pedido dele, ou null.
 *
 * Do fim do fio para trás: a última mensagem que lhe SAIU é o envio de modelo
 * (o agradecimento automático de uma fotografia não conta), e ele escreveu
 * depois. Se depois do modelo a equipa escreveu à mão, ou a Vitória já lhe
 * respondeu, já não é a resposta ao modelo: vale o caminho de sempre (e a
 * regra das 12 horas da d73, para a equipa).
 */
export function respostaAoEnvioDeModelo(
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
  dias: number = DIAS_PARA_RESPONDER_AO_MODELO,
): { pedidoId: number } | null {
  const lista = Array.isArray(fio) ? fio : [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const m = lista[i];
    if (m?.direccao !== "out" || typeof m.texto !== "string") continue;
    const id = pedidoDoEnvioDeModelo(m.texto);
    if (id != null) {
      if (typeof m.haSegundos === "number" && m.haSegundos > dias * 86_400) return null;
      const respondeu = lista.slice(i + 1).some((x) => x?.direccao === "in");
      return respondeu ? { pedidoId: id } : null;
    }
    if (!eDaEquipa(m.texto) && eAgradecimentoDaFotografia(m.texto)) continue;
    return null;
  }
  return null;
}

/* ── A leitura da resposta ───────────────────────────────────────────────── */

/** O que ficou anotado no pedido, pela ordem em que se diz. */
export type AnotadoNoPedido = "descricao" | "fotografias" | "estacionamento" | "andar" | "elevador" | "data" | "notas";

/** As partes da resposta: as linhas, e as frases de cada linha; sem as marcas de lista. */
export function partesDaResposta(texto: string): string[] {
  return texto
    .split(/\r?\n+/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý«"0-9])/))
    .map((p) => p.replace(/^\s*(?:[-•*·]|\d{1,2}[.)])\s+/, "").trim())
    .filter(Boolean);
}

/** Um cumprimento, um obrigado, uma despedida — não é nada que se grave. */
function eCortesia(parte: string): boolean {
  return /^(ola|bom dia|boa tarde|boa noite|obrigad[oa]s?|muito obrigad[oa]|obg|cumprimentos|com os melhores cumprimentos|melhores cumprimentos|atenciosamente|ok|okay|certo|com certeza|claro|aqui vai|aqui esta|segue|seguem|fico a aguardar|aguardo)([\s,!.]+(obrigad[oa]|cumprimentos|a todos|equipa clyon|equipa))?[\s!.]*$/.test(
    semAcentos(parte.toLowerCase()).trim(),
  );
}

const DE_ESTACIONAMENTO = /\b(estacion\w*|parque\w*|parar|segunda fila|cargas e descargas|encostar|lugares? para a carrinha)\b/;
const DE_QUANDO =
  /\b(hoje|amanha|semana|segunda|terca|quarta|quinta|sexta|sabado|domingo|de manha|a tarde|ao fim do dia|dia \d{1,2}|flexib\w*|disponib\w*|qualquer dia|quando der|urgente|\d{1,2}\s?h(?:\d{2})?|\d{1,2}:\d{2})\b/;

type Tipo = "estacionamento" | "quando" | "acesso" | "descricao";

/** De que fala esta parte da resposta. */
function tipoDaParte(parte: string, agora: Date): Tipo {
  const t = semAcentos(parte.toLowerCase());
  if (DE_ESTACIONAMENTO.test(t)) return "estacionamento";
  if (datasDitas(parte, agora).length > 0 || DE_QUANDO.test(t)) return "quando";
  const l = lerMensagemLivre(parte);
  if ((l.andar || l.elevador || factosSoltos(parte).hasElevator) && !l.descricao) return "acesso";
  return "descricao";
}

/** «Pode ser na sexta-feira…» → «sexta-feira…»: o dia, sem a cortesia à frente. */
function oQuandoSemCortesia(texto: string): string {
  return texto
    .replace(/^\s*(?:pode ser|podera ser|poderá ser|seria|prefiro|preferia|gostaria(?: que fosse)?|idealmente|de preferencia|de preferência)\s+(?:(?:na|no|a|o|em|para)\s+)?/i, "")
    .trim();
}

/** Uma resposta que só diz sim ou não — sozinha não diz a que pergunta responde, e não vai para as notas. */
function soSimOuNao(texto: string): boolean {
  return /^(sim|nao|tem|ha|nao ha|nao tem|sim tem|sim ha)[\s,!.]*$/.test(semAcentos(texto.toLowerCase()).trim());
}

/** O estacionamento com condicionantes — o que o campo (perto/difícil) não diz: «mas», «às vezes», «segunda fila»… */
const CONDICIONANTES =
  /\b(mas|condicionant\w*|segunda fila|as vezes|depende\w*|dificil|complicad\w*|limitad\w*|cargas e descargas|pago|paga|proibid\w*|estreit\w*|metros?|longe|so (?:de|ao|a|aos|entre)|horario|fim de semana|reserv\w*)\b/;

/**
 * A RESPOSTA, LIDA PARTE A PARTE — os dados do pedido com o que ela trouxe, e
 * o que ficou anotado. Só enche o que está vazio (como `juntarAoPedidoOQueDisse`);
 * o que não se percebe fica nas notas, tal e qual («Notas (ditas pelo
 * cliente)» na descrição).
 */
export function lerARespostaAoQueFalta(
  antes: DadosDaRecolha,
  texto: string,
  agora: Date,
  opcoes: { imagens?: number } = {},
): { dados: DadosDaRecolha; anotado: AnotadoNoPedido[]; perguntas: string[] } {
  const d: DadosDaRecolha = { ...antes, ...(antes.notas ? { notas: [...antes.notas] } : {}) };
  const grupos: Record<Tipo, string[]> = { estacionamento: [], quando: [], acesso: [], descricao: [] };
  const perguntas: string[] = [];
  for (const parte of partesDaResposta(texto)) {
    if (eCortesia(parte) || soSimOuNao(parte)) continue;
    const tipo = tipoDaParte(parte, agora);
    // Uma pergunta que não é sobre o dia nem o acesso responde-se (ou fica para a equipa) — não vai para as notas.
    if (tipo === "descricao" && /\?\s*$/.test(parte)) {
      perguntas.push(parte);
      continue;
    }
    grupos[tipo].push(parte);
  }

  // Os campos, pelos validadores de sempre — só os que estão vazios.
  const vazios: CamposCrus = {};
  const est = grupos.estacionamento.join(" ");
  if (est && d.parkingDistance == null) vazios.estacionamento = est;
  const quando = oQuandoSemCortesia(grupos.quando.join(" "));
  if (quando && !d.quandoTexto) vazios.quando = quando;
  for (const p of grupos.acesso) {
    const l = lerMensagemLivre(p);
    if (l.andar && d.floor == null && !vazios.andar) vazios.andar = l.andar;
    if (d.hasElevator == null && !vazios.elevador) {
      if (l.elevador) vazios.elevador = l.elevador;
      else if (factosSoltos(p).hasElevator) vazios.elevador = p;
    }
  }
  Object.assign(d, fundirCampos(d, vazios, agora));

  // As condicionantes do estacionamento — e o estacionamento que não se percebeu — nas notas.
  let notaDoEstacionamento = false;
  const percebido = d.parkingDistance === "near" || d.parkingDistance === "far" || d.metrosAtePorta != null;
  if (est && (!percebido || CONDICIONANTES.test(semAcentos(est.toLowerCase())))) {
    juntarNota(d, /^estaciona/i.test(est) ? est : `Estacionamento: ${est}`);
    notaDoEstacionamento = true;
  }
  const notasAntes = new Set(d.notas ?? []);
  // O andar ou o elevador que não se perceberam.
  for (const p of grupos.acesso) {
    if (d.floor === antes.floor && d.hasElevator === antes.hasElevator) juntarNota(d, p);
  }
  // O que ela conta do trabalho: a descrição de sempre; o que não diz nada que se leia, nas notas.
  const descricao = grupos.descricao.join("\n");
  if (descricao) {
    const antesDaDescricao = JSON.stringify(d);
    juntarAoPedidoOQueDisse(d, descricao, agora, null);
    if (JSON.stringify(d) === antesDaDescricao) for (const p of grupos.descricao) juntarNota(d, p);
  }
  // O que a cliente escreveu fica com ela: o nome só muda quando o pedido não o tinha.
  if (antes.contactName) d.contactName = antes.contactName;

  const anotado: AnotadoNoPedido[] = [];
  if ((d.description ?? "") !== (antes.description ?? "")) anotado.push("descricao");
  if ((opcoes.imagens ?? 0) > 0) anotado.push("fotografias");
  if (d.parkingDistance !== antes.parkingDistance || notaDoEstacionamento || d.metrosAtePorta !== antes.metrosAtePorta) {
    anotado.push("estacionamento");
  }
  if (d.floor !== antes.floor) anotado.push("andar");
  if (d.hasElevator !== antes.hasElevator) anotado.push("elevador");
  if (d.quandoTexto !== antes.quandoTexto || d.dataDesejada !== antes.dataDesejada || d.urgency !== antes.urgency) {
    anotado.push("data");
  }
  const notasNovas = (d.notas ?? []).filter((n) => !notasAntes.has(n));
  if (notasNovas.length > 0) anotado.push("notas");
  return { dados: d, anotado, perguntas };
}

/* ── O que se grava nos campos do pedido para lá dos de sempre ──────────── */

/** O dia e a urgência do pedido, quando estavam vazios — nunca por cima do que lá está. */
export function oDiaParaOPedido(
  pedido: { dataAgendada?: Date | string | null; urgency?: string | null },
  depois: Pick<DadosDaRecolha, "dataDesejada" | "urgency">,
  agora: Date = new Date(),
): { dataAgendada?: Date; urgency?: string } {
  const out: { dataAgendada?: Date; urgency?: string } = {};
  const temDia = pedido.dataAgendada != null && String(pedido.dataAgendada).trim() !== "";
  if (!temDia && depois.dataDesejada) {
    const dia = new Date(depois.dataDesejada);
    // Uma hora que já passou não se marca (como no registo do pedido).
    if (!Number.isNaN(dia.getTime()) && dia.getTime() > agora.getTime() - 3_600_000) out.dataAgendada = dia;
  }
  const temUrgencia = typeof pedido.urgency === "string" && pedido.urgency.trim() !== "";
  if (!temUrgencia && depois.urgency) out.urgency = depois.urgency;
  return out;
}

/**
 * O PEDIDO SAI DE «PRECISA INFO»? — só o que ficou à espera do «Pedir o que
 * falta» (a mensagem ao cliente começa pela abertura da lista do que falta), e
 * só quando já não falta nada. Um «Pedir info» escrito à mão pela equipa pode
 * pedir outra coisa: esse fica à espera de uma pessoa.
 */
export function podeSairDoPrecisaInfo(
  status: string | null | undefined,
  mensagemCliente: string | null | undefined,
  faltas: readonly ChaveDaFalta[],
): boolean {
  if (String(status ?? "").trim() !== "precisa_info") return false;
  if (!String(mensagemCliente ?? "").trim().startsWith(ABERTURA_DO_QUE_FALTA)) return false;
  return arrumarAsFaltas(faltas).length === 0;
}

/** O estado de volta: o de um pedido que a Vitória registou — «atribuído» se alguém o tem, «por atribuir» se não. */
export function estadoDeVoltaDoPrecisaInfo(assignedToId: unknown): string {
  return Number(assignedToId) > 0 ? "atribuido" : "sem_assistente";
}

/** O que fica no histórico do pedido quando ele sai de «precisa info» (d86). */
export const PEDIDO_COMPLETO_PELO_WHATSAPP =
  "O cliente respondeu no WhatsApp ao «Pedir o que falta» e o pedido ficou completo — voltou aos «por enviar», pronto para os parceiros.";

/** O mesmo, quando a resposta veio pela conta do site ou pela app (d3, 23-11-2026). */
export const PEDIDO_COMPLETO_PELA_CONTA =
  "O cliente respondeu na conta ou na app ao «Pedir o que falta» e o pedido ficou completo — voltou aos «por enviar», pronto para os parceiros.";

/* ── A resposta da Vitória ───────────────────────────────────────────────── */

const comMaiuscula = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** A frase do fim, com o pedido completo. */
// d91 (3.8, 23-11-2026): o fim aponta o passo seguinte — escolher.
export const PEDIDO_FICA_COMPLETO =
  "Com isto, o pedido fica completo: a equipa confere-o e segue para os parceiros da sua zona. As propostas chegam-lhe por aqui, e depois é só escolher a que preferir.";
/**
 * A frase do fim, com o pedido completo E JÁ ENVIADO aos parceiros pelo envio
 * automático (d87, 22-11-2026). Só se diz quando o envio foi mesmo feito; se o
 * pedido ficou nos «por enviar» (ou na fila das 8h00), diz-se a de cima.
 */
export const PEDIDO_JA_SEGUIU =
  "O seu pedido já seguiu para os parceiros da sua zona. As propostas chegam-lhe por aqui, e depois é só escolher a que preferir.";
/** A frase do fim, quando ainda falta alguma coisa. */
// d91 (3.8): «posso enviar a foto amanhã?» passa a ter resposta tranquila.
export const PODE_ENVIAR_O_QUE_FALTA =
  "Pode enviar quando lhe der jeito, mesmo amanhã: fica tudo guardado no pedido. Com isso, o pedido fica completo e segue para os parceiros da sua zona.";
/** O que não se percebeu ficou nas notas. */
export const PORMENORES_NAS_NOTAS = "Outros pormenores, nas notas do pedido";

export type ParaAResposta = {
  pedidoId: number;
  /** O primeiro nome, ou null. */
  nome: string | null;
  servico: string | null | undefined;
  anotado: readonly AnotadoNoPedido[];
  /** O dia, como o resumo o diz («sexta-feira, 27 de novembro, a partir das 14h15») — ou null. */
  quando: string | null;
  /** O que ainda falta, depois de gravar. */
  faltam: readonly ChaveDaFalta[];
  /** A Vitória ainda não se apresentou nesta conversa (o modelo foi da equipa). */
  apresentar: boolean;
  /** O envio automático aos parceiros foi feito (d87): diz-se que já seguiu. */
  jaSeguiu?: boolean;
};

/** O dia, como o resumo o escreve, a partir dos dados lidos — ou null. */
export function oQuandoParaAResposta(d: DadosDaRecolha): string | null {
  if (!d.quandoTexto && !d.dataDesejada) return null;
  const q = quandoNoResumo(d).trim();
  return q || null;
}

/**
 * A MENSAGEM DA VITÓRIA — uma só, curta: o obrigado, o que ficou anotado, o
 * que ainda falta e o passo seguinte. Uma linha por coisa, para as traduções
 * fixas a lerem (`traducoes-fixas-da-vitoria.json`).
 */
export function respostaAoQueFalta(p: ParaAResposta): string {
  const obrigada = `Obrigada${p.nome ? `, ${p.nome}` : ""}!`;
  const linhas: string[] = [p.apresentar ? `${obrigada} ${QUEM_FALA} ${SORRISO}` : obrigada];
  const itens: string[] = [];
  for (const a of ["descricao", "fotografias", "estacionamento", "andar", "elevador", "data", "notas"] as const) {
    if (!p.anotado.includes(a)) continue;
    if (a === "descricao") itens.push(comMaiuscula(rotuloDaFalta("descricao", p.servico)));
    else if (a === "fotografias") itens.push("Fotografias");
    else if (a === "estacionamento") itens.push("Estacionamento");
    else if (a === "andar") itens.push("Andar");
    else if (a === "elevador") itens.push("Elevador");
    else if (a === "data") itens.push(p.quando ? `Quando: ${p.quando}` : "Data pretendida");
    else itens.push(PORMENORES_NAS_NOTAS);
  }
  if (itens.length > 0) {
    linhas.push(`Ficou anotado no seu pedido #${p.pedidoId}:`, ...itens.map((i) => `- ${i}`));
  }
  const faltam = arrumarAsFaltas(p.faltam);
  if (faltam.length > 0) {
    linhas.push("Ainda falta:", ...faltam.map((c) => `- ${comMaiuscula(rotuloDaFalta(c, p.servico))}`), PODE_ENVIAR_O_QUE_FALTA);
  } else {
    linhas.push(p.jaSeguiu ? PEDIDO_JA_SEGUIU : PEDIDO_FICA_COMPLETO);
  }
  return linhas.join("\n");
}

/** A Vitória já se apresentou nesta conversa? — uma mensagem dela (não da equipa) com o nome. */
export function aVitoriaJaSeApresentou(fio: ReadonlyArray<MensagemDoFio> | null | undefined): boolean {
  return (Array.isArray(fio) ? fio : []).some(
    (m) => m?.direccao === "out" && typeof m.texto === "string" && !eDaEquipa(m.texto) && /\bVit[óo]ria\b/.test(m.texto),
  );
}
