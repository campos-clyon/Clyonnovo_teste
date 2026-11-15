import { describe, expect, it } from "vitest";
import { SQL_AVALIACAO_QUE_CONTA, SQL_PAGAMENTO_DO_CLIENTE, SQL_PAGO_PELA_PLATAFORMA } from "./avaliacao-que-conta";

/*
 * d28 (CEO e dono, 15-11-2026) — a taxa paga pelo próprio parceiro deixa de
 * contar como prova de trabalho pago para a avaliação contar. Só o pagamento
 * do cliente (ou o contacto verificado e diferente, d10/d16).
 */
describe("d28 — a taxa do parceiro não prova um trabalho verdadeiro", () => {
  const pago = SQL_PAGO_PELA_PLATAFORMA("n");
  const doCliente = SQL_PAGAMENTO_DO_CLIENTE("pgv", "n");

  it("o «pago pela plataforma» só aceita a linha do cliente", () => {
    expect(pago).toContain(doCliente);
  });

  it("tira a referência da dívida do parceiro", () => {
    expect(doCliente).toContain("COALESCE(pgv.parte, 'trabalho') <> 'divida'");
  });

  it("tira o dinheiro com IVA incluído (o que entra é a dívida dele), pela data de 02-10", () => {
    expect(doCliente).toMatch(/NOT \(n\.formaDePagamento = 'dinheiro' AND n\.createdAt >= '2026-10-01 23:00:00'\)/);
  });

  it("tira as linhas do trabalho do modelo de 15-11, fora dos Trabalhos CLYON e do corte", () => {
    expect(doCliente).toContain("n.ofertaClyon IS NULL");
    expect(doCliente).toContain("pgv.criadoEm >= '2026-11-15 00:00:00'");
    // Pago pelo cliente antes da data, o trabalho fica no antigo — e a linha conta.
    expect(doCliente).toMatch(/NOT EXISTS \(SELECT 1 FROM pagamentos pga[\s\S]*pga\.pagoEm < '2026-11-15 00:00:00'/);
    // Fechado antes da data, também.
    expect(doCliente).toContain("n.confirmadoEm IS NULL OR n.confirmadoEm >= '2026-11-15 00:00:00'");
  });

  it("o contacto verificado continua a ser a outra prova", () => {
    const r = SQL_AVALIACAO_QUE_CONTA();
    expect(r).toContain(pago);
    expect(r).toContain("n.avaliacaoContactoVerificado = 1");
  });

  it("os parênteses fecham (a expressão entra num WHERE)", () => {
    for (const s of [pago, doCliente, SQL_AVALIACAO_QUE_CONTA()]) {
      expect(s.split("(").length).toBe(s.split(")").length);
    }
  });
});
