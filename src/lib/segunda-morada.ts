import { andarNaFrase, semAcentos } from "./leitor-da-recolha";
import { partirMorada } from "./morada-partida";

/**
 * A 2.ª MORADA DE RECOLHA — 29-10-2026 (ordem do CEO, aprovada pelo dono).
 *
 * O caso (moradas inventadas): um pedido de recolha já registado, e a cliente
 * a escrever no WhatsApp «Haverá um segundo lugar de recolha intermédia: Rua
 * das Flores 12, 6.º C, 1400-123 Lisboa». Perdeu-se: não ficou no pedido, e
 * os profissionais propuseram para uma morada só. Pior, uma frase destas lida
 * como as outras dava o 6.º andar à morada PRINCIPAL.
 *
 * Agora a frase reconhece-se ANTES de tudo: a 2.ª morada fica guardada no
 * pedido, entra na descrição como «2.ª paragem» (só a localidade, a zona do
 * código postal, o andar e o elevador — a rua e a porta, como as da morada
 * principal, só as vê quem for escolhido, e ficam com a equipa), e a equipa é
 * avisada de que o preço muda.
 *
 * PURO, sem base de dados: lê-o a Vitória e lê-o o gerador da descrição.
 */

export type SegundaMorada = {
  /** O que o cliente escreveu da morada, tal e qual — para a equipa. Nunca vai para a descrição. */
  dita: string;
  /** A rua e o número, sem o andar. */
  rua: string | null;
  /** `NNNN-NNN`, quando o disse. */
  codigoPostal: string | null;
  localidade: string | null;
  /** Como o pedido grava o andar: "0" rés-do-chão, "-1" cave, "6"… */
  andar: string | null;
  /** O lado ou a letra da porta: «Esq», «Dto», «C». */
  lado: string | null;
  elevador: "yes" | "no" | "small" | null;
};

/*
 * AS FRASES QUE ANUNCIAM UMA 2.ª MORADA. Cada uma com cuidado: «a paragem do
 * autocarro é à porta» fala do acesso, e «outra morada» sozinha pode ser a
 * mesma morada corrigida.
 */
// «casa de banho» não é uma casa; «em segundo lugar» é «depois».
const LUGAR =
  "(?:lugar|local|sitio|morada|endereco|paragem|ponto|casa(?!\\s+de\\s+banho)|apartamento|armazem|garagem|loja|escritorio)";
const DE_RECOLHA = "(?:de|para)\\s+(?:recolha|recolher|carga|carregar|levantar|levantamento|buscar|ir\\s+buscar)";
const ANUNCIOS: RegExp[] = [
  // «um segundo lugar de recolha», «uma segunda morada», «2.ª morada».
  new RegExp(`(?<!\\bem\\s{1,3})\\b(?:segund[oa]|2(?:\\s*\\.?\\s*[ºª]|[oa]))\\s+${LUGAR}\\b`),
  // «outro local de recolha», «mais uma morada para carregar».
  new RegExp(`\\b(?:outr[oa]|mais\\s+uma?)\\s+${LUGAR}\\s+${DE_RECOLHA}\\b`),
  // «recolha intermédia», «uma paragem pelo caminho», «mais uma paragem».
  /\brecolhas?\s+intermedia/,
  /\bparagem\s+(?:intermedia|pelo\s+caminho|a\s+meio)/,
  /\b(?:uma|outra|mais\s+uma|segunda)\s+paragem\b(?!\s+d[eo]s?\s+(?:autocarro|metro|comboio|e?le(?:c)?trico|bus))/,
  // «também recolher em…», «ainda passar na…» — só com uma morada a seguir (ver abaixo).
  /\b(?:tambem|ainda)\s+(?:(?:e\s+preciso|precis\w+(?:\s+de)?|queria|quero|tem\s+de|temos\s+de|ha\s+que|vao|vai)\s+)?(?:recolher|levantar|buscar|ir\s+buscar|carregar|passar)\s+(?:(?:umas?|as|mais|outras?)\s+(?:coisas|moveis|caixas)\s+)?(?:em|na|no|numa|num|a|ao)\s/,
];

/** Os que só contam com uma morada à frente — «também passar na garagem» é a mesma casa. */
const SO_COM_MORADA = new Set([ANUNCIOS.length - 1]);

const TEM_RUA =
  /\b(rua|r\.|avenida|av\.?|travessa|tv\.|largo|praca|praceta|estrada|calcada|beco|alameda|bairro|urbanizacao|urb\.|quinta|lote|azinhaga|vila)\b/;
const TEM_CODIGO_POSTAL = /(?<!\d)\d{4}-\d{3}(?!\d)/;

/** «6.º C», «3º Esq», «2 dto», «r/c B» — a letra ou o lado a seguir ao andar. */
function ladoDaPorta(texto: string): string | null {
  const m = /(?:\d{1,2}\s*\.?\s*[º°ª]|r\/c|r\.c\.?)\s*(?:andar\s*)?[,-]?\s*(esq\w*|dto|dta|dt|dir\w*|frente|fte|frt|[A-Z])(?![\p{L}\d])/iu.exec(texto);
  if (!m) return null;
  const l = m[1];
  if (/^esq/i.test(l)) return "Esq";
  if (/^(dto|dta|dt|dir)/i.test(l)) return "Dto";
  if (/^(frente|fte|frt)$/i.test(l)) return "Frente";
  return l.length === 1 && l === l.toUpperCase() ? l : null;
}

function elevadorDito(texto: string): SegundaMorada["elevador"] {
  const t = semAcentos(texto);
  if (/\b(sem|nao\s+tem|nao\s+ha)\s+elevador\b/.test(t)) return "no";
  if (/\belevador\s+(pequeno|apertado|estreito)\b/.test(t)) return "small";
  if (/\b(com|tem|ha)\s+elevador\b/.test(t)) return "yes";
  return null;
}

/** A rua sem o andar e a porta: «Rua das Flores 12, 6.º C» → «Rua das Flores 12». */
function ruaSemOAndar(rua: string): string {
  return rua
    .replace(/[\s,]+(?:\d{1,2}\s*\.?\s*[º°ª]\s*(?:andar)?|r\/c|r\.c\.?|res[\s-]+do[\s-]+ch[aã]o|cave)(?:\s*[,-]?\s*(?:esq\w*|dto|dta|dt|dir\w*|frente|fte|frt|[A-Z](?![\p{L}\d])))?\.?/giu, "")
    .replace(/[\s,.;-]+$/, "")
    .trim();
}

/** A localidade só até à primeira vírgula, ponto ou parêntese. */
function soALocalidade(l: string | null): string | null {
  if (!l) return null;
  const s = l.split(/[,.;(\n]| - /)[0].trim();
  return s && s.length <= 60 ? s : null;
}

/**
 * A FRASE TRAZ UMA 2.ª MORADA DE RECOLHA? Devolve a morada (com o que se
 * percebeu dela) e o resto do texto, sem a frase da morada — para o resto se
 * ler como sempre, sem o andar da 2.ª ir parar à 1.ª.
 */
export function separarASegundaMorada(
  texto: string,
  /** Numa mudança, «a segunda morada» é o destino: só conta com «recolha», «paragem», «carregar»… */
  servico?: string | null,
): { segunda: SegundaMorada | null; resto: string } {
  const original = (texto ?? "").trim();
  if (!original) return { segunda: null, resto: "" };
  // Linha a linha (uma rajada junta mensagens com quebras de linha).
  const linhas = original.split(/\n+/);
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const t = semAcentos(linha);
    if (servico === "mudanca" && !/recolh|paragem|intermedi|carreg|carga|levant|buscar/.test(t)) continue;
    let achado: RegExpExecArray | null = null;
    let qual = -1;
    for (let k = 0; k < ANUNCIOS.length; k++) {
      const m = ANUNCIOS[k].exec(t);
      if (m) {
        achado = m;
        qual = k;
        break;
      }
    }
    if (!achado) continue;
    // `semAcentos` tira as pontas e baixa as letras, mas não muda o comprimento do meio.
    const desvio = linha.length - linha.trimStart().length;
    const fimDoAnuncio = desvio + achado.index + achado[0].length;
    const depois = linha.slice(fimDoAnuncio);
    // A morada: depois dos dois pontos, se os houver; senão, o que vem a seguir.
    const doisPontos = depois.indexOf(":");
    let morada = (doisPontos >= 0 ? depois.slice(doisPontos + 1) : depois.replace(/^\s*(?:de\s+recolha\s+)?(?:intermedi[aá]\s*)?(?:em|na|no|numa|num|a|ao|é|e|fica)?\s*/i, ""))
      .replace(/^[\s,:;-]+/, "")
      .trim();
    // Uma frase que acaba ali («Haverá um segundo lugar de recolha.») não traz a morada.
    if (/^[.!?]*$/.test(morada)) morada = "";
    const moradaPlana = semAcentos(morada);
    const temMorada = TEM_RUA.test(moradaPlana) || TEM_CODIGO_POSTAL.test(morada);
    if (SO_COM_MORADA.has(qual) && !temMorada) continue;

    const partida = temMorada ? partirMorada(morada.replace(/\s*\n+\s*/g, ", ")) : null;
    const rua = partida?.rua ? ruaSemOAndar(partida.rua) || null : null;
    const segunda: SegundaMorada = {
      dita: (temMorada ? morada : "").replace(/\s+/g, " ").replace(/[\s.]+$/, "").slice(0, 300),
      rua: rua ? rua.slice(0, 200) : null,
      codigoPostal: partida?.codigoPostal ?? null,
      localidade: soALocalidade(partida?.localidade ?? null),
      andar: temMorada ? andarNaFrase(morada) : null,
      lado: temMorada ? ladoDaPorta(morada) : null,
      elevador: elevadorDito(morada || linha),
    };
    const resto = [...linhas.slice(0, i), ...linhas.slice(i + 1)].join("\n").trim();
    return { segunda, resto };
  }
  return { segunda: null, resto: original };
}

/** Só a pergunta: há uma 2.ª morada nesta mensagem? */
export function segundaMoradaNoTexto(texto: string, servico?: string | null): SegundaMorada | null {
  return separarASegundaMorada(texto, servico).segunda;
}

/** É a mesma morada que já estava anotada? Então não se avisa outra vez. */
export function mesmaSegundaMorada(a: SegundaMorada | null | undefined, b: SegundaMorada | null | undefined): boolean {
  if (!a || !b) return false;
  const k = (s: SegundaMorada) => semAcentos(`${s.dita}|${s.codigoPostal ?? ""}|${s.andar ?? ""}`).replace(/[^a-z0-9|]+/g, "");
  return k(a) === k(b);
}

/** «1400» — a zona do código postal, que não identifica ninguém. */
export function zonaDoCodigoPostal(cp: string | null | undefined): string | null {
  const m = /^(\d{4})/.exec((cp ?? "").trim());
  return m ? m[1] : null;
}

/** «6.º andar C», «rés-do-chão», «cave». */
function andarPorExtenso(andar: string | null, lado: string | null): string | null {
  if (andar == null) return null;
  const base = andar === "0" ? "rés-do-chão" : andar === "-1" ? "cave" : `${andar}.º andar`;
  return lado ? `${base} ${lado}` : base;
}

/**
 * A 2.ª PARAGEM PARA O PROFISSIONAL — «Lisboa (1400), 6.º andar C, elevador
 * por confirmar». Sem a rua e a porta: o profissional vê a descrição antes de
 * ser escolhido, e a morada exacta só depois (como a principal).
 */
export function segundaParagemPorExtenso(s: SegundaMorada): string {
  const zona = zonaDoCodigoPostal(s.codigoPostal);
  const onde = s.localidade ? `${s.localidade}${zona ? ` (${zona})` : ""}` : zona ? `código postal ${zona}` : "localidade por confirmar";
  const andar = andarPorExtenso(s.andar, s.lado) ?? "andar por confirmar";
  const elevador =
    s.andar === "0"
      ? null
      : s.elevador === "yes"
        ? "com elevador"
        : s.elevador === "small"
          ? "com elevador pequeno"
          : s.elevador === "no"
            ? "sem elevador"
            : "elevador por confirmar";
  return [onde, andar, elevador].filter(Boolean).join(", ");
}

/** A morada inteira, para a equipa (o histórico e as notas do pedido). */
export function segundaMoradaParaAEquipa(s: SegundaMorada): string {
  return s.dita || segundaParagemPorExtenso(s);
}
