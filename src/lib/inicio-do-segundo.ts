/**
 * O instante sem as fracções do segundo — como um DATETIME o guarda.
 *
 * O MySQL ARREDONDA as fracções ao gravar num DATETIME sem casas: 12:00:00,7
 * fica 12:00:01. Um corte das sessões gravado assim ficava um segundo à frente
 * do token que se emite na mesma resposta, e quem mudou a palavra-passe saía
 * também. Corta-se antes de gravar (25-10-2026).
 */
export function inicioDoSegundo(d: Date = new Date()): Date {
  return new Date(Math.floor(d.getTime() / 1000) * 1000);
}
