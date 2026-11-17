/**
 * OS PREÇOS DE ANTES DA d60 — uma só fonte. 17-11-2026 (d62/d63).
 *
 * A d60 (16-11-2026) mudou a recolha mínima, a primeira peça grande, o
 * esvaziamento por tipologia, a moradia, a hora de referência das mudanças e
 * os km incluídos. Os números velhos não voltam em lado nenhum:
 *
 * - o teste da orquestra lê `PRECOS_ANTES_DA_D60` em todos os textos de src/;
 * - a guarda das lições e das respostas livres da Vitória
 *   (`motivoParaBloquear`, em licoes-da-vitoria.ts) lê `precoDeAntesDaD60`,
 *   que junta àquelas as duas frases que só a conversa costuma dizer: a peça
 *   grande ao preço das seguintes sem a primeira, e a moradia abaixo do «desde»
 *   que o site publica.
 *
 * Os números certos vêm de `precos-publicos.ts` e de `tabela-das-mudancas.ts`;
 * aqui só se reconhece o que já não vale. ESTE FICHEIRO É PURO.
 */
import { ESVAZIAMENTO_POR_TIPOLOGIA, PRECO_DA_PRIMEIRA_GRANDE, PRECO_POR_ITEM } from "./precos-publicos";

/** A recolha mínima de antes (hoje é a de `RECOLHA_MINIMA_DOS_MOVEIS`); o entulho dos 10 sacos («40 – 48 €») fica. */
export const RECOLHA_MINIMA_A_40 = /m[íi]nim[ao](?: de)? 40\s?€(?!\s?[–-])/iu;
/** A hora de referência de antes, sem ou com IVA. */
export const HORA_A_50 = /(?<![\d.,])(?:50|61,50)(?:,00)?\s?€\s?(?:\+ ?IVA\s?|s\/IVA\s?|com IVA\s?)?(?:\/\s?h(?:ora)?(?![a-zà-ú])|por hora)/iu;
/** As faixas velhas do esvaziamento (T2, T3/T4) e a moradia de antes. */
export const ESVAZIAMENTO_ANTIGO = /(?<![\d.,])(?:320\s?[–-]\s?420|380\s?[–-]\s?450)(?!\d)|desde 450\s?€/u;
/** Os km incluídos de antes. */
export const RAIO_DE_50_KM = /(?:até|acima de|mais de|primeiros) 50\s?km/iu;

/** As quatro regras que o teste da orquestra aplica a todos os textos de src/. */
export const PRECOS_ANTES_DA_D60: readonly RegExp[] = [RECOLHA_MINIMA_A_40, HORA_A_50, ESVAZIAMENTO_ANTIGO, RAIO_DE_50_KM];

/** O «desde» da moradia que o site publica (o piso abaixo do qual uma moradia não se diz). */
export const MORADIA_DESDE: number = ESVAZIAMENTO_POR_TIPOLOGIA.find((t) => t.chave === "moradia")?.minimo ?? 0;

const NUM = String.raw`\d+(?:,\d{1,2})?`;
const lerNum = (s: string) => Number(s.replace(",", "."));
const n = (v: number) => (Number.isInteger(v) ? `${v}(?:,00)?` : v.toFixed(2).replace(".", ","));

/** «grande(s) … N €» com N o preço das seguintes — numa frase que não diz a primeira nem que é um item a mais. */
const GRANDE_AO_PRECO_DAS_SEGUINTES = new RegExp(
  String.raw`grandes?\b[^.;!?\n]{0,15}?(?<![\d.,])${n(PRECO_POR_ITEM.grande)}\s?€`,
  "iu",
);

/** A frase diz a primeira grande, as seguintes, ou que é um item a mais ou um extra no local (esses contam como as seguintes)? */
function frasePodeDizerASeguinte(frase: string): boolean {
  const primeira = new RegExp(String.raw`(?<![\d.,])${n(PRECO_DA_PRIMEIRA_GRANDE)}\s?€`, "u");
  return primeira.test(frase) || /\bseguintes?\b|\ba mais\b|\bmais uma\b|\bmais coisas\b|\bextras?\b/iu.test(frase);
}

/** «moradia … N €» com N abaixo do «desde» publicado (sem contar o «1 107» dos milhares com espaço). */
const MORADIA_COM_VALOR = new RegExp(
  String.raw`moradias?\b[^.;!?\n]{0,40}?(?<![\d.,]|\d[  ])(${NUM})\s?(?:€|euros?\b)`,
  "giu",
);

function frases(texto: string): string[] {
  return texto.split(/(?<=[.;!?])\s+|\n+/u).filter((f) => f.trim());
}

/**
 * O MOTIVO, SE O TEXTO DIZ UM PREÇO DE ANTES DA d60 — ou null.
 * Lido pela guarda das lições e das respostas livres da Vitória.
 */
export function precoDeAntesDaD60(texto: string): string | null {
  const t = String(texto ?? "");
  if (!t.trim()) return null;
  if (RECOLHA_MINIMA_A_40.test(t)) return "Diz a recolha mínima de antes da d60 — o site mudou-a.";
  if (HORA_A_50.test(t)) return "Diz a hora das mudanças de antes da d60 — o site mudou-a.";
  if (ESVAZIAMENTO_ANTIGO.test(t)) return "Diz uma faixa do esvaziamento de antes da d60 — o site mudou-a.";
  if (RAIO_DE_50_KM.test(t)) return "Diz os km incluídos de antes da d60 — o site mudou-os.";
  for (const f of frases(t)) {
    if (GRANDE_AO_PRECO_DAS_SEGUINTES.test(f) && !frasePodeDizerASeguinte(f)) {
      return `Diz a peça grande a ${PRECO_POR_ITEM.grande} € sem a primeira a ${PRECO_DA_PRIMEIRA_GRANDE} € — o preço de antes da d60.`;
    }
    for (const m of f.matchAll(MORADIA_COM_VALOR)) {
      if (lerNum(m[1]) < MORADIA_DESDE) return `Diz a moradia abaixo de ${MORADIA_DESDE} € — o preço de antes da d60.`;
    }
  }
  return null;
}
