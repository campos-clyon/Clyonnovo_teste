/**
 * O VALOR ÚNICO SUGERIDO — 15-11-2026 (d39, parte 1).
 *
 * Numa negociação com várias propostas, o cliente recebe um valor só, sem
 * nomes. Ao «Passar a valor fixo», o valor que aparece escrito por omissão é
 * a mediana das propostas abertas (com duas, a média), arredondada a 5 €. A
 * equipa pode mudá-lo: é só o ponto de partida.
 *
 * Os valores são os que o cliente veria em cada proposta, sem IVA (o
 * `semIva` de `propostasParaOCliente`) — o mesmo número que o valor fixo é.
 */
export function valorUnicoSugerido(valores: readonly number[]): number | null {
  const v = valores.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const meio = Math.floor(v.length / 2);
  const mediana = v.length % 2 === 1 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
  const arredondado = Math.round(mediana / 5) * 5;
  // Uma proposta de 2 € não arredonda para 0: fica nos 5 €.
  return Math.max(5, arredondado);
}
