import { ESVAZIAMENTO_DE_EMPRESA } from "./esvaziamento-de-empresa";

/*
 * «PARECE UM ESVAZIAMENTO» — 15-11-2026 (d43).
 *
 * Quem pede a recolha de nove móveis, de três divisões ou «da casa toda da
 * minha mãe» está a pedir um esvaziamento — e, pedido como recolha peça a
 * peça, recebe propostas para uma parte e não para o espaço todo. O
 * simulador pergunta uma vez, e a pessoa decide. Com sim, o pedido passa ao
 * esvaziamento de casa, ou ao de armazém/escritório/loja quando o texto fala
 * de um espaço de empresa.
 *
 * Só nas recolhas de móveis e de monos: nas outras o serviço já é o certo.
 */

export const PERGUNTA_DO_ESVAZIAMENTO =
  "Parece um esvaziamento — quer que os parceiros orcem o espaço todo, com tudo incluído?";

/** Mais do que isto, na lista das peças, já é um esvaziamento. */
export const PECAS_ATE_SER_ESVAZIAMENTO = 8;
/** A partir de tantas divisões. */
export const DIVISOES_DO_ESVAZIAMENTO = 3;

/** As palavras que dizem «esvaziamento» (a ordem d43). */
export const PALAVRAS_DO_ESVAZIAMENTO = ["casa toda", "herança", "mudança", "arrendar", "armazém", "escritório", "loja"] as const;
/** Como se procuram: sem acentos, pelo começo da palavra («arrend» apanha arrendar e arrendamento). */
const RAIZES = ["casa toda", "heranc", "mudanc", "arrend", "armazen", "armazem", "escritorio", "loja"] as const;
const RAIZES_DA_EMPRESA = ["armazem", "armazen", "escritorio", "loja"] as const;

const SERVICOS_ONDE_SE_PERGUNTA: ReadonlySet<string> = new Set(["recolha_moveis", "recolha_monos"]);

const semAcentos = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const temPalavra = (texto: string, palavra: string) =>
  new RegExp(`(^|[^a-z])${palavra.replace(/ /g, "\\s+")}`).test(texto);

/** Quantas divisões o texto diz («3 divisões», «4 quartos», «T3» não conta: é a tipologia). */
export function divisoesDoTexto(texto: string): number {
  const t = semAcentos(texto);
  let maior = 0;
  for (const m of t.matchAll(/(\d+)\s*(divisoes|divisao|quartos|assoalhadas|salas)/g)) maior = Math.max(maior, Number(m[1]));
  return maior;
}

export interface SinaisDoPedido {
  servico: string | null | undefined;
  /** As peças da lista (pequenas + médias + grandes), ou a quantidade escrita. */
  pecas?: number;
  texto?: string | null;
}

/**
 * O serviço para onde o pedido passaria — `esvaziamento_casa` ou
 * `esvaziamento_empresa` —, ou `null` quando não parece um esvaziamento.
 */
export function pareceUmEsvaziamento(s: SinaisDoPedido): "esvaziamento_casa" | typeof ESVAZIAMENTO_DE_EMPRESA | null {
  if (!s.servico || !SERVICOS_ONDE_SE_PERGUNTA.has(s.servico)) return null;
  const texto = semAcentos(s.texto ?? "");
  const daEmpresa = RAIZES_DA_EMPRESA.some((p) => temPalavra(texto, p));
  const pelasPalavras = RAIZES.some((p) => temPalavra(texto, p));
  const pelasPecas = (s.pecas ?? 0) > PECAS_ATE_SER_ESVAZIAMENTO;
  const pelasDivisoes = divisoesDoTexto(texto) >= DIVISOES_DO_ESVAZIAMENTO;
  if (!pelasPalavras && !pelasPecas && !pelasDivisoes) return null;
  return daEmpresa ? ESVAZIAMENTO_DE_EMPRESA : "esvaziamento_casa";
}
