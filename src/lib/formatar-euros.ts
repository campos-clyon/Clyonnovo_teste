/**
 * UM VALOR EM EUROS, ESCRITO COMO SE ESCREVE EM PORTUGAL.
 *
 * A área do cliente mostrava «123.45 €» — o ponto decimal do `toFixed`, que é
 * a notação inglesa. Aqui a vírgula é a decimal e o ponto (ou o espaço) separa
 * os milhares: «123.45» lê-se, à letra, como cento e vinte e três mil.
 *
 * O `Intl` faz a conta toda — a vírgula, o símbolo depois do número e o
 * espaço que não parte a linha entre os dois. Em pt-PT os números de quatro
 * algarismos NÃO levam separador de milhares («1234,56 €»); a partir de cinco
 * leva («12 345,67 €»). É a norma, e não um defeito.
 *
 * Vazio, texto que não é número ou NaN dão «—»: um «NaN €» ou um «0,00 €» no
 * lugar de um valor que não existe diria ao cliente uma coisa falsa.
 *
 * Há dezenas de `euros()` locais pelo repositório, cada uma com a sua ideia.
 * Esta é a partilhada; as outras ficam como estão até alguém lhes mexer.
 */
const FORMATO = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

export function formatarEuros(v: number | string | null | undefined): string {
  if (v == null) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return FORMATO.format(n);
}
