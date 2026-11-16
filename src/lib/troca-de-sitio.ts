import { semAcentos } from "./leitor-da-recolha";
import { localidadeConhecida } from "./localidade-publica";
import { deTerra, emTerra, paraTerra } from "./preposicao-da-terra";
import { perguntaDo, primeiroPassoEmFalta, simOuNao, type DadosDaRecolha, type EstadoDaRecolha } from "./whatsapp-recolha";

/**
 * «É PARA OUTRO LADO» — 16-11-2026 (decisão d51, aprovada pelo CEO e pelo dono).
 *
 * O caso (nome e moradas inventados): a cliente tinha um pedido aberto de
 * recolha de entulho na Pontinha, com orçamento de há duas semanas, e escreveu
 * de seguida:
 *
 *   CLIENTE: Olha é para outro lado
 *   CLIENTE: Pra lá já não preciso
 *   CLIENTE: Agora eu preciso mais é para o Benfica
 *
 * `querOutroPedido` só apanhava «outro pedido», «pedido novo» ou um serviço de
 * outra família: o mesmo serviço noutro sítio não era apanhado, e a Vitória
 * ficava agarrada ao pedido antigo — ou lia «Benfica» como uma 2.ª morada.
 *
 * Agora:
 *   · `mudouDeSitio` percebe a troca (e a localidade nova, se a disse);
 *   · a Vitória confirma num passo — «Percebi: em vez da Pontinha, agora é em
 *     Benfica. Faço um pedido novo para Benfica?»;
 *   · com o sim, nasce uma recolha nova com o nome e o serviço do pedido
 *     antigo, e a localidade nova; pergunta-se só o que falta;
 *   · o pedido antigo NÃO se cancela: fica com a nota para a equipa o fechar.
 *
 * Uma 2.ª paragem («também», «e depois», «um segundo lugar») não é uma troca:
 * continua em `segunda-morada.ts`. «Já não preciso lá», «em vez de» é troca,
 * mesmo com um «também» pelo meio.
 *
 * Este ficheiro é PURO: quem escreve na base é `whatsapp-negociacao.ts`.
 */

/** O pedido antigo, como a troca precisa dele. */
export type SitioDoPedido = {
  id: number;
  localidade: string | null;
  /** A morada do pedido — a terra dita pode estar lá dentro («Rua X, Pontinha»). */
  morada?: string | null;
};

export type TrocaDeSitio = { de: number; localidade: string | null };

/** «Já não é lá», «pra lá já não preciso», «em vez de», «mudou a morada» — a troca, mesmo com um «também». */
const TROCA_FORTE: RegExp[] = [
  /\b(?:pra|para)\s+(?:la|ali|ai|esse\s+sitio|essa\s+morada|esse\s+local|essa\s+casa)\s+(?:ja\s+)?nao\s+(?:preciso|e\s+preciso|e|quero|vai\s+ser|interessa|da)\b/,
  /\b(?:la|ali)\s+ja\s+nao\s+(?:preciso|e\s+preciso|e|quero|vai\s+ser|interessa)\b/,
  /\bja\s+nao\s+(?:preciso|e\s+preciso|quero|vai\s+ser|e|sera)\s+(?:de\s+nada\s+)?(?:(?:para|pra)\s+)?(?:la|ali|ai|nesse\s+sitio|nessa\s+morada|naquela\s+morada|naquele\s+sitio)\b/,
  /\b(?:mudou|mudei|mudamos|troquei|trocamos|alterei|mudar|trocar|alterar)\s+(?:a|de|o)\s+(?:morada|endereco|local|sitio)\b/,
  /\b(?:a|de)\s+(?:morada|endereco|local)\s+(?:mudou|e\s+outr[ao]|ja\s+nao\s+e)\b/,
];

/** «É para outro lado», «fica noutro sítio», «é noutra morada» — troca, se não houver sinal de 2.ª paragem. */
const OUTRO_SITIO =
  /\b(?:(?:e|sera|vai\s+ser|fica|para|pra|em|num|numa)\s+(?:um\s+|uma\s+)?(?:outro|outra)|noutro|noutra|n'outro|n'outra)\s+(?:lado|sitio|local|morada|endereco|zona|casa|sitio)\b/;

/** O que faz de uma morada nova uma 2.ª paragem, e não uma troca. */
const SEGUNDA_PARAGEM =
  /\b(?:tambem|alem\s+d\w+|e\s+depois|depois\s+(?:vamos|passa\w*|ir|e)|segund[oa]|2\s*\.?\s*[ºªoa]|mais\s+uma\s+(?:morada|paragem|casa)|outra\s+paragem|paragem|intermedi\w*|e\s+ainda)\b/;

/** «Agora é…», «agora preciso…» — e a terra nova a seguir. */
const AGORA = /\bagora\b/;

/** As palavras que nunca são uma terra, nem com maiúscula. */
const NAO_E_TERRA =
  /^(?:clyon|portugal|vitoria|whatsapp|ok|obrigad[oa]|segunda|terca|quarta|quinta|sexta|sabado|domingo|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|natal|pascoa)(?:-feira)?$/;

function mesmaTerra(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return semAcentos(a).trim() === semAcentos(b).trim();
}

/** A terra já é a do pedido: a localidade dele, ou está escrita na morada dele. */
function eDoPedido(terra: string, p: SitioDoPedido): boolean {
  if (mesmaTerra(terra, p.localidade)) return true;
  const morada = semAcentos(p.morada ?? "");
  const t = semAcentos(terra);
  return Boolean(morada) && new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`).test(morada);
}

/**
 * A TERRA NOVA que ele nomeou — a última que não é a do pedido. Primeiro as
 * conhecidas (as das páginas e da cobertura); depois, um nome com maiúscula a
 * seguir a «para», «em», «no», «na».
 */
export function terraNova(texto: string, p: SitioDoPedido): string | null {
  // A terra do pedido sai do texto, para não ganhar a uma terra nova dita antes.
  let alvo = semAcentos(texto);
  for (const velha of [p.localidade]) {
    if (!velha) continue;
    const v = semAcentos(velha).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    alvo = alvo.replace(new RegExp(`(^|[^a-z0-9])${v}(?=$|[^a-z0-9])`, "g"), "$1 ");
  }
  const conhecida = localidadeConhecida(alvo);
  if (conhecida && !eDoPedido(conhecida, p)) return conhecida;
  const nomes = [
    ...texto.matchAll(
      /\b(?:para|pra|em|no|na|nos|nas)\s+(?:o\s+|a\s+)?([A-ZÀ-Ý][a-zà-ÿ'’]+(?:[ \t]+(?:d[aeo]s?[ \t]+)?[A-ZÀ-Ý][a-zà-ÿ'’]+){0,3})/g,
    ),
  ]
    .map((m) => m[1].trim())
    .filter((n) => !NAO_E_TERRA.test(semAcentos(n)) && !eDoPedido(n, p));
  return nomes.length > 0 ? nomes[nomes.length - 1] : null;
}

/**
 * MUDOU DE SÍTIO? — `{ localidade }` (a nova, ou null se não a disse), ou
 * `null` quando não é uma troca. O texto pode ser a rajada inteira, com as
 * mensagens separadas por linhas.
 */
export function mudouDeSitio(texto: string, p: SitioDoPedido): { localidade: string | null } | null {
  const t = semAcentos(texto);
  if (!t.trim()) return null;
  const nova = terraNova(texto, p);
  const forte =
    TROCA_FORTE.some((r) => r.test(t)) ||
    // «Já não é na Pontinha», «em vez da Pontinha» — com a terra do pedido.
    (p.localidade != null &&
      new RegExp(
        `\\b(?:ja\\s+nao\\s+(?:e|sera|vai\\s+ser|preciso)\\s+(?:(?:para|pra)\\s+)?(?:em|n[ao]s?|[ao]s?)?\\s*|em\\s+vez\\s+(?:de\\s+(?:ser\\s+)?(?:em|n[ao]s?)?\\s*|d[ao]s?\\s+))${semAcentos(p.localidade).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      ).test(t)) ||
    // «Em vez de lá, …», «em vez de ser ali».
    /\bem\s+vez\s+de\s+(?:ser\s+)?(?:la|ali)\b/.test(t);
  if (forte) return { localidade: nova };
  if (SEGUNDA_PARAGEM.test(t)) return null;
  if (OUTRO_SITIO.test(t)) return { localidade: nova };
  // «Agora é para o Benfica» — só com a terra do pedido conhecida, e outra.
  if (AGORA.test(t) && nova && p.localidade) return { localidade: nova };
  return null;
}

/** «Pode ser lá mesmo», «é no mesmo sítio» — fica onde estava. */
function ficaOndeEstava(texto: string): boolean {
  return /\b(?:la|ali|ai)\s+mesmo\b|\bmesm[oa]\s+(?:sitio|lugar|local|morada|sitio)\b|\b(?:continua|fica|e)\s+(?:la|ali|igual)\b/.test(
    semAcentos(texto),
  );
}

/** O sim à pergunta «Faço um pedido novo…?» — ou o não, ou nem um nem outro. */
export function respostaATroca(texto: string): "sim" | "nao" | null {
  const t = semAcentos(texto).trim();
  if (ficaOndeEstava(t)) return "nao";
  const sn = simOuNao(t);
  if (sn) return sn;
  if (/^(?:pode(?:\s+ser|\s+fazer)?|faca|faz|faca\s+favor|por\s+favor|isso(?:\s+mesmo)?|exactamente|exatamente|quero|queria|e\s+isso|pois|pode\s+sim|sim\s+por\s+favor|bora|vamos)\b/.test(t)) {
    return "sim";
  }
  if (/^(?:nao|nada\s+disso|esquece|deixa(?:\s+estar)?|afinal\s+(?:e|fica)\s+(?:la|ali)|engan\w+)\b/.test(t)) return "nao";
  return null;
}

/** «Percebi, Rita: em vez da Pontinha, agora é em Benfica. Faço um pedido novo para Benfica?» */
export function perguntaDaTroca(p: SitioDoPedido, localidade: string | null, nome: string | null): string {
  const percebi = `Percebi${nome ? `, ${nome}` : ""}:`;
  if (localidade) {
    const antes = p.localidade ? ` em vez ${deTerra(p.localidade)},` : "";
    return `${percebi}${antes} agora é ${emTerra(localidade)}. Faço um pedido novo ${paraTerra(localidade)}?`;
  }
  const antes = p.localidade ? ` já não é ${emTerra(p.localidade)}.` : ` já não é na morada do pedido #${p.id}.`;
  return `${percebi}${antes} Faço um pedido novo para a outra morada?`;
}

/** Disse que é noutro sítio, mas não para onde, e já se perguntou: pede-se a terra. */
export function perguntaDaTerraNova(nome: string | null): string {
  return `Com certeza${nome ? `, ${nome}` : ""}. Diga-me só para que localidade é agora, e faço o pedido novo.`;
}

/** Disse que não: continua-se no pedido de sempre. */
export function continuaNoPedido(p: SitioDoPedido, nome: string | null): string {
  return `Muito bem${nome ? `, ${nome}` : ""}, continuamos com o seu pedido #${p.id}${p.localidade ? `, ${emTerra(p.localidade)}` : ""}.`;
}

/** O começo do pedido novo — o que se diz antes da primeira pergunta do que falta. */
export function comecoDoPedidoNovo(p: SitioDoPedido, localidade: string | null, nome: string | null): string {
  const para = localidade ? paraTerra(localidade) : "para a outra morada";
  return (
    `Combinado${nome ? `, ${nome}` : ""}! Faço já um pedido novo ${para}. ` +
    `O pedido #${p.id} fica de lado — a equipa da CLYON trata de o fechar.`
  );
}

/** A nota que fica no pedido antigo quando o novo nasce — a equipa fecha-o. */
export function notaDaTroca(antigo: number, novo: number): string {
  return `O cliente trocou para o pedido #${novo} (outra morada) — fechar este (#${antigo}).`;
}

/** O começo da nota de «a meio» — a nota final toma-lhe o lugar. */
export const NOTA_DA_TROCA_A_MEIO = "O cliente disse no WhatsApp que já não é aqui:";

/** A nota de enquanto o novo ainda não nasceu. */
export function notaDaTrocaAMeio(p: SitioDoPedido, localidade: string | null): string {
  const para = localidade ? paraTerra(localidade) : "para outra morada";
  return `${NOTA_DA_TROCA_A_MEIO} a Vitória está a fazer um pedido novo ${para}. Quando ele nascer, fechar este (#${p.id}).`;
}

/**
 * A RECOLHA NOVA DE QUEM TROCOU DE SÍTIO — o nome e o serviço do pedido
 * antigo, a terra nova se a disse, e a primeira pergunta do que falta (a
 * morada, o que é para levar, as fotografias…). O telefone é o da conversa.
 */
export function recolhaDoPedidoNovo(
  antigos: DadosDaRecolha,
  troca: TrocaDeSitio,
  p: SitioDoPedido,
  nome: string | null,
): { estado: EstadoDaRecolha; resposta: string } {
  const dados: DadosDaRecolha = { trocouDoPedido: troca.de };
  if (antigos.serviceType) dados.serviceType = antigos.serviceType;
  if (antigos.contactName) dados.contactName = antigos.contactName;
  if (troca.localidade) dados.city = troca.localidade;
  const passo = primeiroPassoEmFalta(dados);
  return {
    estado: { passo, dados },
    resposta: `${comecoDoPedidoNovo(p, troca.localidade, nome)}\n\n${perguntaDo(passo, dados, false)}`,
  };
}
