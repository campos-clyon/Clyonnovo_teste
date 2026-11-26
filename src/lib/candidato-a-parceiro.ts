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

/**
 * d129 (26-11-2026): o que diz SER PARCEIRO não é um cliente, mesmo que fale
 * do serviço que faz («quero ser parceiro para recolha de móveis e fretes»,
 * «quero fazer o meu registo para ser parceiro»). Antes, o «recolha de» calava
 * a regra. A leitura do modelo (`vitoria-agente/intencao.ts`) vem primeiro;
 * isto é a rede quando ele não está.
 */
const QUER_SER_PARCEIRO: RegExp[] = [
  new RegExp(String.raw`\b${QUERO}\s+(?:[\p{L}\d/-]+\s+){0,6}?(?:ser|tornar-me|virar)\s+(?:vosso\s+|um\s+|uma\s+)?parceir[oa]s?\b`, "u"),
  /\b(?:cadastr\w*|regist\w*|inscri\w*|inscrev\w*)\b.{0,40}\bparceir[oa]s?\b/,
];

/** A mensagem é de alguém que quer trabalhar com a CLYON (parceiro, motorista ou ajudante)? */
export function querSerParceiro(texto: string | null | undefined): boolean {
  const t = semAcentos(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 800) return false;
  if (QUER_SER_PARCEIRO.some((re) => re.test(t))) return true;
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
export const MOTIVO_DO_CANDIDATO = "Candidato a parceiro — a Vitória mandou a ligação da candidatura";

/** Já se lhe mandou o caminho da candidatura neste fio (a Vitória não o repete). */
export function jaRecebeuACandidatura(
  mensagens: ReadonlyArray<{ direccao: string; texto: string }>,
): boolean {
  return mensagens.some((m) => m.direccao === "out" && m.texto.includes("clyon.pt/quero-ser-parceiro"));
}

/*
 * ──────────────────────────────────────────────────────────────────────────
 * A CLIENTE QUE VIROU «CANDIDATA» — d129c (26-11-2026, «Erro grave»).
 *
 * Uma cliente (que acabava de falar com a equipa ao telefone) escreveu que
 * queria o «levantamento de alguns imóveis» — quem não é nativo, a dizer
 * recolha de móveis. A Vitória seguiu bem a recolha: o nome, o código postal,
 * o andar, o estacionamento («Há muitos lugares à volta do prédio»)… e aí a
 * leitura do modelo disse «candidato a parceiro». Saiu a candidatura, o
 * rascunho apagou-se e a conversa fechou-se como candidato: o pedido perdeu-se.
 *
 * As regras desde então, por cima do que o modelo disser:
 *   · candidato só com a intenção EXPLÍCITA de trabalhar para/com a CLYON
 *     (`intencaoExplicitaDeParceiro`) — nunca por palavras soltas;
 *   · com passos de cliente já respondidos no rascunho, o cliente ganha; se
 *     ele disser mesmo, por palavras explícitas, que quer ser parceiro,
 *     pergunta-se numa linha (`QUER_PEDIR_OU_SER_PARCEIRO`);
 *   · na dúvida, a mesma pergunta;
 *   · o rascunho NUNCA se apaga por esta leitura: fica, e a conversa vai para
 *     a equipa com o motivo (`MOTIVO_DO_CANDIDATO_COM_RASCUNHO`).
 * ──────────────────────────────────────────────────────────────────────────
 */

/** A intenção explícita de trabalhar para/com a CLYON. Palavras soltas («trabalhar», «lugares», «imóveis») não chegam. */
const EXPLICITA: RegExp[] = [
  ...QUER_SER_PARCEIRO,
  /\b(?:trabalhar|colaborar)\s+(?:convosco|connosco|com\s+voces|para\s+voces|com\s+a\s+clyon|para\s+a\s+clyon|na\s+clyon)\b/,
  /\b(?:trabalhar|colaborar)\s+(?:convosco\s+|com\s+voces\s+|para\s+voces\s+)?como\s+(?:parceir[oa]|motorista|ajudante|prestador|transportador)\b/,
  /\bser\s+(?:vosso\s+|um\s+|uma\s+)?(?:parceir[oa]|motorista|ajudante)\s+(?:da\s+clyon|vosso|de\s+voces|convosco)\b/,
  /\b(?:candidatar-me|candidatura\s+(?:de|a|para)\s+parceir|me\s+candidatar|inscrever-me|inscrevo-me|fazer\s+(?:o\s+)?(?:meu\s+)?(?:registo|cadastro))\b/,
  /\bfazer\s+(?:fretes|recolhas|mudancas|servicos|trabalhos)\s+(?:para\s+(?:voces|vos|a\s+clyon)|convosco)\b/,
  /\b(?:tenho|temos)\s+(?:uma\s+|um\s+)?(?:carrinha|furgao|camiao|carro\s+de\s+caixa)\b.{0,60}\b(?:trabalhar|colaborar|parceir\w*|fretes\s+para)/,
  /\b(?:estao|estão)\s+a\s+(?:contratar|recrutar)\b/,
  /\bprecisam\s+de\s+(?:motoristas?|ajudantes?|parceiros?|mais\s+parceiros)\b/,
  ...PISTAS_EN.slice(0, 2),
  /\bare\s+you\s+(?:hiring|recruiting)\b/,
];

/** Quem escreve diz, por palavras explícitas, que quer trabalhar para/com a CLYON? */
export function intencaoExplicitaDeParceiro(texto: string | null | undefined): boolean {
  const t = semAcentos(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 800) return false;
  return EXPLICITA.some((re) => re.test(t));
}

/** Os dados de cliente que, no rascunho, querem dizer «já respondeu a perguntas da recolha». */
const DADOS_DE_CLIENTE = [
  "contactName",
  "address",
  "postalCode",
  "moradaDestino",
  "codigoPostalDestino",
  "floor",
  "hasElevator",
  "parkingDistance",
  "andarDestino",
  "elevadorDestino",
  "estacionamentoDestino",
  "volumeDito",
  "entulhoQuantidade",
  "quandoTexto",
  "dataDesejada",
  "description",
] as const;

/** Quantos passos de cliente o rascunho já tem respondidos (o serviço sozinho não conta). */
export function passosDeClienteRespondidos(dados: Record<string, unknown> | null | undefined): number {
  if (!dados) return 0;
  return DADOS_DE_CLIENTE.filter((k) => {
    const v = dados[k];
    return v != null && String(v).trim() !== "";
  }).length;
}

/** A pergunta de uma linha, na dúvida. */
export const QUER_PEDIR_OU_SER_PARCEIRO = "Quer pedir um serviço ou trabalhar connosco como parceiro?";

/** Já se lhe fez a pergunta da dúvida (a última mensagem da CLYON)? */
export function perguntouADuvida(mensagens: ReadonlyArray<{ direccao: string; texto: string }>): boolean {
  const saidas = mensagens.filter((m) => m.direccao === "out");
  const ultima = saidas[saidas.length - 1];
  return !!ultima && String(ultima.texto ?? "").includes(QUER_PEDIR_OU_SER_PARCEIRO);
}

/** A resposta à pergunta da dúvida: «parceiro», «cliente», ou null se não se percebe. */
export function escolhaNaDuvida(texto: string | null | undefined): "parceiro" | "cliente" | null {
  const t = semAcentos(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const parceiro = /\b(?:parceir\w*|trabalhar|colaborar|candidat\w*|inscrev\w*|registo|cadastro|motorista|ajudante)\b/.test(t);
  const cliente = /\b(?:servico|pedir|pedido|recolh\w*|levantamento|levar|mudanca|esvaziar|esvaziamento|cliente|orcamento|moveis|imoveis|sou\s+cliente|preciso)\b/.test(t);
  if (parceiro && !cliente) return "parceiro";
  if (cliente && !parceiro) return "cliente";
  return null;
}

export type GuardaDoCandidato = "candidato" | "perguntar" | "cliente" | "equipa";

/**
 * O QUE FAZER QUANDO ALGUÉM PARECE CANDIDATO (pelo modelo ou pela regra). Pura.
 *   · depois da pergunta da dúvida: a escolha dele; sem se perceber, a equipa;
 *   · com passos de cliente respondidos: o cliente ganha — e, se ele disse
 *     mesmo que quer ser parceiro, pergunta-se;
 *   · sem passos: candidato só com a intenção explícita (nesta mensagem ou numa
 *     anterior dele); senão, pergunta-se.
 */
export function guardaDoCandidato(c: {
  texto: string;
  anteriores?: readonly string[];
  passosRespondidos: number;
  perguntouADuvida: boolean;
}): GuardaDoCandidato {
  if (c.perguntouADuvida) {
    const e = escolhaNaDuvida(c.texto);
    if (e === "parceiro") return "candidato";
    if (e === "cliente") return "cliente";
    return "equipa";
  }
  const explicita = intencaoExplicitaDeParceiro(c.texto);
  if (c.passosRespondidos > 0) return explicita ? "perguntar" : "cliente";
  if (explicita || (c.anteriores ?? []).some((t) => intencaoExplicitaDeParceiro(t))) return "candidato";
  return "perguntar";
}

/** Com um rascunho de pedido no número: o rascunho fica e a conversa vai à equipa com este porquê. */
export const MOTIVO_DO_CANDIDATO_COM_RASCUNHO =
  "Candidato a parceiro — recebeu a candidatura, mas havia um pedido a meio (o rascunho ficou guardado): confirmar se é cliente";

/** Na dúvida que ficou por resolver: uma pessoa vê. */
export const MOTIVO_DA_DUVIDA_CLIENTE_OU_CANDIDATO = "Cliente ou candidato a parceiro? A Vitória não percebeu — ver (o rascunho ficou guardado)";
