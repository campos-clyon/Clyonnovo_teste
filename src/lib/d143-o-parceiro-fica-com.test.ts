import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  contaDoNovoModelo,
  contaDoRegistoNoNovoModelo,
  contaFecha,
  parceiroFicaCom,
  parceiroRecebeSemIva,
} from "./conta-do-pagamento";

/*
 * d143 (dono, 27-11-2026): a «Conta do pagamento» do modelo de 15-11 diz quanto
 * o PARCEIRO fica — sem IVA, e com o IVA dele quando o tem — e o cabeçalho do
 * cartão da Mesa diz «· parceiro recebe …» ao lado do «Acordada por».
 * Valores inventados.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

describe("d143 — o parceiro fica com", () => {
  const taxas = { cliente: 0, profissional: 0.1 };

  it("com IVA: 270 € a 10 % → 243,00 € sem IVA (298,89 € com o IVA dele)", () => {
    const conta = contaDoNovoModelo(270, taxas, "normal", false)!;
    expect(conta.parceiro).toEqual({ semIva: 243, comIva: 298.89 });
    expect(parceiroFicaCom(conta)).toBe("243,00 € sem IVA (298,89 € com o IVA dele)");
    expect(conta.profissional).toBe(298.89);
    expect(contaFecha(conta)).toBe(true);
  });

  it("isento: só o sem IVA", () => {
    const conta = contaDoNovoModelo(150, taxas, "isento", false)!;
    expect(conta.parceiro).toEqual({ semIva: 135, comIva: null });
    expect(parceiroFicaCom(conta)).toBe("135,00 € sem IVA");
  });

  it("com a reserva do valor único, a base dele não leva a reserva", () => {
    const conta = contaDoNovoModelo(200, taxas, "normal", false, 1500)!;
    expect(conta.parceiro?.semIva).toBe(180);
    expect(parceiroRecebeSemIva(200, taxas, 1500)).toBe(180);
  });

  it("o cabeçalho e a conta dão o mesmo número", () => {
    expect(parceiroRecebeSemIva(270, taxas)).toBe(contaDoNovoModelo(270, taxas, "normal", false)!.parceiro!.semIva);
    expect(parceiroRecebeSemIva(null, taxas)).toBeNull();
  });

  it("registado «pago ao profissional»: o que ficou com ele, sem IVA", () => {
    const conta = contaDoRegistoNoNovoModelo({ recebidoDoCliente: 123, liquido: 90, iva: 0, comissao: 10, total: 33 }, 0.1, false);
    expect(parceiroFicaCom(conta)).toBe("90,00 € sem IVA");
  });

  it("fora do modelo de 15-11, nada", () => {
    expect(parceiroFicaCom(null)).toBeNull();
  });

  it("o componente desenha a linha antes do «Fica para a CLYON», só para a equipa", () => {
    const c = ler("src/components/ContaDoPagamento.tsx");
    expect(c).toContain("mostrarClyon ? parceiroFicaCom(conta) : null");
    expect(c.indexOf("O parceiro fica com:")).toBeGreaterThan(0);
    expect(c.indexOf("O parceiro fica com:")).toBeLessThan(c.indexOf("Fica para a CLYON:"));
  });

  it("o cabeçalho da Mesa diz «parceiro recebe» ao lado do «Acordada por»", () => {
    const p = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(p).toContain("com ${acordada.profissionalNome}${parceiroRecebeNaMesa(acordada, p)}");
    expect(p).toContain("· parceiro recebe ${euros(x)}");
    expect(ler("src/app/api/admin/negociacoes/route.ts")).toContain("reservaCent: reservas.get(Number(n.id))");
  });
});
