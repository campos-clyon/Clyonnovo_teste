import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contaDoCliente } from "./taxas-plataforma";

/**
 * O ECRÃ «CONFIRMAR COMO CLYON» SOMAVA AO PROFISSIONAL O IMPOSTO DA CLYON.
 *
 * Apanhado a 21-09-2026, num mapeamento sobre formas de pagamento, e
 * confirmado à mão no ecrã do #290: profissional isento, 120 € acordados, e o
 * painel a dizer
 *
 *   ao profissional — acordado + IVA 1,38 €, na factura dele   121,38 €
 *   à CLYON — taxa de 5 %                                         6,00 €
 *
 * O 1,38 € é o IVA da TAXA — é da CLYON, e é a CLYON que o liquida. O
 * profissional está no artigo 53.º e não pode emitir imposto nenhum; o ecrã
 * mandava pagar-lhe 1,38 € que ele não tem como facturar, e dizia à CLYON que
 * recebia 6,00 € quando tem de receber 7,38 €.
 *
 * ⚠️ AS DUAS LINHAS SOMAVAM O TOTAL CERTO, e foi por isso que passou. Um erro
 * que se anula na soma é o mais difícil de ver, e é o mesmo erro de
 * 14-09-2026 — «o cliente pagou 107,52 mas a factura é de 103,32» — na
 * direcção contrária. A regra já estava escrita e testada em
 * `as-duas-facturas.test.ts`: a factura do profissional é `servico +
 * ivaDoServico`, a da CLYON é `taxa + ivaDaTaxa`. Este ecrã não a lia.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PAINEL = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

/** O bloco do «Confirmar como CLYON», da conta até ao fim da lista. */
const bloco = (() => {
  const i = PAINEL.indexOf("const aoProfissional = ");
  expect(i).toBeGreaterThan(-1);
  return PAINEL.slice(i, PAINEL.indexOf("</dl>", i));
})();

describe("a linha do profissional só leva o imposto dele", () => {
  it("é servico + ivaDoServico, nunca + iva", () => {
    expect(bloco).toContain("conta.servico + conta.ivaDoServico");
    expect(bloco).not.toContain("conta.servico + conta.iva)");
  });

  it("e a da CLYON leva a taxa E o imposto da taxa", () => {
    // Era só `conta.taxa`: 6,00 € em vez de 7,38 €. A CLYON factura com IVA.
    expect(bloco).toContain("conta.taxa + conta.ivaDaTaxa");
  });

  it("a etiqueta «isento» decide pelo imposto DELE, e não pelo imposto todo", () => {
    /*
     * `temIva` é `iva > 0` sobre o total, e como a CLYON liquida sempre sobre
     * a taxa, era sempre verdadeiro. O ramo «(isento de IVA)» nunca corria —
     * todo o isento via «+ IVA X, na factura dele».
     */
    expect(bloco).toContain("conta.ivaDoServico > 0");
    expect(bloco).not.toMatch(/conta\.temIva\s*\?/);
  });
});

describe("as contas, refeitas com papel e lápis", () => {
  it("120 € com isento: 120,00 ao profissional, 7,38 à CLYON, 127,38 no total", () => {
    const c = contaDoCliente(120, "isento");
    const aoProfissional = Math.round((c.servico + c.ivaDoServico) * 100) / 100;
    const aClyon = Math.round((c.taxa + c.ivaDaTaxa) * 100) / 100;
    expect(aoProfissional).toBe(120);
    expect(aClyon).toBe(7.38);
    expect(Number((aoProfissional + aClyon).toFixed(2))).toBe(c.total);
    // O que o ecrã dizia, e está errado: 121,38 ao isento.
    expect(Math.round((c.servico + c.iva) * 100) / 100).toBe(121.38);
  });

  it("120 € com regime normal: 147,60 ao profissional, 7,38 à CLYON", () => {
    const c = contaDoCliente(120, "normal");
    const aoProfissional = Math.round((c.servico + c.ivaDoServico) * 100) / 100;
    const aClyon = Math.round((c.taxa + c.ivaDaTaxa) * 100) / 100;
    expect(aoProfissional).toBe(147.6);
    expect(aClyon).toBe(7.38);
    expect(Number((aoProfissional + aClyon).toFixed(2))).toBe(c.total);
  });

  it("nos dois regimes, as duas linhas somam o total — como antes; é isso que escondia o erro", () => {
    for (const regime of ["isento", "normal"] as const) {
      const c = contaDoCliente(350, regime);
      const errado = c.servico + c.iva + c.taxa;
      const certo = c.servico + c.ivaDoServico + c.taxa + c.ivaDaTaxa;
      expect(Number(errado.toFixed(2)), regime).toBe(c.total);
      expect(Number(certo.toFixed(2)), regime).toBe(c.total);
    }
  });
});
