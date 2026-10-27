/**
 * A FILA «FATURAS POR EMITIR» — 27-10-2026 (d16).
 *
 * Um pagamento confirmado (pelo aviso do euPago, pela consulta à mão ou pela
 * rotina de hora a hora) que leva fatura entra aqui, e sai quando alguém, nos
 * Pagamentos, diz que a fatura foi emitida. Fica no selo dos Pagamentos
 * enquanto houver alguma.
 *
 * Conta só a partir de `FATURA_POR_EMITIR_DESDE`: o que foi pago antes já teve
 * a fatura tratada à mão, e enchia a fila de falsos pendentes.
 *
 * Num ficheiro à parte porque o lêem dois lados — `pagamentos-na-base.ts` (a
 * lista) e `db.ts` (o selo) — e um não pode importar o outro.
 */
export const FATURA_POR_EMITIR_DESDE = "2026-10-27 00:00:00";

export const SQL_DAS_FATURAS_POR_EMITIR = `
  FROM pagamentos
 WHERE estado = 'pago'
   AND comFactura = 1
   AND deTeste = 0
   AND metodo IN ('mbway', 'multibanco')
   AND faturaEmitidaEm IS NULL
   AND pagoEm >= '${FATURA_POR_EMITIR_DESDE}'`;
