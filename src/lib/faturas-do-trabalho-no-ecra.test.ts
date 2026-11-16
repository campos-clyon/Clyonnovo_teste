import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contaDaNegociacao, contaDoNovoModelo } from "./conta-do-pagamento";
import { blocoDoTrabalhoFechado, juntaA, linhasDasFaturas, NOME_DA_FATURA_DA_CLYON, NOME_DA_FATURA_DO_PARCEIRO } from "./faturas-do-trabalho-no-ecra";
import { contaDoValorAcordado } from "./pagamento-directo";

/*
 * d49 (16-11-2026) — o quadro das faturas e a «Conta do pagamento» do cartão
 * fechado mostram sempre o mesmo modelo, e as duas linhas têm nome e valor.
 */
const taxas = { cliente: 0, profissional: 0.1 };
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

describe("as duas linhas das faturas", () => {
  it("têm nome e valor, e os valores são os da conta do modelo de 15-11", () => {
    for (const regime of ["normal", "isento"] as const) {
      const linhas = linhasDasFaturas(105.5, taxas, regime)!;
      const c = contaDoValorAcordado(105.5, taxas, regime)!;
      expect(linhas.map((l) => l.deQuem)).toEqual(["parceiro", "clyon"]);
      for (const l of linhas) {
        expect(l.nome.length).toBeGreaterThan(10);
        expect(l.valor).toBeGreaterThan(0);
        expect(l.valorPorExtenso).toMatch(/\d+,\d{2} €/);
        expect(l.quemJunta).not.toBe("");
      }
      expect(linhas[0].nome).toBe(NOME_DA_FATURA_DO_PARCEIRO);
      expect(linhas[0].valor).toBe(c.faturaDoProfissionalCent / 100);
      expect(linhas[1].nome).toBe(NOME_DA_FATURA_DA_CLYON);
      expect(linhas[1].valor).toBe(c.faturaDaClyonCent / 100);
      expect(linhas[1].valorPorExtenso).toContain("com IVA");
      expect(linhas[0].valorPorExtenso).toContain(regime === "isento" ? "isento de IVA" : "com IVA");
    }
  });

  it("a reserva do valor único entra no nome da fatura da CLYON", () => {
    expect(linhasDasFaturas(100, taxas, "normal", 500)![1].nome).toBe(`${NOME_DA_FATURA_DA_CLYON} e reserva`);
  });

  it("sem valor, sem linhas", () => {
    expect(linhasDasFaturas(null, taxas, "normal")).toBeNull();
  });

  it("a data de juntar diz-se pela hora de Lisboa", () => {
    expect(juntaA("2026-11-15T23:30:00.000Z")).toBe("Junta a 15/11");
    expect(juntaA(null)).toBeNull();
  });
});

describe("um modelo só no cartão do trabalho fechado", () => {
  const antiga = contaDaNegociacao({ acordado: 105.5, taxas, modelo: "iva_incluido", emDinheiro: false, comFactura: true, pago: null });
  const nova = contaDoNovoModelo(105.5, taxas, "normal", false)!;
  const linhas = linhasDasFaturas(105.5, taxas, "normal");

  it("o servidor diz modelo novo: a conta do modelo novo e as faturas", () => {
    const b = blocoDoTrabalhoFechado({ novoModelo: true, conta: nova, linhas }, antiga, false);
    expect(b.conta?.novoModelo).toBe(true);
    expect(b.faturas).toHaveLength(2);
    expect(b.conta?.degraus.some((d) => /A pagar ao profissional|A receber do cliente/.test(d.rotulo))).toBe(false);
  });

  it("o servidor diz modelo antigo: a conta antiga e nenhuma fatura, mesmo com a Mesa a dizer novo", () => {
    for (const marca of [false, true]) {
      const b = blocoDoTrabalhoFechado({ novoModelo: false }, antiga, marca);
      expect(b.conta).toBe(antiga);
      expect(b.conta?.novoModelo).toBeUndefined();
      expect(b.faturas).toBeNull();
    }
  });

  it("à espera do servidor: nunca a conta antiga num trabalho que a Mesa marcou como novo", () => {
    expect(blocoDoTrabalhoFechado(null, antiga, true)).toEqual({ conta: null, faturas: null, aLer: true });
    const b = blocoDoTrabalhoFechado(null, antiga, false);
    expect(b.conta).toBe(antiga);
    expect(b.faturas).toBeNull();
  });

  it("em nenhum caso há faturas com a conta antiga", () => {
    for (const doServidor of [null, { novoModelo: false }, { novoModelo: true, conta: nova, linhas }]) {
      for (const marca of [false, true]) {
        const b = blocoDoTrabalhoFechado(doServidor, antiga, marca);
        if (b.faturas) expect(b.conta?.novoModelo).toBe(true);
      }
    }
  });

  it("a Mesa desenha a conta só por este componente, e a rota manda a conta do modelo novo", () => {
    const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa).not.toContain("<ContaDoPagamento conta={conta} />");
    expect(mesa).toContain("contaAntiga={conta}");
    const rota = ler("src/app/api/admin/negociacoes/fatura/route.ts");
    expect(rota).toContain(": contaDoNovoModelo(t.acordado");
    expect(rota).toContain("contaDoRegistoNoNovoModelo(");
    expect(rota).toContain("linhas: linhasDasFaturas(");
    const quadro = ler("src/components/admin/FaturasDoTrabalho.tsx");
    expect(quadro).not.toContain("bg-white");
    expect(quadro).toContain("Juntar fatura");
  });
});
