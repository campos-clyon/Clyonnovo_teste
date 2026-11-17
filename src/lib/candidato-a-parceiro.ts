import { concelhoDoCodigoPostal, concelhoDoTexto, type IdDoConcelho } from "./concelhos-da-cobertura";

/*
 * QUEM QUER SER PARCEIRO, MOTORISTA OU AJUDANTE — 17-11-2026 (decisão d69).
 *
 * Na Mesa do WhatsApp havia 17 conversas por responder, e 3 eram candidatos
 * (um em inglês) à espera de uma pessoa há 1 a 22 dias, no meio dos clientes.
 * Quem escreve a querer trabalhar com a CLYON recebe logo o caminho da
 * candidatura — a página de candidatura, com `?zona=` quando se sabe a zona
 * (d16) — e o aviso de que as fotografias da carrinha são obrigatórias (d17).
 * A conversa fecha-se como «candidato a parceiro» e sai da fila dos clientes
 * por responder; se ele voltar a escrever, reabre-se (`reabertaDepoisDoFecho`).
 *
 * Sem entulho e sem promessas de trabalho (d18): só o caminho.
 *
 * O que NÃO é um candidato: o cliente que precisa de um motorista ou de um
 * ajudante para o trabalho dele («preciso de um ajudante para carregar»). Só a
 * primeira pessoa a querer trabalhar, candidatar-se ou ser parceiro, ou a
 * pergunta «estão a contratar?».
 *
 * Puro: chama-o o cérebro do WhatsApp (`whatsapp-negociacao.ts`), e os testes.
 */

const semAcentos = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const QUERO = String.raw`(?:quero|queria|quer[ií]amos|queremos|gostaria|gostar[ií]amos|gostava|pretendo|pretendia|estou\s+interessad[oa]|estamos\s+interessad[oa]s|tenho\s+interesse|temos\s+interesse|posso|podemos|procuro|procuramos|estou\s+a\s+procura|ando\s+a\s+procura)`;
const TRABALHAR = String.raw`(?:(?:em\s+|de\s+|para\s+)?(?:trabalhar|colaborar)\s+(?:convosco|com\s+voc[eê]s|para\s+voc[eê]s|com\s+a\s+clyon|para\s+a\s+clyon|na\s+clyon|como\s+(?:motorista|ajudante|parceir[oa]|prestador|transportador)|em\s+parceria)|(?:em\s+|de\s+)?ser\s+(?:vosso\s+|um\s+|uma\s+)?(?:parceir[oa]|motorista|ajudante|prestador)|(?:de\s+)?(?:me\s+)?candidatar|(?:fazer\s+)?parte\s+da\s+(?:vossa\s+)?equipa|(?:um\s+)?(?:emprego|trabalho)\s+(?:como\s+)?(?:de\s+)?(?:motorista|ajudante)|(?:me\s+)?(?:registar|inscrever)(?:-me)?\s+como\s+(?:parceir[oa]|profissional|motorista|ajudante))`;

const PISTAS_PT: RegExp[] = [
  new RegExp(String.raw`\b${QUERO}\s+(?:muito\s+)?${TRABALHAR}`),
  /\b(?:candidatura|candidatar-me|candidato\s+a\s+(?:parceiro|motorista|ajudante))\b/,
  /\b(?:estao|estão)\s+a\s+(?:contratar|recrutar)\b/,
  /\bprecisam\s+de\s+(?:motoristas?|ajudantes?|parceiros?|pessoal|colaboradores|mais\s+parceiros)\b/,
  /\b(?:tem|t[eê]m|ha)\s+vagas?\b/,
  /\bvagas?\s+(?:de|para)\s+(?:motorista|ajudante|parceiro)/,
  /\b(?:procuro|procuramos|estou\s+a\s+procura\s+de|ando\s+a\s+procura\s+de)\s+(?:um\s+)?(?:emprego|trabalho)\b/,
  /\bpreciso\s+de\s+(?:um\s+)?emprego\b/,
  /\btenho\s+(?:uma\s+)?(?:carrinha|furgao|camiao|carrinha\s+de\s+caixa)\b.*\b(?:trabalh|colabor|parceir|servic)/,
];

const PISTAS_EN: RegExp[] = [
  /\b(?:i|we)(?:'d| would)?\s+(?:like|want|love)\s+to\s+(?:work|partner)\s+(?:with|for)\s+(?:you|clyon)\b/,
  /\b(?:i|we)\s+(?:want|would like)\s+to\s+(?:become|be)\s+(?:a\s+)?(?:partner|driver|helper)\b/,
  /\b(?:looking\s+for|need)\s+(?:a\s+)?(?:job|work)\b/,
  /\bare\s+you\s+(?:hiring|recruiting)\b/,
  /\b(?:job|work)\s+as\s+(?:a\s+)?(?:driver|helper|mover)\b/,
  /\bapply\s+(?:as|to\s+be|for)\b/,
];

/** Quem fala do trabalho dele, ou do preço, é um cliente — mesmo que diga «motorista». */
const DE_CLIENTE = /\b(orcamento|quanto\s+custa|preco|valor|recolher|recolha\s+de|levar\s+(?:o|a|os|as|um|uma)|mudanca\s+de\s+casa|preciso\s+de\s+(?:um|uma)\s+(?:motorista|ajudante))\b/;

/** A mensagem é de alguém que quer trabalhar com a CLYON (parceiro, motorista ou ajudante)? */
export function querSerParceiro(texto: string | null | undefined): boolean {
  const t = semAcentos(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 800) return false;
  if (DE_CLIENTE.test(t)) return false;
  return PISTAS_PT.some((re) => re.test(t)) || PISTAS_EN.some((re) => re.test(t));
}

/** A zona, quando se sabe: pelo código postal ou pela terra no que ele escreveu. */
export function zonaDoCandidato(textos: readonly string[]): IdDoConcelho | null {
  for (const t of [...textos].reverse()) {
    const z = concelhoDoCodigoPostal(t, true) ?? concelhoDoTexto(t);
    if (z) return z;
  }
  return null;
}

/** O link da candidatura, com a zona quando se sabe. */
export function linkDaCandidatura(zona: IdDoConcelho | null): string {
  return `https://clyon.pt/quero-ser-parceiro${zona ? `?zona=${zona}` : ""}`;
}

export const OBRIGADA_PELO_INTERESSE = "Obrigada pelo interesse em trabalhar com a CLYON! 😊";
export const AS_FOTOGRAFIAS_DA_CARRINHA =
  "Na candidatura juntam-se 1 a 4 fotografias da carrinha, que são obrigatórias. A equipa da CLYON vê a candidatura e fala consigo.";

/** A resposta, em três linhas. Tem tradução fixa (traducoes-fixas-da-vitoria.json). */
export function respostaAoCandidato(zona: IdDoConcelho | null): string {
  return [
    OBRIGADA_PELO_INTERESSE,
    `A candidatura de parceiro faz-se no site, em poucos minutos: ${linkDaCandidatura(zona)}`,
    AS_FOTOGRAFIAS_DA_CARRINHA,
  ].join("\n");
}

/** O porquê do fecho na Mesa das conversas — sai da fila dos clientes. */
export const MOTIVO_DO_CANDIDATO = "Candidato a parceiro — a Vitória mandou o link da candidatura";

/** Já se lhe mandou o caminho da candidatura neste fio (a Vitória não o repete). */
export function jaRecebeuACandidatura(
  mensagens: ReadonlyArray<{ direccao: string; texto: string }>,
): boolean {
  return mensagens.some((m) => m.direccao === "out" && m.texto.includes("clyon.pt/quero-ser-parceiro"));
}
