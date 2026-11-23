import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lucroDoTrabalho, detalheDaComissao } from "./assistentes";
import { eTrabalhoClyon, lerMotivoDoAdiantamento, podePagarAoProfissional } from "./pagar-antes-do-cliente";

/*
 * d5 de 22/11/2026 — o profissional recebe depois do cliente, e as perdas contam
 * no lucro do período. Dados de teste: nenhum nome, telefone ou morada.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("d5 (1) o «Pagar ao profissional» de um Trabalho CLYON só depois de o cliente pagar", () => {
  const clyon = { valorFixoClyon: "250.00" };

  it("antes de o cliente pagar, sem motivo, recusa", () => {
    expect(podePagarAoProfissional({ ...clyon, clientePagouEm: null }, undefined)).toEqual({ ok: false, precisaDeMotivo: true });
    expect(podePagarAoProfissional({ ...clyon, clientePagouEm: null }, "  ")).toEqual({ ok: false, precisaDeMotivo: true });
    expect(podePagarAoProfissional({ ...clyon, clientePagouEm: null }, "ab")).toEqual({ ok: false, precisaDeMotivo: true });
  });

  it("antes de o cliente pagar, com motivo escrito, passa e o motivo fica para o registo", () => {
    expect(podePagarAoProfissional({ ...clyon, clientePagouEm: null }, "  O cliente  vai pagar amanhã ")).toEqual({
      ok: true,
      adiantadoPor: "O cliente vai pagar amanhã",
    });
  });

  it("depois de o cliente pagar, é livre", () => {
    expect(podePagarAoProfissional({ ...clyon, clientePagouEm: new Date() }, undefined)).toEqual({ ok: true, adiantadoPor: null });
  });

  it("fora dos Trabalhos CLYON a regra de sempre", () => {
    expect(podePagarAoProfissional({ clientePagouEm: null }, undefined)).toEqual({ ok: true, adiantadoPor: null });
    expect(eTrabalhoClyon({ ofertaClyon: "  " })).toBe(false);
    expect(eTrabalhoClyon({ ofertaClyon: "oferta" })).toBe(true);
    expect(lerMotivoDoAdiantamento("x".repeat(500))?.length).toBe(300);
  });

  it("as duas rotas que marcam o pagamento passam pela regra", () => {
    for (const f of ["src/app/api/admin/pagamentos/pago-ao-profissional/route.ts", "src/app/api/admin/carteiras/route.ts"]) {
      const t = ler(f);
      expect(t, f).toContain("podePagarAoProfissional(");
      expect(t, f).toContain("pedeMotivo: true");
      expect(t.indexOf("podePagarAoProfissional("), f).toBeLessThan(t.indexOf("UPDATE negociacoes SET pagoEm = NOW()"));
    }
  });
});

describe("d5 (2) o lucro do período desconta os trabalhos com resultado negativo", () => {
  // Um Trabalho CLYON de 250 € ao profissional, sem taxa: o cliente acordou pagar 150 €.
  const comAcordo = { id: 591, status: "concluido", valorAcordado: 250, taxaCliente: 0, taxaProfissional: 0, valorFixoClyon: 250, precoClienteClyon: 250, acordoFinalCliente: 150 };

  it("um acordo final abaixo do que o profissional recebeu conta a perda: −100 €, e não 0", () => {
    const r = lucroDoTrabalho(comAcordo);
    expect(r.lucro).toBe(-100);
    expect(r.valor).toBe(150);
  });

  it("o mesmo num pedido pela plataforma (sem Trabalho CLYON)", () => {
    const r = lucroDoTrabalho({ id: 1, status: "concluido", valorAcordado: 200, taxaCliente: 0, taxaProfissional: 0.1, acordoFinalCliente: 120 });
    // O profissional recebeu 180; o cliente paga 120: a CLYON suporta 60.
    expect(r.lucro).toBe(-60);
  });

  it("sem acordo, a conta de sempre", () => {
    const sem = lucroDoTrabalho({ ...comAcordo, acordoFinalCliente: null });
    expect(sem.lucro).toBe(0);
    const normal = lucroDoTrabalho({ id: 2, status: "concluido", valorAcordado: 200, taxaCliente: 0, taxaProfissional: 0.1 });
    expect(normal.lucro).toBe(20);
  });

  it("a parte da sócia (40 %) sai do lucro com a perda dentro: 40 % de (100 − 100) e não de 100", () => {
    const bom = { id: 3, status: "concluido", valorAcordado: 1000, taxaCliente: 0, taxaProfissional: 0.1 };
    const antes = detalheDaComissao([bom], 40);
    expect(antes.totais.lucro).toBe(100);
    expect(antes.totais.comissaoAssistente).toBe(40);
    const depois = detalheDaComissao([bom, comAcordo], 40);
    expect(depois.totais.lucro).toBe(0);
    expect(depois.totais.comissaoAssistente).toBe(0);
    // O que dava 40 € a mais: contar a perda como zero.
    const comoDantes = detalheDaComissao([bom, { ...comAcordo, acordoFinalCliente: null, valorFixoClyon: null, valorAcordado: null }], 40);
    expect(comoDantes.totais.comissaoAssistente).toBe(40);
  });

  it("as consultas dos períodos leem a coluna do acordo", () => {
    const t = ler("src/lib/assistentes.ts");
    expect((t.match(/n\.acrescimoPagamento, n\.acordoFinalCliente,/g) ?? []).length).toBe(2);
  });
});
