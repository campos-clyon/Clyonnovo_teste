import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { porPagarAoProfissionalNoSelo } from "./dinheiro-do-trabalho";

/**
 * O SELO DOS PAGAMENTOS NO MENU — d104 (24-11-2026). No modelo de 15-11 o
 * pagamento da negociação é a taxa que o parceiro passou à CLYON: não há nada
 * a pagar ao profissional, e o selo não pode acender com ele.
 */
const pago = "2026-11-20T10:00:00.000Z";

describe("o selo dos Pagamentos: falta pagar ao profissional (d104)", () => {
  it("a taxa paga pelo parceiro no modelo de 15-11 não conta", () => {
    const linhas = [
      { id: 1, formaDePagamento: "na_plataforma", comoEntrou: "multibanco", clientePagouEm: pago, pagoEm: null },
      { id: 2, formaDePagamento: "na_plataforma", comoEntrou: "mbway", clientePagouEm: pago, pagoEm: null },
    ];
    expect(porPagarAoProfissionalNoSelo(linhas, new Set([1, 2]))).toBe(0);
  });

  it("o pagamento do cliente à CLYON no modelo antigo, com o profissional por pagar, conta", () => {
    const linhas = [
      { id: 7, formaDePagamento: "na_plataforma", comoEntrou: "multibanco", clientePagouEm: pago, pagoEm: null },
      { id: 8, formaDePagamento: "na_plataforma", comoEntrou: "mbway", clientePagouEm: pago, pagoEm: null },
    ];
    expect(porPagarAoProfissionalNoSelo(linhas, new Set([8]))).toBe(1);
  });

  it("já pago ao profissional, ou pago em mão, não conta", () => {
    const linhas = [
      { id: 3, formaDePagamento: "na_plataforma", comoEntrou: "multibanco", clientePagouEm: pago, pagoEm: pago },
      { id: 4, formaDePagamento: "dinheiro", comoEntrou: "numerario", clientePagouEm: pago, pagoEm: null },
    ];
    expect(porPagarAoProfissionalNoSelo(linhas, new Set())).toBe(0);
  });

  it("o selo lê o modelo como os Pagamentos (contratadasNoNovoModelo) e conta pela regra do ecrã", () => {
    const db = readFileSync(join(process.cwd(), "src", "lib", "db.ts"), "utf8").replace(/\r\n/g, "\n");
    const inicio = db.indexOf("export async function contarPorFazer(");
    const bloco = db.slice(inicio, db.indexOf("AS FATURAS POR EMITIR", inicio));
    expect(bloco).toContain('await import("./novo-modelo-no-servidor")');
    expect(bloco).toContain("contratadasNoNovoModelo(");
    expect(bloco).toContain("porPagarAoProfissionalNoSelo(");
    expect(bloco).not.toContain("SELECT COUNT(*)");
    const gerir = readFileSync(join(process.cwd(), "src", "lib", "trabalhos-para-gerir.ts"), "utf8");
    expect(gerir).toContain("contratadasNoNovoModelo(");
  });
});
