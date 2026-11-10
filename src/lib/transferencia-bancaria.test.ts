import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LIMITE_DA_TRANSFERENCIA,
  chegaParaTransferencia,
  contaLimpa,
  descritivoDaTransferencia,
  ibanAgrupado,
  ibanValido,
  transferenciaParaOCliente,
} from "./transferencia-bancaria";

/**
 * TRANSFERÊNCIA BANCÁRIA A PARTIR DE 700 € COM IVA — 02-11-2026 (dono).
 *
 * IBAN de exemplo de documentação (não é de ninguém da CLYON): o repositório é
 * público e o IBAN verdadeiro vive só nas Configs.
 */
const IBAN_DE_EXEMPLO = "PT50 0002 0123 1234 5678 9015 4";
const CONTA = { iban: "PT50000201231234567890154", titular: "Empresa de exemplo" };

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("o limite", () => {
  it("é 700 € com IVA, num sítio só", () => {
    expect(LIMITE_DA_TRANSFERENCIA).toBe(700);
    expect(chegaParaTransferencia(699.99)).toBe(false);
    expect(chegaParaTransferencia(700)).toBe(true);
    expect(chegaParaTransferencia(861)).toBe(true);
  });

  it("nenhum outro ficheiro escreve o 700 da transferência à mão", () => {
    for (const f of [
      "src/lib/pagamento-para-o-cliente.ts",
      "src/app/api/pagamentos/route.ts",
      "src/components/PagarTrabalho.tsx",
      "src/components/admin/AdminContaDaTransferenciaPanel.tsx",
    ]) {
      // «700 €», «700)», «>= 700» — não as classes de cor (slate-700).
      expect(ler(f), f).not.toMatch(/(?<!-)\b700\s*(€|\)|;|,)|[<>]=?\s*700\b/);
    }
  });
});

describe("o IBAN", () => {
  it("confere pelo módulo 97, com ou sem espaços", () => {
    expect(ibanValido(IBAN_DE_EXEMPLO)).toBe(true);
    expect(ibanValido(IBAN_DE_EXEMPLO.replace(/\s/g, "").toLowerCase())).toBe(true);
  });

  it("um dígito trocado não passa", () => {
    expect(ibanValido("PT50 0002 0123 1234 5678 9015 5")).toBe(false);
    expect(ibanValido(IBAN_DE_EXEMPLO.slice(0, -2))).toBe(false);
    expect(ibanValido("")).toBe(false);
  });

  it("mostra-se de quatro em quatro", () => {
    expect(ibanAgrupado(CONTA.iban)).toBe(IBAN_DE_EXEMPLO);
  });

  it("sem titular, ou com o IBAN errado, não há conta", () => {
    expect(contaLimpa({ iban: IBAN_DE_EXEMPLO, titular: "  " })).toBeNull();
    expect(contaLimpa({ iban: "PT50 1", titular: "X" })).toBeNull();
    expect(contaLimpa(JSON.stringify(CONTA))).toEqual(CONTA);
    expect(contaLimpa("não é json")).toBeNull();
  });
});

describe("o que o cliente vê", () => {
  const base = { conta: CONTA, totalComIva: 861, totalSemIva: 700, pedidoId: 512, pago: false, doCliente: true };

  it("a partir de 700 € com IVA e com conta: IBAN, titular, com e sem IVA, «Pedido #N»", () => {
    expect(transferenciaParaOCliente(base)).toEqual({
      iban: IBAN_DE_EXEMPLO,
      titular: "Empresa de exemplo",
      valor: 861,
      valorSemIva: 700,
      descritivo: "Pedido #512",
      limite: 700,
    });
    expect(descritivoDaTransferencia(7)).toBe("Pedido #7");
  });

  it("abaixo do limite, sem conta, já pago ou dívida do parceiro: não aparece", () => {
    expect(transferenciaParaOCliente({ ...base, totalComIva: 699.99 })).toBeNull();
    expect(transferenciaParaOCliente({ ...base, conta: null })).toBeNull();
    expect(transferenciaParaOCliente({ ...base, pago: true })).toBeNull();
    expect(transferenciaParaOCliente({ ...base, doCliente: false })).toBeNull();
  });
});

describe("o IBAN nunca no código, e só o administrador o vê", () => {
  it("a rota das Configs é só do administrador, nos dois sentidos", () => {
    const rota = ler("src/app/api/admin/conta-da-transferencia/route.ts");
    expect(rota.match(/requireAdminGeral\(req\)/g)?.length).toBe(2);
    expect(rota).not.toContain("requireAdmin(req)");
  });

  it("a página de pagar não carrega a transferência sem o servidor a oferecer", () => {
    const ecra = ler("src/components/PagarTrabalho.tsx");
    expect(ecra).toContain("estado.transferencia && !transferenciaPendente");
  });

  it("o «Recebido» e o aviso do euPago avisam o parceiro pelo mesmo caminho", () => {
    // O do euPago passa por `avisarQueOPagamentoEntrou` (10-11-2026, d26), o mesmo da conferência.
    expect(ler("src/app/api/pagamentos/webhook/route.ts")).toContain("await avisarQueOPagamentoEntrou(p);");
    expect(ler("src/lib/avisar-pagamento-recebido.ts")).toContain("avisarProfissionalClientePagouPorPush(");
    expect(ler("src/app/api/admin/pagamentos/recebido/route.ts")).toContain("avisarProfissionalClientePagouPorPush(");
  });
});
