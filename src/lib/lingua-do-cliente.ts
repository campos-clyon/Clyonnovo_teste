/**
 * A LÍNGUA DE QUEM ESCREVEU.
 *
 * "O bot devia adaptar a língua do cliente, ele está a ignorar que o cliente
 * não sabe português." — 14-09-2026, a olhar para a conversa do Heath.
 *
 * Ele abriu assim: «Apologies, my Portuguese is not very good so I am writing
 * in English.» Pediu o esvaziamento de um T2 em São Marcos, respondeu a tudo
 * em inglês, mandou dezasseis fotografias — e recebeu, de ponta a ponta,
 * «Com quem estou a falar?», «Em que andar é?», «Precisa de factura com NIF?».
 * Chegou a escrever SIM porque lhe disseram para escrever SIM. No fim fez três
 * perguntas — IVA, disponibilidade na sexta, limpeza — e levou de volta um
 * resumo em português.
 *
 * Funcionou por teimosia dele, não por mérito nosso. O que se perde no próximo
 * não se vê: desiste e ninguém fica a saber porquê.
 *
 * ESTE FICHEIRO NÃO FALA COM NINGUÉM — nem base, nem rede. Recebe texto e
 * devolve um palpite. É de propósito: a decisão corre a cada mensagem que
 * entra, e uma decisão que depende de uma chamada é uma decisão que um dia
 * não acontece.
 *
 * O PORTUGUÊS É O PADRÃO, e a dúvida resolve-se a favor dele. Enganarmo-nos
 * para português devolve exactamente o comportamento de hoje; enganarmo-nos
 * para inglês escreve em inglês a uma senhora de Almada. Os dois erros não
 * custam o mesmo, e o desempate segue esse custo.
 */

/** As línguas que sabemos nomear. Fora desta lista, fala-se português. */
export const LINGUAS = ["pt", "en", "es", "fr"] as const;
export type Lingua = (typeof LINGUAS)[number];

export const PORTUGUES: Lingua = "pt";

/** O nome da língua EM PORTUGUÊS — é assim que vai no pedido ao tradutor. */
export const NOME_DA_LINGUA: Record<Lingua, string> = {
  pt: "português de Portugal",
  en: "inglês",
  es: "espanhol",
  fr: "francês",
};

export function linguaValida(v: unknown): v is Lingua {
  return typeof v === "string" && (LINGUAS as readonly string[]).includes(v);
}

/** Só se traduz o que não é português. */
export function precisaDeTraducao(lingua: Lingua | null | undefined): boolean {
  return !!lingua && lingua !== PORTUGUES;
}

/*
 * AS PALAVRAS QUE DENUNCIAM CADA LÍNGUA.
 *
 * Escolhidas por SEREM DE UMA SÓ. «Para», «com», «mas» e «quando» existem em
 * português e em espanhol, e por isso não estão aqui — uma palavra que aparece
 * nas duas listas não desempata nada, só faz barulho.
 *
 * O acento foi tirado antes da comparação, porque um teclado de telemóvel
 * escreve «nao» tantas vezes como «não». Isso custa-nos alguns pares que só o
 * acento separava (o «também» português do «también» espanhol), e é um preço
 * pequeno ao pé de perder metade das mensagens reais.
 */
const MARCAS: Record<Lingua, string[]> = {
  pt: [
    "nao", "sim", "voce", "obrigado", "obrigada", "tambem", "ate", "ja", "ola",
    "sao", "nos", "lhe", "pelo", "pela", "dos", "das", "uma", "um", "muito",
    "preciso", "queria", "quero", "tenho", "fica", "morada", "andar", "predio",
    "elevador", "moveis", "mudanca", "limpeza", "bom", "boa", "tarde", "noite",
    "esta", "estao", "isso", "aqui", "entao", "depois", "agora", "quanto",
    "custa", "pode", "podem", "fazer", "tudo", "casa", "apartamento", "levar",
  ],
  /*
   * «do» saiu desta lista: é inglês e é português («do prédio», «do lado»), e
   * uma palavra que joga dos dois lados dá pontos ao adversário errado.
   */
  en: [
    "the", "and", "is", "are", "was", "you", "your", "for", "with", "this",
    "that", "have", "has", "would", "need", "please", "thanks", "thank", "hi",
    "hello", "my", "it", "to", "in", "on", "at", "from", "can", "could", "will",
    "we", "im", "dont", "apartment", "floor", "building", "cleaning", "quote",
    "price", "removal", "furniture", "available", "there", "about", "all",
    "what", "when", "where", "how", "much", "does", "not", "but", "also",
  ],
  /* «que», «por» e «dias» saíram: são tão portuguesas como espanholas. */
  es: [
    "gracias", "hola", "si", "muy", "pero", "necesito", "tengo", "piso",
    "buenos", "tardes", "nosotros", "ustedes", "tambien", "ahora",
    "cuanto", "cuesta", "puede", "pueden", "hacer", "todo", "casa", "mudanza",
    "limpieza", "muebles", "ascensor", "direccion", "esta", "estan", "los",
    "las", "una", "del", "el", "ella", "usted", "quiero",
  ],
  /* «mais» saiu: em francês é «mas», em português é «more». «bien» saiu por
     ser tão espanhol como francês. */
  fr: [
    "bonjour", "merci", "vous", "je", "nous", "avec", "pour", "dans", "sur",
    "aussi", "oui", "non", "appartement", "etage", "immeuble",
    "demenagement", "nettoyage", "meubles", "ascenseur", "adresse", "combien",
    "pouvez", "faire", "tout", "maison", "les", "des", "est", "une", "cette",
    "quand", "comment", "sil", "plait",
  ],
};

/*
 * As palavras que aparecem em mais do que uma lista não contam para ninguém.
 *
 * «Si» é espanhol e é «se» em francês; «esta» é português e espanhol; «non» é
 * francês e quase «nao». Deixá-las pontuar dava vitórias por empate, que são
 * as piores: ganham por um voto e mandam escrever na língua errada.
 */
const AMBIGUAS = new Set<string>();
{
  const vistas = new Map<string, number>();
  for (const lingua of LINGUAS) {
    for (const p of new Set(MARCAS[lingua])) vistas.set(p, (vistas.get(p) ?? 0) + 1);
  }
  for (const [p, n] of vistas) if (n > 1) AMBIGUAS.add(p);
}

/*
 * Os acentos combinantes, escritos em ESCAPE e não no caractere.
 *
 * A classe certa é U+0300–U+036F. Escrita com os caracteres lá dentro, a
 * regra fica invisível — são marcas que não se vêem no editor — e a primeira
 * edição que passe por cima come-as sem ninguém reparar.
 */
const ACENTOS_COMBINANTES = new RegExp("[\u0300-\u036f]", "g");

/** Sem acentos, sem pontuação, tudo em minúsculas — como o teclado escreve. */
export function palavrasDe(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(ACENTOS_COMBINANTES, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
}

export type Contagem = { lingua: Lingua; pontos: number };

/** Quantas marcas de cada língua há no texto, da mais votada para a menos. */
export function contarMarcas(texto: string): Contagem[] {
  const palavras = palavrasDe(texto);
  const pontos: Record<Lingua, number> = { pt: 0, en: 0, es: 0, fr: 0 };
  for (const p of palavras) {
    if (AMBIGUAS.has(p)) continue;
    for (const lingua of LINGUAS) {
      if (MARCAS[lingua].includes(p)) pontos[lingua] += 1;
    }
  }
  /*
   * O ç e o ão não são palavras, são impressões digitais. Uma mensagem curta
   * — «Não dá, o prédio não tem elevador» — pode ter poucas marcas e ser
   * inequívoca à vista. Estes sinais valem meio ponto cada, com tecto, para
   * ajudarem sem decidirem sozinhos.
   */
  const cru = texto.toLowerCase();
  const digitais = (cru.match(/[çãõáâêéíóôú]|nh|lh|ção|ções/g) ?? []).length;
  pontos.pt += Math.min(digitais, 6) * 0.5;

  return LINGUAS.map((lingua) => ({ lingua, pontos: pontos[lingua] })).sort(
    (a, b) => b.pontos - a.pontos,
  );
}

/**
 * Quantas marcas o vencedor precisa de ter, e quantas vezes o segundo.
 *
 * Dois e o dobro. Abaixo disso é ruído: um «ok» ou um «600» não dizem língua
 * nenhuma, e um nome de sítio — «São Marcos» — chega a dar um ponto ao
 * português dentro de uma frase inglesa inteira.
 */
export const MARCAS_MINIMAS = 2;
export const VANTAGEM_MINIMA = 2;

/**
 * A língua do texto, ou null quando não é evidente.
 *
 * NULL É UMA RESPOSTA, e é a mais comum: quase tudo o que entra é curto. Quem
 * chama guarda o que for evidente e ignora o resto — basta que UMA mensagem da
 * conversa seja clara para a conversa inteira ficar decidida.
 */
export function linguaEvidente(texto: string): Lingua | null {
  if (!texto || !texto.trim()) return null;
  const [primeiro, segundo] = contarMarcas(texto);
  if (!primeiro || primeiro.pontos < MARCAS_MINIMAS) return null;
  const doSegundo = segundo?.pontos ?? 0;
  if (doSegundo > 0 && primeiro.pontos < doSegundo * VANTAGEM_MINIMA) return null;
  return primeiro.lingua;
}

/**
 * Vale a pena guardar esta língua?
 *
 * Só se for evidente E não for português: o português é o padrão e não precisa
 * de ser escrito em lado nenhum. Uma linha a dizer "pt" é uma linha que alguém
 * um dia lê ao contrário.
 */
export function linguaAGuardar(texto: string): Lingua | null {
  const l = linguaEvidente(texto);
  return l && l !== PORTUGUES ? l : null;
}

/** O tecto do título de um botão no WhatsApp. A tradução tem de caber. */
export const TITULO_DO_BOTAO_MAX = 20;
