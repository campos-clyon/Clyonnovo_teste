/**
 * A VITÓRIA PERCEBE O «1» E A DESISTÊNCIA — d111 (CEO e dono, 24-11-2026).
 *
 * O que se viu no WhatsApp: o seguimento do cliente (d83) manda «Responda 1
 * para escolher o parceiro, 2 se precisar de outra data, ou 3 para cancelar.»
 * Uma cliente com DUAS propostas respondeu «1» e a Vitória passou à equipa
 * («Percebi o que me disse…»). A seguir a cliente escreveu «Gostaria de
 * escolher a proposta da <parceiro> (no valor total de 92,07€)» e a Vitória
 * calou-se, porque a conversa já estava com a equipa. O dono: «Como que ela
 * não percebeu se foi ela que mandou as opções?». Outra cliente respondeu
 * «Obrigado, já tenho outra opção» e a Vitória perguntou se queria cancelar
 * ou deixar em aberto — devia ter cancelado logo.
 *
 * Agora:
 *   · «1» com UMA proposta aceita-a (o fecho de sempre); com VÁRIAS, a lista
 *     numerada (o parceiro e o total com IVA, como nas mensagens das
 *     propostas) e «Qual quer escolher?»; a resposta (o número ou o nome)
 *     aceita essa; sem propostas, a equipa, como antes;
 *   · o cliente que nomeia uma proposta do pedido depois de a Vitória ter
 *     passado a conversa à equipa NO SEGUIMENTO (e sem uma pessoa ter escrito
 *     depois) volta à Vitória, que aceita — ou pergunta qual, na dúvida;
 *   · a desistência clara em resposta ao seguimento, à lista ou a uma
 *     proposta («já tenho outra opção», «já contratei outra empresa», «já não
 *     preciso», «já resolvi», «não estou interessado», e o mesmo em inglês,
 *     francês e espanhol) cancela logo, pelo caminho da d93/d94; o «3»
 *     continua a pedir o CANCELAR (é uma escolha de menu, pode ser engano);
 *     «vou ver», «ainda estou a decidir» ou «obrigado» não cancelam.
 *
 * PURO. A base e o WhatsApp estão em `a-escolha-e-a-desistencia-no-whatsapp.ts`.
 */

import { eMensagemDoSeguimento } from "./seguimento-do-cliente";
import { aUltimaSaidaE } from "./validade-do-orcamento";
import { eDaEquipa } from "./rajada-do-whatsapp";
import { haQuantoFalouAEquipa } from "./pedido-em-curso";
import { identificarProposta, type PropostaDoAgente } from "./vitoria-agente/propostas-do-agente";
import { unidadeDaBase } from "./base-do-preco";

/** Sem acentos, minúsculas, sem pontuação nem apóstrofos, espaços simples. */
function normalizar(texto: string): string {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ")
    .replace(/[’'`´]/g, " ")
    .replace(/[!.,;:…()«»"“”\-–—/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ── 1. A desistência clara ──────────────────────────────────────────────── */

/** O fim da frase, ou o que costuma vir a seguir sem mudar o sentido («já resolvi, obrigada»). */
const FIM =
  "(?=$| (?:obrigad\\w*|muito obrigad\\w*|agradec\\w*|grat[oa]|thanks?|thank you|merci|gracias|bom dia|boa tarde|boa noite|cumprimentos|entretanto|por agora|de momento|neste momento|mais|ja|desculp\\w*|sorry|anyway|enfim|bjs?|abraco)\\b)";

/**
 * O que ele já não precisa: o pedido, o serviço, a vossa ajuda… (e nunca «da desmontagem», que é uma parte).
 * «vo[c]es» lê o que o cliente escreve, sem acentos; escrito assim, a orquestra não o lê como um texto nosso.
 */
const DO_PEDIDO =
  "(?: (?:de nada|de vo[c]es|dos vossos servicos|da vossa ajuda|do vosso servico|d[oa] (?:servico|pedido|recolha|mudanca|esvaziamento|orcamento|trabalho|reparacao|proposta|propostas)))";

const DESISTENCIAS: readonly RegExp[] = [
  // PT — já tem outra opção / outra empresa / quem faça.
  /\bja (?:tenho|temos) (?:outra|outro) (?:opcao|empresa|solucao|proposta|pessoa|parceiro|orcamento|servico|alternativa)\b/,
  /\bja (?:tenho|temos) quem (?:faca|o faca|me faca|nos faca|trate|leve)\b/,
  new RegExp(`\\bja (?:tenho|temos) (?:outra|outro)${FIM}`),
  /\bja (?:arranjei|arranjamos|encontrei|encontramos|contratei|contratamos|escolhi|escolhemos|fechei|fechamos|marquei|marcamos) (?:outra|outro|alguem|quem|uma empresa|um parceiro|uma pessoa)\b/,
  /\b(?:escolhi|escolhemos|optei|optamos|contratei|contratamos|fechei|fechamos|avancei|avancamos|fui|fomos|resolvi|resolvemos) (?:por |com |pela |pelo |a |o )?(?:outra|outro) (?:empresa|opcao|proposta|solucao|pessoa|parceiro|servico|orcamento)\b/,
  // PT — já não precisa.
  new RegExp(`\\b(?:ja|afinal(?: ja)?) nao (?:preciso|precisamos|necessito|necessitamos|e preciso|e necessario|vou precisar|vamos precisar)(?:${DO_PEDIDO}|${FIM})`),
  new RegExp(`\\b(?:ja|afinal(?: ja)?) nao (?:quero|queremos)${FIM}`),
  new RegExp(`\\bnao (?:preciso|precisamos|necessito) mais(?:${DO_PEDIDO}|${FIM})`),
  // PT — já resolveu.
  new RegExp(
    `\\bja (?:resolvi|resolvemos|tratei|tratamos|se resolveu|esta resolvido|esta tratado|esta tudo resolvido|esta tudo tratado|ficou resolvido|ficou tratado|foi resolvido|foi tratado)(?: com outr\\w*| de outra forma| por outro lado| entretanto)?${FIM}`,
  ),
  // PT — não está interessado / desiste.
  /\b(?:ja )?nao (?:estou|estamos) (?:mais )?interessad[oa]s?\b/,
  /\b(?:ja )?nao (?:tenho|temos) (?:mais )?interesse\b/,
  new RegExp(`\\b(?:desisto|desistimos|vou desistir|vamos desistir)(?: d[oa] (?:pedido|servico|recolha|mudanca|esvaziamento|orcamento))?${FIM}`),
  // EN.
  /\b(?:found|hired|booked|chose|picked|went with|going with|got) (?:someone|somebody|someone else|somebody else|another (?:company|one|provider|option|quote|person)|a different (?:company|one|provider)|other company)\b/,
  new RegExp(`\\b(?:no longer|dont|do not|don t) need (?:it|this|the service|your service|your services|you|them)?(?: anymore| any more)?${FIM}`),
  /\bno longer (?:needed|required|necessary)\b|\bnot needed (?:anymore|any more)\b/,
  /\b(?:not|no longer) interested\b/,
  /\b(?:all|it s|its|everything s|everything is|already|we re|we are|i m|i am) sorted\b|\bsorted (?:it|now|out)\b|\balready (?:sorted|done|taken care of|booked|found)\b/,
  // FR.
  /\b(?:j ai|on a|nous avons) (?:deja )?(?:trouve|choisi|pris|engage|reserve) (?:quelqu un|une autre|un autre|une entreprise|ailleurs)\b/,
  /\b(?:plus besoin|n ai plus besoin|n avons plus besoin|pas besoin finalement)\b/,
  /\b(?:pas|plus) interesse(?:e|s|es)?\b/,
  new RegExp(`\\bc est (?:deja )?(?:regle|resolu)${FIM}`),
  // ES.
  /\bya (?:encontre|contrate|elegi|escogi|tengo|hemos encontrado|hemos contratado) (?:a otra|otra|otro|a alguien|alguien|a otro) ?(?:empresa|persona|opcion)?\b/,
  /\bya no (?:lo |la )?(?:necesito|necesitamos|hace falta)\b/,
  /\bno (?:me|nos) interesa\b|\b(?:ya )?no (?:estoy|estamos) interesad[oa]s?\b/,
  /\bya (?:lo )?(?:resolvi|resolvimos|solucione|solucionamos)\b/,
];

/** O que faz da frase uma dúvida, uma condição ou uma escolha — e então não é uma desistência clara. */
const NAO_E_CLARA: readonly RegExp[] = [
  /\b(?:mas|but|pero|however|sin embargo|cependant)\b/,
  /\b(?:talvez|se calhar|acho que|possivelmente|provavelmente|maybe|perhaps|probably|peut etre|quizas|tal vez|creo que)\b/,
  /\b(?:ainda|still|todavia|encore|aun)\b/,
  /\bse (?:ja |calhar|for|nao|houver|precisar|tiver)\b|\bif\b|\bsi (?:ya|je|no)\b/,
  /\b(?:prefiro|preferimos|escolho|escolhemos a|fico com|ficamos com|quero a|quero o|quero escolher|i ll take|i choose|je choisis|elijo|me quedo)\b/,
];

/**
 * O CLIENTE DESISTE, CLARAMENTE? Pura. «Já tenho outra opção», «já contratei
 * outra empresa», «já não preciso», «já resolvi», «não estou interessado» (e
 * em inglês, francês e espanhol). Uma pergunta, um «mas», um «talvez», um
 * «ainda», uma condição ou uma escolha («prefiro a outra proposta») não são;
 * «vou ver», «ainda estou a decidir» e «obrigado» também não. O «3» e o
 * CANCELAR sozinhos não são frases: são o menu (pedem a confirmação).
 */
export function desisteClaramente(texto: string | null | undefined): boolean {
  const cru = String(texto ?? "").trim();
  if (!cru || cru.length > 240 || /\?/.test(cru)) return false;
  const t = normalizar(cru);
  if (!t) return false;
  if (NAO_E_CLARA.some((re) => re.test(t))) return false;
  return DESISTENCIAS.some((re) => re.test(t));
}

/** A mensagem ao cliente, depois de cancelar (d111): agradece, o pedido, os dados, e que pode voltar. Uma linha (tradução fixa). */
export function mensagemDaDesistencia(pedidoId: number): string {
  return `Obrigada por nos avisar! O seu pedido #${pedidoId} foi cancelado e os dados do pedido serão apagados. Se voltar a precisar, pode pedir de novo quando quiser.`;
}

/* ── 2. A lista das propostas ────────────────────────────────────────────── */

/** A última linha da lista. É por ela (e pelo número do pedido) que se reconhece a lista na conversa. */
export const QUAL_QUER_ESCOLHER = "Qual quer escolher? Responda com o número ou o nome do parceiro.";

/** Quanto tempo vale a lista: a resposta depois disto já não é a ela. */
export const HORAS_DA_LISTA = 48;

export type LinhaDaLista = { n: number; parceiro: string; valor: string };

/** O valor como na mensagem das propostas: «75,00 € + IVA = 92,07 €» (com « por carga» ou « por hora», se for). */
export function valorNaLista(p: Pick<PropostaDoAgente, "comoOClienteVe" | "base">): string {
  return `${p.comoOClienteVe}${unidadeDaBase(p.base)}`;
}

/**
 * A LISTA DAS PROPOSTAS DO PEDIDO — numerada, com o parceiro e o total com IVA
 * (como nas mensagens das propostas). `deNovo` quando não se percebeu qual:
 * a primeira linha muda (para não sair o mesmo texto duas vezes). Pura.
 */
export function textoDaListaDasPropostas(
  pedidoId: number,
  propostas: ReadonlyArray<Pick<PropostaDoAgente, "parceiro" | "comoOClienteVe" | "base">>,
  deNovo = false,
): string {
  const cabeca = deNovo
    ? `Não percebi qual das propostas do pedido #${pedidoId} quer escolher:`
    : `Tem ${propostas.length} propostas para o pedido #${pedidoId}:`;
  const linhas = propostas.map((p, i) => `${i + 1}. ${p.parceiro.replace(/\s+/g, " ").trim()}: ${valorNaLista(p)}`);
  return [cabeca, ...linhas, QUAL_QUER_ESCOLHER].join("\n");
}

/** A lista, lida do texto que saiu (o registo fica em português) — ou null. Pura. */
export function lerAListaDasPropostas(texto: string | null | undefined): { pedidoId: number; linhas: LinhaDaLista[] } | null {
  const t = String(texto ?? "").replace(/\r/g, "");
  if (!t.includes(QUAL_QUER_ESCOLHER)) return null;
  const cabeca = /(?:propostas para o pedido|das propostas do pedido) #(\d+)\b/.exec(t);
  const pedidoId = Number(cabeca?.[1]);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return null;
  const linhas: LinhaDaLista[] = [];
  for (const l of t.split("\n")) {
    const m = /^(\d{1,2})\. (.+): (\d[\d.]*,\d{2} €.*)$/.exec(l.trim());
    if (m) linhas.push({ n: Number(m[1]), parceiro: m[2].trim(), valor: m[3].trim() });
  }
  return linhas.length > 0 ? { pedidoId, linhas } : null;
}

const VERBO_DE_ESCOLHA =
  /\b(?:escolh\w*|quero|queria|queremos|gostaria|gostariamos|aceit\w*|fico com|ficamos com|opto|optamos|prefiro|preferimos|avanc\w*|vamos com|vou com|pode ser|reserv\w*|contrat\w*|choose|chose|pick|accept\w*|go with|take|ll take|choisi\w*|je prends|elij\w*|acept\w*|me quedo|quisiera)\b/;
const ESCOLHA_NEGADA = /\b(?:nao|not|dont|don t|pas|no) (?:quero|queria|queremos|escolho|aceito|gostaria|want|choose|accept|veux|quiero)\b/;

export type EscolhaDoCliente<P extends PropostaDoAgente = PropostaDoAgente> =
  | { tipo: "escolheu"; proposta: P }
  | { tipo: "duvida" }
  | null;

/**
 * O CLIENTE ESCOLHEU UMA PROPOSTA DO PEDIDO, POR PALAVRAS? Pura. Pede um verbo
 * de escolha («gostaria de escolher a proposta da X», «fico com a primeira»,
 * «aceito a de 92,07») e uma proposta identificada (o nome, o valor, a ordem —
 * `identificarProposta`). Duas a bater, ou «quero escolher uma» com várias:
 * dúvida (pergunta-se qual). Uma pergunta ou uma recusa não são escolhas.
 */
export function escolhaDita<P extends PropostaDoAgente>(texto: string | null | undefined, propostas: readonly P[]): EscolhaDoCliente<P> {
  const cru = String(texto ?? "").trim();
  if (!cru || cru.length > 300 || /\?/.test(cru) || propostas.length === 0) return null;
  const t = normalizar(cru);
  if (!VERBO_DE_ESCOLHA.test(t) || ESCOLHA_NEGADA.test(t)) return null;
  const r = identificarProposta(cru, propostas);
  if (r.ok) return { tipo: "escolheu", proposta: r.proposta };
  if (/^Bate em/.test(r.porque)) return { tipo: "duvida" };
  if (propostas.length > 1 && /\b(?:proposta|propostas|parceiro|parceiros|empresa|opcao|quote|offer|devis|presupuesto)\b/.test(t)) return { tipo: "duvida" };
  return null;
}

/**
 * A RESPOSTA À LISTA. Pura. O número sozinho («2», «a 2», «opção 2») é a
 * linha da lista; senão o nome, o valor ou a ordem («a primeira»), com um
 * verbo de escolha ou numa frase curta («A da Recolhas Tejo»). As propostas
 * de agora renumeram-se pela ordem da lista (a lista é o que o cliente viu).
 * «nada»: não é uma resposta à lista (segue a conversa de sempre).
 */
export function escolhaNaLista<P extends PropostaDoAgente>(
  texto: string | null | undefined,
  linhas: readonly LinhaDaLista[],
  propostas: readonly P[],
): { tipo: "escolheu"; proposta: P; linha: LinhaDaLista | null } | { tipo: "duvida" } | { tipo: "nada" } {
  const cru = String(texto ?? "").trim();
  if (!cru || cru.length > 300) return { tipo: "nada" };
  const t = normalizar(cru);
  const mesmo = (a: string, b: string) => normalizar(a) === normalizar(b);
  const linhaDe = (p: P) => linhas.find((l) => mesmo(l.parceiro, p.parceiro)) ?? null;
  const numero = /^(?:a |o |e a |e o |opcao |opcao n |numero |n |no )?(\d{1,2})(?: obrigad[oa]| por favor| pf| please)?$/.exec(t)?.[1];
  if (numero != null) {
    const l = linhas.find((x) => x.n === Number(numero));
    if (!l) return { tipo: "duvida" };
    const p = propostas.find((x) => mesmo(x.parceiro, l.parceiro));
    return p ? { tipo: "escolheu", proposta: p, linha: l } : { tipo: "duvida" };
  }
  if (/\?/.test(cru) || ESCOLHA_NEGADA.test(t) || propostas.length === 0) return { tipo: "nada" };
  // A ordem é a da lista que ele viu.
  const pelaLista = [...propostas]
    .map((p) => ({ p, n: linhaDe(p)?.n ?? 99 }))
    .sort((a, b) => a.n - b.n)
    .map(({ p }, i) => ({ ...p, n: i + 1 }) as P);
  const r = identificarProposta(cru, pelaLista);
  const curta = t.split(" ").length <= 6;
  if (r.ok && (VERBO_DE_ESCOLHA.test(t) || curta)) {
    const original = propostas.find((x) => x.negociacaoId === r.proposta.negociacaoId) ?? r.proposta;
    return { tipo: "escolheu", proposta: original, linha: linhaDe(original) };
  }
  if (!r.ok && /^Bate em/.test(r.porque) && (VERBO_DE_ESCOLHA.test(t) || curta)) return { tipo: "duvida" };
  return { tipo: "nada" };
}

/* ── 3. A que pedido responde, e se a conversa foi entregue pelo seguimento ─ */

/** Os números de pedido escritos num texto («#612»). */
function numerosDePedido(texto: string): number[] {
  return [...String(texto ?? "").matchAll(/#(\d{2,7})(?!\d)/g)].map((m) => Number(m[1])).filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * A ÚLTIMA MENSAGEM QUE LHE SAIU É SOBRE AS PROPOSTAS DE QUE PEDIDO? Pura. O
 * seguimento (d83), a lista (d111), uma proposta ou a aceitação de um parceiro
 * («… (pedido #N)»), o lembrete do orçamento ou a pergunta do CANCELAR (d62).
 * É a resposta a uma destas que a desistência clara cancela. Ou null.
 */
export function pedidoDaUltimaSaida(texto: string | null | undefined): number | null {
  const t = String(texto ?? "");
  if (!t.trim() || eDaEquipa(t)) return null;
  const lista = lerAListaDasPropostas(t);
  if (lista) return lista.pedidoId;
  const n = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const id of numerosDePedido(t)) {
    if (eMensagemDoSeguimento(t, id)) return id;
    if (aUltimaSaidaE(t, id) != null) return id;
    if (new RegExp(` propoe .*\\(pedido #${id}\\)`).test(n)) return id;
    if (new RegExp(` aceitou os .* para o pedido #${id}(?!\\d)`).test(n)) return id;
  }
  return null;
}

/** Os motivos com que a Vitória passa à equipa no seguimento — todos dizem «ao seguimento» (d111 reconhece-os). */
export const MOTIVOS_DO_SEGUIMENTO = {
  semPropostas: (pedidoId: number) => `Pedido #${pedidoId}: respondeu «1» ao seguimento — quer avançar, mas não há proposta para escolher: escolher o parceiro com ele`,
  outraData: (pedidoId: number) => `Pedido #${pedidoId}: quer outra data («2» ao seguimento)`,
  respondeu: (pedidoId: number) => `Respondeu ao seguimento do pedido #${pedidoId} — responder`,
};

/**
 * O MOTIVO DA ENTREGA É DO SEGUIMENTO? Devolve o pedido, ou null. Pura. Os
 * motivos de agora e os de antes da d111 («respondeu «1» ao seguimento»,
 * «quer outra data («2» ao seguimento)», «Respondeu ao seguimento do pedido
 * #N», «disse que já não precisa (seguimento)»). Uma entrega feita por uma
 * pessoa (o botão do backoffice, a resposta à mão) muda o motivo.
 */
export function pedidoDoMotivoDoSeguimento(motivo: string | null | undefined): number | null {
  const m = String(motivo ?? "");
  if (!/\bao seguimento\b|\bseguimento do pedido #\d|\(seguimento\)/i.test(m)) return null;
  const ids = numerosDePedido(m);
  return ids.length === 1 ? ids[0] : null;
}

type MensagemDoFio = { direccao: string; texto: string; haSegundos?: number | null };

/** Quantos dias depois do seguimento a escolha ainda o retoma. */
export const DIAS_PARA_RETOMAR = 7;

/**
 * A CONVERSA FOI ENTREGUE À EQUIPA PELA VITÓRIA, NO SEGUIMENTO, E NINGUÉM DA
 * EQUIPA ESCREVEU DEPOIS? Devolve o pedido, ou null. Pura.
 *
 *   · o motivo da entrega é do seguimento (`pedidoDoMotivoDoSeguimento`);
 *   · na conversa está a mensagem do seguimento (ou a lista) desse pedido,
 *     há menos de 7 dias — a âncora;
 *   · nenhuma resposta à mão («[à mão]»), pelo backoffice ou «Já respondi»
 *     depois da âncora: quando uma pessoa respondeu, a conversa é dela.
 */
export function pedidoDaEntregaPeloSeguimento(e: {
  motivo: string | null | undefined;
  fio: ReadonlyArray<MensagemDoFio>;
  respondidaHaSegundos?: number | null;
}): number | null {
  const id = pedidoDoMotivoDoSeguimento(e.motivo);
  if (id == null) return null;
  let ancora: MensagemDoFio | null = null;
  for (let i = e.fio.length - 1; i >= 0; i -= 1) {
    const m = e.fio[i];
    if (m.direccao !== "out" || eDaEquipa(m.texto)) continue;
    if (eMensagemDoSeguimento(m.texto, id) || lerAListaDasPropostas(m.texto)?.pedidoId === id) {
      ancora = m;
      break;
    }
  }
  if (!ancora || typeof ancora.haSegundos !== "number" || ancora.haSegundos > DIAS_PARA_RETOMAR * 86400) return null;
  const daEquipa = haQuantoFalouAEquipa(e.fio, e.respondidaHaSegundos ?? null);
  if (daEquipa != null && daEquipa <= ancora.haSegundos) return null;
  return id;
}

/** A última mensagem que saiu da Vitória (não à mão), com a idade. */
export function ultimaSaidaDaVitoria<M extends MensagemDoFio>(fio: ReadonlyArray<M>): M | null {
  for (let i = fio.length - 1; i >= 0; i -= 1) {
    const m = fio[i];
    if (m.direccao === "out") return eDaEquipa(m.texto) ? null : m;
  }
  return null;
}

/** A mensagem de quando a escolha passa à equipa (acima do limite, à hora, Trabalho CLYON…). */
export function mensagemDaEscolhaComAEquipa(parceiro: string): string {
  return `Obrigada! Anotei que escolheu ${parceiro.replace(/\s+/g, " ").trim()}. Uma pessoa da CLYON confirma consigo por aqui e fecha a proposta (de segunda a sábado, das 8h às 20h).`;
}
