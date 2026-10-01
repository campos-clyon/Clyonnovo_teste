import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { quotaDaClyon } from "./quota-da-clyon";
import { taxasParaAForma } from "./forma-de-pagamento";
import { DIAS_ATE_LIBERTAR_SOZINHO, libertaSozinho } from "./trabalho";
import { oQueSeDesfaz } from "./cancelamento";

/**
 * OS TERMOS DE 01-10-2026 — «Publicar já», decisão do dono.
 *
 * Os Termos são o documento a que se recorre quando há desacordo. Estes testes
 * guardam duas coisas: que os números do contrato vêm de onde o site os lê
 * (e não escritos à mão), e que o que o contrato promete sobre o cancelamento
 * e a confirmação automática é o que o código faz.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const TERMOS = ler("src/app/termos/page.tsx");
const CODIGO = semNotas(TERMOS);

describe("os números dos Termos vêm das constantes", () => {
  it("a quota, a taxa do dinheiro, o tecto, o prazo, o IVA e quem factura", () => {
    expect(CODIGO).toContain("quotaDaClyon(taxas)");
    expect(CODIGO).toContain("await taxasActuais()");
    // A taxa do dinheiro de ANTES do IVA incluído — só na frase de transição.
    expect(CODIGO).toMatch(/taxasParaAForma\("dinheiro", taxas, "sem_iva"\)/);
    expect(CODIGO).toContain("{IVA_INCLUIDO_DESDE_POR_EXTENSO}");
    expect(CODIGO).toContain("MAXIMO_EM_NUMERARIO");
    expect(CODIGO).toContain("{DIAS_ATE_LIBERTAR_SOZINHO}");
    expect(CODIGO).toContain("TAXA_IVA");
    expect(CODIGO).toContain("ENTIDADE_QUE_FACTURA.nomeLegal");
    expect(CODIGO).toContain("ENTIDADE_QUE_FACTURA.nif");
    expect(CODIGO).toContain("IDENTIFICACAO.regimeIva");
  });

  it("e as percentagens de origem já não são o contrato", () => {
    expect(CODIGO).not.toContain("TAXA_CLIENTE");
    expect(CODIGO).not.toContain("TAXA_PROFISSIONAL");
  });

  it("com as taxas em vigor desde 29-09-2026, a CLYON fica com 11 %", () => {
    expect(quotaDaClyon({ cliente: 0.05, profissional: 0.0655 })).toBeCloseTo(0.11, 6);
    // Em dinheiro, as duas partes passam para o cliente.
    expect(taxasParaAForma("dinheiro", { cliente: 0.05, profissional: 0.0655 }, "sem_iva")).toEqual({
      cliente: 0.1155,
      profissional: 0,
    });
  });
});

describe("o que saiu, e o que entrou", () => {
  it("saem as frases do modelo antigo e a plataforma europeia de litígios", () => {
    for (const frase of [
      "plataforma europeia",
      "só lhe propomos profissionais",
      "não recebe nem detém",
      "emite a fatura",
      "fatura-lhe",
      "21 de agosto de 2026",
      // Brasileirismo — em PT-PT é «em menos de» ou «no prazo de».
      "em até",
    ]) {
      expect(CODIGO, frase).not.toContain(frase);
    }
  });

  it("entram a data, o 7-A e o prazo da devolução", () => {
    expect(CODIGO).toContain("Última atualização: 1 de outubro de 2026.");
    expect(CODIGO).toContain('["cancelamento", "7-A. Cancelamento e reembolso"]');
    expect(CODIGO).toContain("const DIAS_PARA_DEVOLVER = 14;");
    expect(CODIGO).toContain("em menos de 24 horas");
  });
});

describe("os Termos batem com o código", () => {
  it("a confirmação automática: 7 dias a contar das fotografias, e não do fecho", () => {
    expect(DIAS_ATE_LIBERTAR_SOZINHO).toBe(7);
    const fotos = new Date("2026-10-01T10:00:00Z");
    const t = { estado: "acordada", execucaoEnviadaEm: fotos };
    const dia = 86_400_000;
    expect(libertaSozinho(t, new Date(fotos.getTime() + 7 * dia - 60_000))).toBe(false);
    expect(libertaSozinho(t, new Date(fotos.getTime() + 7 * dia))).toBe(true);
    // Sem fotografias não há prazo a correr.
    expect(libertaSozinho({ estado: "acordada" }, new Date(fotos.getTime() + 30 * dia))).toBe(false);
  });

  it("o cancelamento: depois de confirmado, o dinheiro já não volta", () => {
    const base = { estado: "acordada", valorAcordado: 100, profissionalNome: "P" };
    expect(oQueSeDesfaz([base]).dinheiroJaLibertado).toBe(false);
    expect(oQueSeDesfaz([{ ...base, execucaoEnviadaEm: "2026-10-01" }]).dinheiroJaLibertado).toBe(
      false,
    );
    expect(oQueSeDesfaz([{ ...base, confirmadoEm: "2026-10-01" }]).dinheiroJaLibertado).toBe(true);
  });
});
