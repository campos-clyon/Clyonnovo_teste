import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * AS CARTEIRAS: POR NÚMERO DE PEDIDO, COM PROCURA E FILTROS — 14-10-2026.
 *
 * «Os pedidos devem estar sempre por ordem dos números do pedido, e deve ter
 * barra de pesquisa assim como filtros aqui.»
 */

const C = readFileSync(join(process.cwd(), "src/components/admin/AdminCarteirasPanel.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("as Carteiras", () => {
  it("os trabalhos de cada cartão vão por número de pedido, do mais baixo ao mais alto", () => {
    expect(C).toContain(".sort((a, b) => a.pedidoId - b.pedidoId)");
  });

  it("a procura é a das Negociações: o profissional mostra o cartão inteiro, um trabalho só os que batem", () => {
    expect(C).toContain('placeholder="Procurar por profissional, número do pedido, cliente, telefone ou morada…"');
    expect(C).toContain("if (!aProcurar || fichaBate(c)) return [c];");
    expect(C).toContain("const porPagar = c.porPagar.filter(trabalhoBate);");
    // E as contas do cartão passam a ser as desses trabalhos — e ele di-lo.
    expect(C).toContain("totalPorPagar: somar(porPagar.map((t) => t.recebe)),");
    expect(C).toContain("Só os trabalhos que batem com a procura — e as contas são as deles.");
  });

  it("os filtros: por profissional e pelo gesto, com quantos há em cada", () => {
    expect(C).toContain('<option value="">Todos os profissionais</option>');
    for (const rotulo of ["Tudo", "A pagar agora", "A decorrer", "Devem à CLYON", "Sem movimento"]) {
      expect(C).toContain(`rotulo: "${rotulo}"`);
    }
    expect(C).toContain("{fl.rotulo}");
    expect(C).toContain(" · {contas[fl.id]}");
    // Os «sem movimento» abrem-se sozinhos ao procurar ou filtrar.
    expect(C).toContain("{(verParados || aFiltrar) && (");
  });
});
