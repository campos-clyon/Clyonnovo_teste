/**
 * O PEDIDO EM CURSO ANTES DO PEDIDO NOVO — 21-11-2026 (decisão d73).
 *
 * *«Corrija para que isso não aconteça mais.»* — o dono, sobre três
 * conversas (nomes, números e pedidos inventados nos testes):
 *
 *   A. O cliente confirmou o resumo («Acho que sim»), o pedido ficou
 *      registado, e a seguir escreveu «As fotografias já enviei» e «Quando é
 *      apresentado o orçamento». A Vitória recomeçou do zero («Diga-me o que
 *      precisa de levar ou fazer…») e mandou a mesma pergunta duas vezes
 *      seguidas. Ele desistiu: «Já expliquei, vou tentar noutro sítio».
 *   B. Uma cliente com o trabalho feito e o valor final por pagar reclamou do
 *      valor — e ouviu «Para registar o pedido, diga-me só que serviço é…»: o
 *      pedido dela estava concluído, e um número sem pedido aberto era tratado
 *      como cliente novo.
 *   C. Uma cliente antiga pediu um orçamento novo, e a equipa estava a
 *      responder-lhe à mão. A Vitória não se pode meter por cima.
 *
 * As regras, PURAS (quem lê a base e envia é `whatsapp-negociacao.ts` e
 * `pedido-em-curso-na-base.ts`):
 *
 *   1. antes de tratar uma mensagem como pedido novo, vêem-se os pedidos em
 *      curso do número (`PedidoEmCurso`, `faseDoPedido`): se a mensagem é sobre
 *      um deles (`assuntoDoPedido`), responde-se pelo estado real
 *      (`respostaDoEstado`, `respostaDasFotografias`); a reclamação ou a
 *      disputa do valor, e o que não se sabe responder, passam à equipa
 *      (`PASSEI_A_EQUIPA`); pedido novo só quando ele o pede claramente
 *      (`pedeServicoNovo`), e diz-se-lhe (`avisoDePedidoNovo`);
 *   2. nunca recomeçar: depois de um pedido registado na conversa
 *      (`pedidoRegistadoNaConversa`) não volta a pergunta de abertura
 *      (`eAPerguntaDeAbertura`);
 *   3. nunca repetir: a mesma mensagem, ou quase, não sai duas vezes seguidas
 *      (`repeteAUltima`) — passa à equipa;
 *   4. não pisar a equipa: com uma pessoa da equipa a escrever na conversa nas
 *      últimas 12 horas (`aEquipaFalouHaPouco`), a Vitória não responde
 *      sozinha — a mensagem fica na Mesa das conversas.
 */
import { semAcentos } from "./leitor-da-recolha";
import { querOutroPedido } from "./pedido-aberto-na-conversa";
import { eDaEquipa, semMarcaDeMao } from "./rajada-do-whatsapp";
import { eEnvioDeModelo } from "./envio-de-modelo";
import { servicoPorPalavras } from "./whatsapp-recolha";

/* ── 4. Não pisar a equipa ───────────────────────────────────────────────── */

/**
 * As horas em que a Vitória se cala depois de uma pessoa da equipa escrever.
 * A resposta à mão no telemóvel já entregava a conversa a uma pessoa (a ponte
 * chama «interromper»); a resposta pelo backoffice e o «Já respondi» não
 * entregavam nada, e uma devolução automática (o valor final, o comprovativo,
 * o lembrete do orçamento) voltava a soltá-la. Doze horas, desde a última
 * palavra da equipa.
 */
export const HORAS_SEM_PISAR_A_EQUIPA = 12;

type MensagemDoFio = { direccao?: string; texto?: string; haSegundos?: number | null };

/** Há quantos segundos a equipa escreveu pela última vez nesta conversa, ou null. */
export function haQuantoFalouAEquipa(
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
  respondidaHaSegundos?: number | null,
): number | null {
  const idades: number[] = [];
  for (const m of Array.isArray(fio) ? fio : []) {
    if (m?.direccao !== "out" || typeof m.texto !== "string" || !eDaEquipa(m.texto)) continue;
    // O envio de modelo que pede dados ao cliente (o «Pedir o que falta») não é a equipa a conversar (d86).
    if (eEnvioDeModelo(m.texto)) continue;
    if (typeof m.haSegundos === "number" && Number.isFinite(m.haSegundos)) idades.push(Math.max(0, m.haSegundos));
  }
  if (typeof respondidaHaSegundos === "number" && Number.isFinite(respondidaHaSegundos)) {
    idades.push(Math.max(0, respondidaHaSegundos));
  }
  return idades.length > 0 ? Math.min(...idades) : null;
}

/**
 * UMA PESSOA DA EQUIPA FALOU HÁ POUCO? — a resposta à mão (a marca «[à mão]»
 * no fio, do telemóvel), a resposta pelo backoffice e o «Já respondi» (os dois
 * gravam o «Já respondi»), nas últimas `horas`. Um «Devolver ao site» dado por
 * uma pessoa DEPOIS disso devolve a conversa à Vitória: foi essa a decisão de
 * quem a tinha.
 */
export function aEquipaFalouHaPouco(
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
  opcoes: { respondidaHaSegundos?: number | null; devolvidaHaSegundos?: number | null } = {},
  horas: number = HORAS_SEM_PISAR_A_EQUIPA,
): boolean {
  const ha = haQuantoFalouAEquipa(fio, opcoes.respondidaHaSegundos);
  if (ha == null || ha > horas * 3600) return false;
  const devolvida = opcoes.devolvidaHaSegundos;
  if (typeof devolvida === "number" && Number.isFinite(devolvida) && devolvida < ha) return false;
  return true;
}

/** O que fica no painel quando a Vitória se cala por causa da equipa. */
export const MOTIVO_DA_EQUIPA_A_RESPONDER =
  "Uma pessoa da equipa respondeu há pouco — a Vitória não respondeu; responder";

/* ── 1. O pedido em curso ────────────────────────────────────────────────── */

/** A frase curta e humana de quando a conversa passa à equipa. */
export const PASSEI_A_EQUIPA = "Obrigada, já passei à equipa, que lhe responde em breve.";

/** Fechado há pouco: um pedido fechado nos últimos 30 dias ainda é «o pedido dele». */
export const DIAS_DE_UM_PEDIDO_FECHADO = 30;

/** Um pedido do número, como a Vitória precisa de o ver antes de abrir outro. */
export type PedidoEmCurso = {
  id: number;
  status: string | null;
  servico: string | null;
  /** Fotografias que o pedido já tem. */
  fotos: number;
  /** Há quantos dias mexeu pela última vez (o `updatedAt`, ou o `createdAt`). */
  haDias: number | null;
  /** Os estados das negociações dele. */
  negociacoes: ReadonlyArray<{ estado: string; propostaPendente: boolean }>;
  /** Saiu o valor final e ainda não está pago. */
  valorFinalPorPagar: boolean;
  /** Já pago pelo cliente. */
  pago: boolean;
  /** Trabalho CLYON — combinado à mão; o cliente fala com uma pessoa. */
  clyon: boolean;
};

export type FaseDoPedido =
  | "registado"
  | "na_mesa"
  | "com_propostas"
  | "contratado"
  | "feito"
  | "por_pagar"
  | "fechado";

const FECHADOS = new Set(["cancelado", "arquivado", "rejeitado"]);
const ENVIADOS = new Set(["enviado", "em_negociacao", "negociacao", "aprovado", "enviado_cliente"]);
const CONTRATADOS = new Set(["acordada", "aguarda_contratacao", "confirmada", "em_execucao", "executada"]);

/** Em que pé está o pedido — por registar na mesa, com propostas, contratado, feito, por pagar, fechado. */
export function faseDoPedido(p: PedidoEmCurso): FaseDoPedido {
  const status = String(p.status ?? "").trim();
  if (p.valorFinalPorPagar && !p.pago) return "por_pagar";
  if (FECHADOS.has(status)) return "fechado";
  if (status === "concluido") return "feito";
  if (p.negociacoes.some((n) => CONTRATADOS.has(n.estado))) return "contratado";
  if (["confirmado", "agendado", "em_execucao", "em_curso"].includes(status)) return "contratado";
  if (p.negociacoes.some((n) => n.propostaPendente)) return "com_propostas";
  if (ENVIADOS.has(status) || p.negociacoes.length > 0) return "na_mesa";
  return "registado";
}

/** Ainda conta: aberto (de qualquer idade), ou fechado nos últimos 30 dias. */
export function contaComoEmCurso(p: PedidoEmCurso): boolean {
  const fase = faseDoPedido(p);
  if (fase !== "feito" && fase !== "fechado") return true;
  return p.haDias == null || p.haDias <= DIAS_DE_UM_PEDIDO_FECHADO;
}

/** O pedido de que se fala: o aberto mais recente; senão o fechado mais recente. Os pedidos vêm do mais novo para o mais velho. */
export function pedidoPrincipal(pedidos: ReadonlyArray<PedidoEmCurso>): PedidoEmCurso | null {
  const emCurso = pedidos.filter(contaComoEmCurso);
  const aberto = emCurso.find((p) => !["feito", "fechado"].includes(faseDoPedido(p)));
  return aberto ?? emCurso[0] ?? null;
}

export type AssuntoDoPedido = "reclamacao" | "estado" | "fotografias" | "pagamento" | "data";

/**
 * UMA RECLAMAÇÃO OU UMA DISPUTA DO VALOR — «isto está muito caro», «não foi
 * isso que combinámos», «não concordo com o valor», «cobraram a mais».
 */
export function reclamaDoValor(texto: string): boolean {
  const t = semAcentos(texto);
  if (!t) return false;
  return (
    /\b(muito|tao|demasiado|bastante|super|mesmo)\s+caro\b/.test(t) ||
    /\bcaro\s+demais\b|\bcarissimo\b|\bexorbitante\b|\babusiv\w*|\bexagerad\w*|\babsurd\w*|\broubo\b|\bburla\b/.test(t) ||
    /\bnao\s+(concordo|aceito\s+(este|esse|o)\s+(valor|preco)|vou\s+pagar|pago\s+(isso|isto|esse|este))\b/.test(t) ||
    /\bcobra\w*\s+(a\s+mais|demais|mais\s+do\s+que)\b/.test(t) ||
    /\b(valor|preco|conta|fatura)\s+(esta\s+|e\s+|veio\s+)?(errad\w*|incorret\w*|diferente|acima|a\s+mais|alto\s+demais)\b/.test(t) ||
    /\bnao\s+(foi|era|e)\s+(isso|isto|esse|este|o)\s+(que\s+)?(combinad\w*|acordad\w*|o\s+combinado)\b/.test(t) ||
    /\b(estava|tinha\s+sido|ficou)\s+combinad\w*\s+(outro|um\s+valor|por|em)\b/.test(t) ||
    /\bmais\s+caro\s+do\s+que\b|\b(subiu|aumentou)\s+o\s+(valor|preco)\b|\bo\s+(valor|preco)\s+(subiu|aumentou)\b/.test(t) ||
    /\b(reclamar|reclamacao|queixa|livro\s+de\s+reclamacoes)\b/.test(t)
  );
}

/** «As fotografias já enviei», «já mandei as fotos», «as imagens seguem». */
function falaDasFotografiasEnviadas(t: string): boolean {
  if (!/\b(fotos?|fotografias?|imagens?|videos?)\b/.test(t)) return false;
  return /\b(ja|enviei|mandei|enviamos|mandamos|seguem|segue|foram|estao\s+(ai|enviadas)|chegaram|recebeu|receberam)\b/.test(t);
}

/**
 * «Quando é apresentado o orçamento?», «já há propostas?», «como está o meu
 * pedido?», «ainda não recebi nada» — o estado do pedido, e não um pedido.
 */
function perguntaPeloEstado(t: string): boolean {
  if (/\b(ponto\s+de\s+situacao|alguma\s+novidade|ha\s+novidades|novidades\s*\?)/.test(t)) return true;
  if (/\b(como|em\s+que\s+pe)\s+(esta|vai|anda)\s+o\s+(meu\s+)?pedido\b/.test(t)) return true;
  if (/\bainda\s+nao\s+(recebi|chegou|tive|me\s+(disseram|responderam|enviaram))\b/.test(t)) return true;
  if (/\b(estou|continuo|fico)\s+a\s+espera\b/.test(t) && /\b(orcamento|propostas?|resposta|preco|valor|pedido)\b/.test(t)) return true;
  if (!/\b(orcamentos?|propostas?|precos?|valor|resposta|cotacao)\b/.test(t)) return false;
  return /\b(quando|ja\s+(ha|tem|tenho|existe|chegou|chegaram|foi|foram)|ainda|quanto\s+tempo|demora\w*|para\s+quando|apresentad\w*|recebo|vou\s+receber|chega\w*)\b/.test(t);
}

/** O que é sobre o pedido que já existe — ou null, se não se percebe que seja. */
export function assuntoDoPedido(texto: string): AssuntoDoPedido | null {
  const t = semAcentos(texto);
  if (!t) return null;
  if (reclamaDoValor(texto)) return "reclamacao";
  if (falaDasFotografiasEnviadas(t)) return "fotografias";
  if (/\b(paguei|pagamento|pagar|referencia|mb\s?way|multibanco|iban|transferencia|comprovativo|recibo|fatura)\b/.test(t)) {
    return "pagamento";
  }
  if (perguntaPeloEstado(t)) return "estado";
  if (/\b(que\s+dia|a\s+que\s+horas|que\s+horas|remarcar|adiar|mudar\s+(o\s+dia|a\s+data)|outro\s+dia|marcad\w*|agendad\w*)\b/.test(t)) {
    return "data";
  }
  return null;
}

/**
 * PEDE CLARAMENTE UM SERVIÇO NOVO? «Quero fazer outro pedido», «tenho mais um
 * sofá para tirar noutra morada», ou — num pedido já feito ou fechado — um
 * serviço dito com «queria», «preciso», «orçamento». Uma pergunta pelo estado,
 * pelas fotografias ou pelo valor nunca é.
 */
export function pedeServicoNovo(texto: string, principal: PedidoEmCurso | null): boolean {
  const t = semAcentos(texto);
  if (!t) return false;
  if (assuntoDoPedido(texto) != null) return false;
  if (querOutroPedido(texto, principal?.servico ?? null)) return true;
  if (!principal) return false;
  const fase = faseDoPedido(principal);
  if (fase !== "feito" && fase !== "fechado") return false;
  return servicoPorPalavras(texto) != null && /\b(preciso|precisava|queria|quero|gostava|gostaria|pedir|orcamento|tenho)\b/.test(t);
}

/** A linha que diz que é um pedido novo — à parte do que ele já tem. */
export function avisoDePedidoNovo(pedidoId: number | null): string {
  return pedidoId != null ? `Fica como um pedido novo, à parte do pedido #${pedidoId}.` : "Fica como um pedido novo.";
}

/**
 * A PRIMEIRA RESPOSTA DO PEDIDO NOVO, COM O AVISO — a seguir à apresentação,
 * quando ela abre a mensagem («Bom dia! Aqui é a Vitória…»); senão, à frente.
 */
export function comOAvisoDePedidoNovo(resposta: string, pedidoId: number | null): string {
  const aviso = avisoDePedidoNovo(pedidoId);
  if (!resposta.trim() || resposta.includes(aviso)) return resposta;
  const partes = resposta.split("\n\n");
  if (partes.length > 1 && /Aqui é a Vitória/.test(partes[0])) {
    return [partes[0], aviso, ...partes.slice(1)].join("\n\n");
  }
  return `${aviso}\n\n${resposta}`;
}

/** A resposta pelo estado real do pedido — ou null quando é a equipa que sabe (contratado, feito, por pagar, fechado). */
export function respostaDoEstado(p: PedidoEmCurso): string | null {
  switch (faseDoPedido(p)) {
    case "registado":
      return `O pedido #${p.id} já está registado e a equipa está a conferi-lo; depois segue para os parceiros da sua zona, e as propostas chegam-lhe por aqui.`;
    case "na_mesa":
      return `O pedido #${p.id} já está registado e foi enviado aos parceiros; as propostas chegam-lhe por aqui.`;
    default:
      return null;
  }
}

/** «As fotografias já enviei» — ficaram no pedido; sem nenhuma lá, é a equipa que vê no telemóvel. */
export function respostaDasFotografias(p: PedidoEmCurso): string | null {
  if (p.fotos <= 0) return null;
  return `Obrigada! As fotografias ficaram no pedido #${p.id}, para os parceiros as verem.`;
}

export type DecisaoNoPedidoEmCurso =
  | { tipo: "seguir" }
  | { tipo: "pedido_novo"; de: number }
  | { tipo: "responder"; pedidoId: number; texto: string }
  | { tipo: "ecra"; pedidoId: number }
  | { tipo: "equipa"; pedidoId: number; motivo: string; texto: string };

const PALAVRA_DA_FASE: Record<FaseDoPedido, string> = {
  registado: "registado",
  na_mesa: "enviado aos parceiros",
  com_propostas: "com propostas",
  contratado: "contratado",
  feito: "feito",
  por_pagar: "com valor por pagar",
  fechado: "fechado",
};

/**
 * O QUE FAZER COM A MENSAGEM DE QUEM JÁ TEM PEDIDO — antes de a ler como um
 * pedido novo. `abertos` diz se há pedidos abertos (o caminho de sempre, que
 * já continua o pedido aberto, segue para o que não for sobre o pedido); sem
 * abertos, só fechados há pouco, o que não for sobre o pedido nem um serviço
 * novo vai para a equipa quando há um trabalho feito ou por pagar.
 */
export function decidirNoPedidoEmCurso(entrada: {
  texto: string;
  imagens?: number;
  pedidos: ReadonlyArray<PedidoEmCurso>;
  /** Há pedidos abertos do número — o caminho de sempre trata do que não for sobre o pedido. */
  abertos: boolean;
}): DecisaoNoPedidoEmCurso {
  const p = pedidoPrincipal(entrada.pedidos);
  if (!p || p.clyon) return { tipo: "seguir" };
  const fase = faseDoPedido(p);
  const texto = entrada.texto.trim();
  const equipa = (motivo: string): DecisaoNoPedidoEmCurso => ({ tipo: "equipa", pedidoId: p.id, motivo, texto: PASSEI_A_EQUIPA });

  if (!texto) {
    // Só imagens: num trabalho feito, contratado ou por pagar, é para a equipa ver (um comprovativo, uma fotografia do trabalho).
    if (!entrada.abertos && (fase === "por_pagar" || fase === "feito" || fase === "contratado")) {
      return equipa(`Mandou imagens sobre o pedido #${p.id} (${PALAVRA_DA_FASE[fase]}) — ver`);
    }
    return { tipo: "seguir" };
  }

  const assunto = assuntoDoPedido(texto);
  if (assunto === "reclamacao") return equipa(`Pedido #${p.id} (${PALAVRA_DA_FASE[fase]}): o cliente reclama do valor — responder`);
  if (assunto == null && pedeServicoNovo(texto, p)) return { tipo: "pedido_novo", de: p.id };

  if (assunto === "estado") {
    if (fase === "com_propostas") return { tipo: "ecra", pedidoId: p.id };
    const r = respostaDoEstado(p);
    return r ? { tipo: "responder", pedidoId: p.id, texto: r } : equipa(`Pedido #${p.id} (${PALAVRA_DA_FASE[fase]}): pergunta pelo estado — responder`);
  }
  if (assunto === "fotografias") {
    const r = respostaDasFotografias(p);
    return r
      ? { tipo: "responder", pedidoId: p.id, texto: r }
      : equipa(`Pedido #${p.id}: diz que já enviou as fotografias e o pedido não tem nenhuma — ver no telemóvel`);
  }
  // Com pedidos abertos, o pagamento e a data seguem o caminho de sempre (as perguntas do site, a negociação, o «quando chega»).
  if (entrada.abertos) return { tipo: "seguir" };
  if (assunto === "pagamento") return equipa(`Pedido #${p.id} (${PALAVRA_DA_FASE[fase]}): pergunta pelo pagamento — responder`);
  if (assunto === "data") return equipa(`Pedido #${p.id} (${PALAVRA_DA_FASE[fase]}): pergunta pela data — responder`);
  // Nada que se perceba, com um trabalho feito, contratado ou por pagar: é da equipa, e não um pedido novo.
  if (fase === "por_pagar" || fase === "feito" || fase === "contratado") {
    return equipa(`Escreveu sobre o pedido #${p.id} (${PALAVRA_DA_FASE[fase]}) — responder`);
  }
  return { tipo: "seguir" };
}

/* ── 2. Nunca recomeçar ──────────────────────────────────────────────────── */

/** A pergunta de abertura — o «Diga-me o que precisa de levar ou fazer», em todas as formas. */
export function eAPerguntaDeAbertura(texto: string): boolean {
  const t = semAcentos(semMarcaDeMao(texto));
  return /diga-me o que precisa|em que posso ajudar\?\s*diga-me|diga-me so que servico e|e o que e para levar ou fazer|vamos do principio/.test(t);
}

/** O pedido registado nesta conversa («Pedido #N registado»), nos últimos 30 dias — o mais recente, ou null. */
export function pedidoRegistadoNaConversa(fio: ReadonlyArray<MensagemDoFio> | null | undefined): number | null {
  const lista = Array.isArray(fio) ? fio : [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const m = lista[i];
    if (m?.direccao !== "out" || typeof m.texto !== "string") continue;
    if (typeof m.haSegundos === "number" && m.haSegundos > DIAS_DE_UM_PEDIDO_FECHADO * 86400) continue;
    const r = /\bpedido\s+#\s?(\d{2,6})\s+registad/i.exec(semMarcaDeMao(m.texto));
    if (r) return Number(r[1]);
  }
  return null;
}

/** O motivo no painel quando a Vitória ia recomeçar do zero. */
export function motivoDeNaoRecomecar(pedidoId: number): string {
  return `A Vitória ia recomeçar do zero depois do pedido #${pedidoId} — responder`;
}

/* ── 3. Nunca repetir ────────────────────────────────────────────────────── */

function palavras(texto: string): string[] {
  return semAcentos(semMarcaDeMao(texto))
    .replace(/[^a-z0-9#\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * A MESMA MENSAGEM, OU QUASE — as mesmas palavras pela mesma ordem (sem
 * contar a pontuação e os acentos), ou a mesma com pouco à volta («Com todo o
 * gosto! Diga-me o que precisa…» e «Diga-me o que precisa…»). Uma mensagem
 * com um dado mudado — o resumo corrigido, com a morada nova — não é a mesma:
 * é a correcção que ele pediu. E nunca em textos curtos («Obrigada!»).
 */
export function quaseIgual(a: string, b: string): boolean {
  const x = palavras(a);
  const y = palavras(b);
  if (x.length === 0 || y.length === 0) return false;
  const jx = x.join(" ");
  const jy = y.join(" ");
  if (jx === jy) return true;
  const [curta, longa] = x.length <= y.length ? [x, y] : [y, x];
  if (curta.length < 5 || longa.length - curta.length > 6) return false;
  return longa.join(" ").includes(curta.join(" "));
}

/**
 * A RESPOSTA QUE IA SAIR É A ÚLTIMA OUTRA VEZ? — a última mensagem que saiu
 * nesta conversa é da Vitória (não de uma pessoa da equipa) e é igual ou
 * quase igual. Então não se repete: passa à equipa.
 */
export function repeteAUltima(texto: string, saidas: ReadonlyArray<MensagemDoFio> | null | undefined): boolean {
  const lista = (Array.isArray(saidas) ? saidas : []).filter((m) => m?.direccao === "out" && typeof m.texto === "string");
  const ultima = lista[lista.length - 1];
  if (!ultima || eDaEquipa(ultima.texto as string)) return false;
  return quaseIgual(texto, ultima.texto as string);
}

/** Uma cortesia curta («De nada. Qualquer coisa, é só dizer.») — repetida, cala-se, sem passar à equipa. */
export function eSoCortesia(texto: string): boolean {
  const t = semAcentos(texto);
  return t.length <= 60 && /^(de nada|obrigada|ate breve|com todo o gosto)\b/.test(t) && !t.includes("?");
}

/** O motivo no painel quando a Vitória ia repetir a última mensagem. */
export const MOTIVO_DE_NAO_REPETIR = "A Vitória ia repetir a última mensagem — responder";
