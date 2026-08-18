/**
 * IBAN — validar antes de gravar, não na véspera de transferir.
 *
 * Um dígito trocado só se descobre quando a transferência é devolvida, dias
 * depois, e nessa altura o profissional já contava com o dinheiro. O resto
 * mod 97 apanha praticamente qualquer engano de digitação no momento em que
 * ainda custa dez segundos a corrigir.
 *
 * Não valida a existência da conta — isso ninguém consegue sem o banco. Valida
 * a forma, que é o que apanha os enganos.
 */

/** Comprimento total do IBAN por país, onde o conhecemos. */
const COMPRIMENTOS: Record<string, number> = {
  PT: 25,
  ES: 24,
  FR: 27,
  DE: 22,
  GB: 22,
  IT: 27,
  NL: 18,
  BE: 16,
  LU: 20,
  IE: 22,
  BR: 29,
  AO: 25,
  CV: 25,
  MZ: 25,
};

export function normalizarIban(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.replace(/[\s-]/g, "").toUpperCase();
}

/** Resto de 97 sobre o IBAN reordenado, calculado aos pedaços. */
function resto97(iban: string): number {
  const rodado = iban.slice(4) + iban.slice(0, 4);
  let resto = 0;
  for (const c of rodado) {
    const n = c >= "A" && c <= "Z" ? String(c.charCodeAt(0) - 55) : c;
    // Pedaço a pedaço: o número inteiro passa dos 2^53 e perdia precisão.
    for (const d of n) resto = (resto * 10 + Number(d)) % 97;
  }
  return resto;
}

export function ibanValido(valor: unknown): boolean {
  const iban = normalizarIban(valor);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  if (iban.length < 15 || iban.length > 34) return false;

  const esperado = COMPRIMENTOS[iban.slice(0, 2)];
  if (esperado != null && iban.length !== esperado) return false;

  return resto97(iban) === 1;
}

/** Em grupos de quatro, como vem impresso no extracto. */
export function formatarIban(valor: unknown): string {
  const iban = normalizarIban(valor);
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * O que se mostra depois de gravado: país, dois dígitos e os últimos quatro.
 *
 * O IBAN completo não precisa de estar no ecrã para o profissional reconhecer a
 * conta dele, e este ecrã abre-se em sítios públicos.
 */
export function ibanEncurtado(valor: unknown): string {
  const iban = normalizarIban(valor);
  if (iban.length < 8) return "";
  return iban.slice(0, 4) + " ···· " + iban.slice(-4);
}
