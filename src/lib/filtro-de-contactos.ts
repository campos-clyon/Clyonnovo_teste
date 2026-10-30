/**
 * O FILTRO DE CONTACTOS NAS CONVERSAS — 30-10-2026 («Conversas», fase 1).
 *
 * Decisão do dono (2a): nas conversas de um pedido, entre o cliente e o
 * parceiro, os contactos ficam tapados — mesmo depois do pagamento. O
 * telefone de quem vai fazer o trabalho está na ficha do pedido; no chat não.
 *
 * Tapa: telefones portugueses (9 dígitos a começar por 2 ou 9, com +351 ou
 * 00351, com espaços, pontos ou hífens, e por extenso — «nove um dois…»),
 * números internacionais, emails (também «arroba» e «ponto com»), links e
 * domínios, e @utilizador. Não tapa: preços, datas, horas, códigos postais,
 * n.º de pedido, quantidades.
 *
 * PURO: sem base, sem rede. O original guarda-se à parte (`textoOriginal`),
 * e só a equipa o vê.
 */

export const CONTACTO_ESCONDIDO = "[contacto escondido — a CLYON guarda o acordo e o pagamento]";

export type TextoFiltrado = {
  /** O que o outro lado lê. */
  texto: string;
  /** Houve alguma coisa tapada. */
  filtrada: boolean;
  /** O texto como foi escrito — só para a equipa. */
  original: string;
};

const PALAVRAS_DE_DIGITO: Record<string, string> = {
  zero: "0",
  um: "1",
  uma: "1",
  dois: "2",
  duas: "2",
  tres: "3",
  quatro: "4",
  cinco: "5",
  seis: "6",
  sete: "7",
  oito: "8",
  nove: "9",
};

function semAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* Marcadores para o que se protege enquanto se procura (caracteres privados). */
const ABRE = "\uE000";
const FECHA = "\uE001";
const MARCA = "\uE002";
/** O n.º de um protegido, contado em marcas (sem dígitos, para a procura não os ler). */
const UM = "\uE003";

/**
 * O que parece número mas não é contacto: datas, horas, dinheiro, códigos
 * postais, n.º de pedido, medidas. Sai do caminho antes da procura dos
 * telefones e volta no fim, tal como estava.
 */
const PROTEGIDOS: RegExp[] = [
  /\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/g, // datas
  /\b\d{1,2}\s?[:h]\s?\d{2}\b/gi, // horas
  /\b\d{4}-\d{3}\b/g, // código postal
  /#\s?\d+/g, // n.º do pedido
  /\d+(?:[.,]\d+)?\s?(?:€|eur\b|euros?\b)/gi, // dinheiro
  /€\s?\d+(?:[.,]\d+)?/g,
  /\b\d+(?:[.,]\d+)?\s?(?:m2|m3|m²|m³|kg|km|cm|mm|m)\b/gi, // medidas
  /\b\d+(?:[.,]\d+)?\s?%/g,
];

function proteger(texto: string): { texto: string; guardados: string[] } {
  const guardados: string[] = [];
  let t = texto;
  for (const re of PROTEGIDOS) {
    t = t.replace(re, (m) => {
      guardados.push(m);
      return `${ABRE}${UM.repeat(guardados.length)}${FECHA}`;
    });
  }
  return { texto: t, guardados };
}

function repor(texto: string, guardados: string[]): string {
  const re = new RegExp(`${ABRE}(${UM}+)${FECHA}`, "g");
  // Duas voltas: um protegido pode ter ficado dentro de outro.
  let t = texto;
  for (let i = 0; i < 2; i++) t = t.replace(re, (_, n: string) => guardados[n.length - 1] ?? "");
  return t;
}

const EMAIL =
  /[\p{L}\d._%+-]+\s*(?:@|\(\s*at\s*\)|\[\s*at\s*\]|\s+arroba\s+)\s*[\p{L}\d-]+(?:\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+ponto\s+)\s*[a-z]{2,})+/giu;
const LINK = /\b(?:https?:\/\/|www\.)\S+/gi;
const DOMINIO =
  /\b[\p{L}\d][\p{L}\d-]*(?:\.[\p{L}\d-]+)*\.(?:com|pt|net|org|io|me|br|eu|info|app|link|ly|co|biz|site|online|store|fr|es|uk)\b(?:\/\S*)?/giu;
const UTILIZADOR = /(^|[\s(,;:])@[\p{L}\d._]{2,}/gu;

/** Um pedaço de número: dígitos ou um dígito por extenso. */
const TOKEN = "(?:\\d+|zero|uma?|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)";
/** Entre pedaços, no máximo um separador curto (espaço, ponto, hífen, vírgula, parênteses). */
const SEP = "(?:[\\s.\\-–,()]{1,3})";
const SEQUENCIA = new RegExp(`(?:\\+|\\b00)?\\b${TOKEN}\\b(?:${SEP}\\b${TOKEN}\\b)*`, "gi");

function digitosDe(run: string): { digitos: string; temPalavra: boolean; temPrefixo: boolean } {
  const temPrefixo = /^\s*(?:\+|00)/.test(run);
  let digitos = "";
  let temPalavra = false;
  for (const p of run.toLowerCase().match(/\d+|[a-z]+/g) ?? []) {
    if (/^\d+$/.test(p)) digitos += p;
    else if (PALAVRAS_DE_DIGITO[p]) {
      digitos += PALAVRAS_DE_DIGITO[p];
      temPalavra = true;
    }
  }
  return { digitos, temPalavra, temPrefixo };
}

/** Esta sequência de números é um telefone? */
export function pareceTelefone(run: string): boolean {
  const { digitos, temPalavra, temPrefixo } = digitosDe(semAcentos(run));
  if (temPrefixo && digitos.length >= 9) return true; // +351…, 00351…, internacional
  if (digitos.startsWith("351") && digitos.length >= 12) return true;
  if (digitos.length >= 9 && /^[29]/.test(digitos)) return true; // 9xx xxx xxx, 2xx xxx xxx
  if (temPalavra && digitos.length >= 9) return true; // por extenso
  if (digitos.length >= 10) return true;
  return false;
}

function taparTelefones(texto: string): string {
  // A procura faz-se sobre o texto sem acentos («três» → «tres»), com o mesmo
  // comprimento; o que se tapa corta-se no texto verdadeiro.
  const base = semAcentos(texto);
  if (base.length !== texto.length) {
    // Raro (caracteres compostos): procura-se no próprio texto.
    return texto.replace(SEQUENCIA, (m) => (pareceTelefone(m) ? MARCA : m));
  }
  let saida = "";
  let ultimo = 0;
  for (const m of base.matchAll(SEQUENCIA)) {
    const i = m.index ?? 0;
    if (!pareceTelefone(m[0])) continue;
    saida += texto.slice(ultimo, i) + MARCA;
    ultimo = i + m[0].length;
  }
  return saida + texto.slice(ultimo);
}

/**
 * Tapa os contactos de um texto livre. O resultado nunca é mais comprido do
 * que precisa: marcas seguidas juntam-se numa só.
 */
export function filtrarContactos(original: string): TextoFiltrado {
  const texto0 = String(original ?? "");
  let t = texto0;
  t = t.replace(EMAIL, MARCA);
  t = t.replace(LINK, (m) => (/clyon\.pt/i.test(m) ? m : MARCA));
  t = t.replace(UTILIZADOR, (_m, antes: string) => `${antes}${MARCA}`);
  t = t.replace(DOMINIO, (m) => (/^(?:www\.)?clyon\.pt\b/i.test(m) ? m : MARCA));
  const { texto: protegido, guardados } = proteger(t);
  t = repor(taparTelefones(protegido), guardados);
  const filtrada = t.includes(MARCA);
  if (!filtrada) return { texto: texto0, filtrada: false, original: texto0 };
  const junto = t.replace(new RegExp(`${MARCA}(?:[\\s.,;:/\\-–]*${MARCA})+`, "g"), MARCA);
  return { texto: junto.split(MARCA).join(CONTACTO_ESCONDIDO), filtrada: true, original: texto0 };
}
