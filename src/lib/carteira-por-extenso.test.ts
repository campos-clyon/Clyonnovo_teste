import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lucroDoTrabalho } from "./assistentes";

/**
 * A CARTEIRA DIZ, POR EXTENSO, O QUE SE TRANSFERE E O QUE A CLYON FICA — 09-10-2026.
 *
 * «Como é que eu sei o valor que devo pagar ao pro?» — sobre o #417 do TRSul,
 * um Trabalho CLYON com «Taxa CLYON −0,00 € 0 %». E: «quero saber em detalhes
 * também quanto ganhamos com esse trabalho».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("a conta, a mesma das comissões", () => {
  it("o #417: Trabalho CLYON antigo, 250 € são o que ele recebe, e sem preço ao cliente não há lucro a dizer", () => {
    const r = lucroDoTrabalho({ id: 417, status: null, valorAcordado: 250, taxaCliente: 0, taxaProfissional: 0, valorFixoClyon: 250 });
    expect(r.fonte).toBe("falta_preco_ao_cliente");
  });

  it("um Trabalho CLYON novo: 350 € ao cliente sem IVA, 20 % de taxa — ele recebe 280 €, a CLYON fica com 70 €", () => {
    const r = lucroDoTrabalho({
      id: 431,
      status: null,
      valorAcordado: 350,
      taxaCliente: 0,
      taxaProfissional: 0.2,
      valorFixoClyon: 350,
      taxaClyon: 0.2,
      precoClienteClyon: 350,
    });
    expect(r).toEqual({ valor: 350, lucro: 70, fonte: "preco_ao_cliente" });
  });

  it("um trabalho antigo com o preço escrito depois: o preço ao cliente menos os 250 € dele", () => {
    const r = lucroDoTrabalho({ id: 417, status: null, valorAcordado: 250, taxaCliente: 0, taxaProfissional: 0, valorFixoClyon: 250, precoClienteClyon: 320 });
    expect(r).toEqual({ valor: 320, lucro: 70, fonte: "preco_ao_cliente" });
  });
});

describe("a rota das Carteiras", () => {
  const R = ler("src/app/api/admin/carteiras/route.ts");

  it("lê o que a conta precisa e usa a conta das comissões", () => {
    expect(R).toContain("n.acrescimoPagamento, o.valorFixoClyon, o.taxaClyon, o.precoClienteClyon,");
    expect(R).toContain("const doLucro = lucroDoTrabalho({");
    expect(R).toContain('const semPrecoAoCliente = doLucro.fonte === "falta_preco_ao_cliente";');
    expect(R).toContain("lucroDaClyon: semPrecoAoCliente ? null : doLucro.lucro,");
  });
});

describe("o cartão da carteira", () => {
  const C = ler("src/components/admin/AdminCarteirasPanel.tsx");

  it("diz o que se transfere, a quem, e porquê", () => {
    expect(C).toContain('Transfira <strong className="text-emerald-300">{euros(t.recebe)}</strong> a {nome}');
    expect(C).toContain('" — é o valor fixo do Trabalho CLYON, sem taxa."');
    expect(C).toContain("menos ${euros(t.taxaDescontada)} de taxa CLYON.");
  });

  it("e o que a CLYON fica — ou que falta o preço ao cliente", () => {
    expect(C).toContain('A CLYON fica com <strong className="text-cyan-300">{euros(t.lucroDaClyon)}</strong> sem IVA');
    expect(C).toContain("falta o preço ao cliente deste Trabalho CLYON — escreva-o em Trabalhos CLYON.");
    // No total, sem fingir que soma o que não se sabe.
    expect(C).toContain("(sem contar ${semLucro.join(\", \")}: falta o preço ao cliente)");
  });
});
