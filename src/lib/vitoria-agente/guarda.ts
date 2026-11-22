/**
 * A GUARDA DOS € (e do resto) DA VITÓRIA AGENTE — d85, fase 0. PURO.
 *
 * Nenhum texto do agente chega a um cliente sem passar por aqui. Bloqueia:
 *
 *  1. um valor em euros que não veio de um resultado de ferramenta DESTA
 *     conversa (o preço de um pedido vem das propostas; a referência vem do
 *     que o site sabe — o modelo nunca o inventa nem o calcula);
 *  2. um preço «sem IVA» / «+ IVA» sem o valor com IVA ao lado;
 *  3. «profissional» — ao cliente diz-se «parceiro»;
 *  4. palavras do Brasil (é português de Portugal);
 *  5. as promessas e frases proibidas de sempre (`motivoParaBloquear`: no
 *     próprio dia, contentores, big bags, IA ou virtual, a CLYON a fazer o
 *     trabalho, percentagens que não são o IVA).
 *
 * Um texto bloqueado não sai: volta-se às regras de sempre.
 */

import { motivoParaBloquear } from "../licoes-da-vitoria";
import { eurosNoTexto } from "../o-que-o-site-sabe";

/** As chaves numéricas que trazem euros nos resultados das ferramentas. */
const CHAVE_DE_EUROS = /(valor|preco|preço|total|iva|euro|minimo|mínimo|maximo|máximo|desde|pagar|custo)/i;

/**
 * OS EUROS QUE AS FERRAMENTAS DERAM nesta conversa: os escritos nos textos
 * («40 € + IVA (49,20 € com IVA)») e os números das chaves de dinheiro.
 */
export function eurosDosResultados(resultados: readonly unknown[]): number[] {
  const out = new Set<number>();
  const juntar = (v: number) => {
    if (Number.isFinite(v) && v > 0) out.add(Math.round(v * 100) / 100);
  };
  const andar = (v: unknown, chave: string, fundo: number) => {
    if (fundo > 8 || v == null) return;
    if (typeof v === "string") {
      for (const e of eurosNoTexto(v)) juntar(e);
      return;
    }
    if (typeof v === "number") {
      if (CHAVE_DE_EUROS.test(chave)) juntar(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) andar(x, chave, fundo + 1);
      return;
    }
    if (typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) andar(x, k, fundo + 1);
    }
  };
  for (const r of resultados) andar(r, "", 0);
  return [...out];
}

const PALAVRAS_DO_BRASIL = /(?<!\p{L})(voc[eê]s?|celular(es)?|equipe|cadastr\p{L}*|[oô]nibus|caminh[aã]o|banheiro|geladeira)(?!\p{L})/iu;

/** Tira os valores em euros (já conferidos) antes da guarda geral, que só conhece os preços do site. */
function semOsEuros(texto: string): string {
  const NUM = String.raw`\d{1,3}(?:[  ]\d{3})+(?:,\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
  return texto
    .replace(new RegExp(String.raw`(${NUM})(?:\s*(?:€|euros?)?\s*(?:–|-|a|até)\s*(${NUM}))?\s*(?:€|euros?\b|eur\b)`, "gi"), "[valor] €")
    .replace(new RegExp(String.raw`€\s*(${NUM})`, "g"), "€ [valor]");
}

/**
 * O PORQUÊ DE NÃO DEIXAR SAIR ESTE TEXTO, ou null se pode sair. `eurosPermitidos`
 * são os de `eurosDosResultados` desta conversa.
 */
export function motivoParaBloquearOAgente(texto: string | null | undefined, eurosPermitidos: readonly number[]): string | null {
  const t = String(texto ?? "").trim();
  if (!t) return "Sem texto.";
  if (t.length > 1200) return "Texto longo de mais para o WhatsApp.";

  for (const v of eurosNoTexto(t)) {
    if (!eurosPermitidos.some((p) => Math.abs(p - v) < 0.011)) {
      return `Tem ${String(v).replace(".", ",")} €, que não veio de nenhuma ferramenta desta conversa.`;
    }
  }
  const semIva = /(\+\s*IVA\b|\bsem\s+IVA\b|\bs\/\s*IVA\b|\bIVA\s+[àa]\s+parte\b)/i.test(t);
  const comIva = /(\bcom\s+IVA\b|\bIVA\s+inclu[ií]do\b|\bisento\s+de\s+IVA\b)/i.test(t);
  if (semIva && !comIva) return "Um preço sem IVA sozinho — diz-se sempre também o valor com IVA.";
  if (/\bprofissiona(l|is)\b/i.test(t)) return "Ao cliente diz-se «parceiro» (a palavra antiga não se usa).";
  const brasil = PALAVRAS_DO_BRASIL.exec(t);
  if (brasil) return `«${brasil[0]}» não é português de Portugal.`;
  return motivoParaBloquear(semOsEuros(t));
}
