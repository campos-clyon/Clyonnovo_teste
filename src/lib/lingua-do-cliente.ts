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
    "falo", "fala", "falam",
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
    /*
     * 28-10-2026 (decisão d35): as respostas curtas de quem fala inglês a
     * meio do registo — «Yes like 50 meters», «But needs dismantling», «so
     * how does it work now?». Nenhuma destas é palavra portuguesa sem acento
     * («so» ficou de fora: é o «só»; «total» também, que é igual cá).
     */
    "yes", "speak", "english", "work", "now", "of", "be", "just", "like",
    "needs", "value", "meters", "metres", "bed", "mattress", "dismantle",
    "dismantling", "pickup", "collect", "collection", "stairs", "lift",
    "elevator", "parking", "van", "door", "street", "invoice", "tomorrow",
    "today", "morning", "afternoon", "evening", "week", "next", "ideally",
    "latest", "monday", "tuesday", "wednesday", "thursday", "friday",
    "saturday", "sunday", "or", "if", "i", "us",
  ],
  /* «que», «por» e «dias» saíram: são tão portuguesas como espanholas. */
  es: [
    "gracias", "hola", "si", "muy", "pero", "necesito", "tengo", "piso",
    "buenos", "tardes", "nosotros", "ustedes", "tambien", "ahora",
    "cuanto", "cuesta", "puede", "pueden", "hacer", "todo", "casa", "mudanza",
    "limpieza", "muebles", "ascensor", "direccion", "esta", "estan", "los",
    "las", "una", "del", "el", "ella", "usted", "quiero",
    "hablas", "habla", "hablan", "espanol", "manana", "colchon",
  ],
  /* «mais» saiu: em francês é «mas», em português é «more». «bien» saiu por
     ser tão espanhol como francês. */
  fr: [
    "bonjour", "merci", "vous", "je", "nous", "avec", "pour", "dans", "sur",
    "aussi", "oui", "non", "appartement", "etage", "immeuble",
    "demenagement", "nettoyage", "meubles", "ascenseur", "adresse", "combien",
    "pouvez", "faire", "tout", "maison", "les", "des", "est", "une", "cette",
    "quand", "comment", "sil", "plait",
    "parlez", "parles", "francais", "anglais", "maintenant", "demain",
    "matelas", "fonctionne", "parle", "pas",
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

/* ────────────────────────────────────────────────────────────────────────────
 * A LÍNGUA REVISTA A CADA MENSAGEM — 28-10-2026 (decisão d35).
 *
 * O cliente escreveu a primeira mensagem em português, e a seguir «Do you
 * speak English?». A Vitória respondeu «Boa pergunta! Deixo-a anotada para uma
 * pessoa da CLYON» e continuou em português; ele respondeu tudo em inglês, e a
 * língua só ficou decidida à quinta mensagem («How much is the total value?»)
 * — e nunca mais mudava, porque a primeira que ficava, ficava para sempre.
 *
 * Agora cada mensagem que entra pode mudar a língua da conversa, mas só por
 * duas portas: o cliente PEDE outra língua («Do you speak English?»,
 * «Parlez-vous français?», «Fala português?»), ou escreve nela de forma CLARA
 * — três palavras ou mais, com as marcas da língua, tirada a morada. Um «ok»,
 * um «yes» ou um «Sim, 3.º andar» não mudam nada. Se o cliente voltar ao
 * português, volta-se ao português.
 * ──────────────────────────────────────────────────────────────────────────── */

/** O texto como o teclado o escreve, com os espaços — para as frases. */
function chaveDe(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(ACENTOS_COMBINANTES, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/*
 * OS PEDIDOS DE LÍNGUA, frase a frase. A língua é a que ele PEDE, seja em que
 * língua pergunte: «Falam inglês?» é inglês, «Do you speak Portuguese?» é
 * português.
 */
/*
 * «I don't speak Portuguese» NÃO é um pedido de português — é inglês, e
 * decide-o a contagem das marcas (`linguaClara`). A negação tira a frase dos
 * pedidos.
 */
const NEGA_A_LINGUA =
  /\b(dont|do not|cant|cannot|can not|not)\s+(speak|talk|understand|write)\b|\bmy portuguese is( not|nt)\b|\bne\s+(parle|comprends)\s+pas\b|\bno\s+(hablo|entiendo)\b|\bnao\s+(falo|percebo|entendo)\b/;

const PEDIDOS_DE_LINGUA: Array<[RegExp, Lingua]> = [
  [/\b(speak|talk|write|understand|continue|reply|answer)\b.*\benglish\b|\benglish\s+(please|pls|plz)\b|^(in\s+)?english\s*(please|pls)?$|\b(pode|podemos|podia|prefiro|preferia|por favor)\b.*\bem ingles\b|\bem ingles\b.*\b(pode|podemos|por favor)\b|\b(fala|falam|falas|fale)\s+(em\s+)?ingles\b|\bparle[sz]?\s+(vous\s+)?anglais\b|\bhabla[sn]?\s+(usted\s+)?ingles\b/, "en"],
  [/\b(speak|talk|write)\b.*\bfrench\b|\bparle[sz]?\s+(vous\s+|tu\s+)?(le\s+)?francais\b|\bvous\s+parlez\s+(le\s+)?francais\b|\ben francais\s*(svp|sil vous plait|please)?$|\b(fala|falam|falas)\s+(em\s+)?frances\b|\bhabla[sn]?\s+(usted\s+)?frances\b/, "fr"],
  [/\b(speak|talk|write)\b.*\bspanish\b|\bhabla[sn]?\s+(usted\s+)?espanol\b|\ben espanol\s*(por favor)?$|\b(fala|falam|falas)\s+(em\s+)?espanhol\b|\bparle[sz]?\s+(vous\s+)?espagnol\b/, "es"],
  [/\b(speak|talk|write)\b.*\bportuguese\b|\b(fala|falam|falas)\s+(em\s+)?portugues\b|\bem portugues\s*(por favor|se faz favor|pode ser)?$|\bparle[sz]?\s+(vous\s+)?portugais\b|\bhabla[sn]?\s+(usted\s+)?portugues\b/, "pt"],
];

/** As frases de um texto: as linhas, e dentro delas o que acaba em . ! ? */
export function frasesDoTexto(texto: string): string[] {
  return texto
    .split(/\n+/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+/))
    .map((f) => f.trim())
    .filter(Boolean);
}

/** A língua que a frase PEDE — ou null. */
function linguaPedidaNaFrase(frase: string): Lingua | null {
  const c = chaveDe(frase);
  if (!c || NEGA_A_LINGUA.test(c)) return null;
  for (const [re, lingua] of PEDIDOS_DE_LINGUA) if (re.test(c)) return lingua;
  return null;
}

/**
 * O cliente PEDIU uma língua? «Do you speak English?» → "en". A última que
 * pediu, se pediu duas; null se não pediu nenhuma. Nunca é «pergunta para uma
 * pessoa»: a resposta é sim, e passa-se a falar nela.
 */
export function linguaPedida(texto: string): Lingua | null {
  let pedida: Lingua | null = null;
  for (const f of frasesDoTexto(texto ?? "")) pedida = linguaPedidaNaFrase(f) ?? pedida;
  return pedida;
}

/** «Hi», «Hiii», «Hello», «Olá», «Bonjour» — um cumprimento, e mais nada. */
export function eSoCumprimento(frase: string): boolean {
  const c = chaveDe(frase);
  return /^(h+i+|hey+|hello+|hallo|hiya|ola+|oi+|bom dia|boa tarde|boa noite|boas|bonjour|bonsoir|salut|hola+|buenos dias|buenas tardes|buenas noches|good (morning|afternoon|evening))( (there|all|everyone|clyon|vitoria))?$/.test(
    c,
  );
}

/**
 * O texto sem o pedido de língua e sem os cumprimentos soltos — o que sobra
 * para ler como resposta. Vazio quando ele só pediu a língua.
 */
export function semPedidoDeLingua(texto: string): string {
  return (texto ?? "")
    .split(/\n+/)
    .map((linha) =>
      linha
        .split(/(?<=[.!?])\s+/)
        .filter((f) => f.trim() && !linguaPedidaNaFrase(f) && !eSoCumprimento(f))
        .join(" ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

/*
 * A MORADA NÃO DIZ A LÍNGUA DE QUEM ESCREVE. «Rua dos Choupos Brancos 17, 3
 * andar» é português escrito por um inglês — é o nome da rua. Corta-se a linha
 * a partir da palavra de rua, e o código postal com o que vem a seguir.
 */
const DE_RUA =
  /\b(rua|r|avenida|av|travessa|tv|largo|praca|estrada|calcada|beco|alameda|rotunda|urbanizacao|urb|bairro|azinhaga|vila|patio|pateo|lote)\b.*$/;

function semMoradas(texto: string): string {
  return texto
    .split(/\n+/)
    .map((l) => chaveDe(l.replace(/\d{4}\s*-?\s*\d{3}.*$/, "")).replace(DE_RUA, ""))
    .join("\n");
}

/** Palavras mínimas para uma mensagem decidir a língua sozinha. */
export const PALAVRAS_PARA_MUDAR = 3;

/**
 * A língua em que a mensagem está escrita de forma CLARA — ou null.
 * Três palavras ou mais (tirada a morada), com as marcas de `linguaEvidente`.
 */
export function linguaClara(texto: string): Lingua | null {
  const limpo = semMoradas(texto ?? "");
  if (palavrasDe(limpo).length < PALAVRAS_PARA_MUDAR) return null;
  return linguaEvidente(limpo);
}

/**
 * A LÍNGUA DEPOIS DESTA MENSAGEM — a nova, se mudou; null se fica a mesma.
 * `actual` null quer dizer português (o padrão mora na ausência).
 */
export function linguaDepoisDaMensagem(texto: string, actual: Lingua | null | undefined): Lingua | null {
  const agora: Lingua = actual ?? PORTUGUES;
  const nova = linguaPedida(texto) ?? linguaClara(texto);
  if (!nova || nova === agora) return null;
  return nova;
}

/** O tecto do título de um botão no WhatsApp. A tradução tem de caber. */
export const TITULO_DO_BOTAO_MAX = 20;
