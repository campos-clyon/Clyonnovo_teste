import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { quantoOClientePaga } from "./eupago";
import { contaDoCliente } from "./taxas-plataforma";

/**
 * OS PAGAMENTOS NA APP DE CLIENTE, PONTA A PONTA — verificação de 30-10-2026
 * (ordem do CEO com o sim do dono, parte B). A app usa as mesmas rotas e o
 * mesmo estado do site; o que faltava era o sem IVA ao lado do valor com IVA.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

describe("o valor que a app mostra", () => {
  it("com IVA incluído: o mesmo número que se pede ao banco, e o sem IVA ao lado", () => {
    const taxas = { cliente: 0, profissional: 11 } as never;
    const comIva = quantoOClientePaga(350, taxas, "iva_incluido", true);
    const semIva = quantoOClientePaga(350, taxas, "sem_iva", false);
    expect(comIva).toBe(contaDoCliente(350, taxas).total);
    expect(semIva).toBe(contaDoCliente(350, taxas).semIva);
    expect(semIva).toBeLessThan(comIva);
    const fonte = ler("src/lib/pedidos-do-cliente.ts");
    expect(fonte).toContain('const semIva = quantoOClientePaga(acesso.trabalho.acordado, acesso.trabalho.taxas, "sem_iva", false);');
    expect(fonte).toContain("e.ivaIncluido ? `${emEuros(comIva)} (${emEuros(semIva)} sem IVA)` : emEuros(comIva)");
    expect(fonte).toContain("valoresTexto: { comFactura: comIvaESemIva(e.valores.comFactura), semFactura: emEuros(e.valores.semFactura) },");
  });

  it("«Copiar» o valor copia só o número que o banco pede", () => {
    expect(ler("app-cliente/src/componentes/Pagar.tsx")).toContain('valor.split(" (")[0].replace(/\\s/g, "")');
  });
});

describe("as mesmas rotas e o mesmo estado do site", () => {
  it("a app cria o pagamento em POST /api/pagamentos, como o site", () => {
    expect(ler("app-cliente/src/componentes/Pagar.tsx")).toContain('await pedir("/api/pagamentos", {');
    expect(ler("src/components/PagarTrabalho.tsx")).toContain("/api/pagamentos");
  });
  it("o estado vem de estadoDoPagamentoParaOCliente nas duas", () => {
    expect(ler("src/lib/pedidos-do-cliente.ts")).toContain("const e = await estadoDoPagamentoParaOCliente(acesso.trabalho);");
    expect(ler("src/app/api/pagamentos/route.ts")).toContain("pagamento-para-o-cliente");
  });
  it("a porta do cliente continua fechada em produção (só o backoffice cobra)", () => {
    expect(ler("src/lib/pagamento-na-plataforma.ts")).toContain("export const A_PLATAFORMA_COBRA = false;");
  });
});
