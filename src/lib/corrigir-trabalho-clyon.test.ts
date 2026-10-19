import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  precoClyonAcompanha,
  precoClyonDesalinhado,
  precoDoTrabalhoClyonDaLinha,
} from "./corrigir-trabalho-clyon";
import { contaDoTrabalhoClyon } from "./conta-do-pagamento";

/**
 * «ATUALIZEI O VALOR DA CRISTINA MAS ELE NÃO MUDOU EM CIMA» — 19-10-2026.
 *
 * O #447: Trabalho CLYON de 260 € (taxa 15 %), corrigido para 300 € nos
 * Pagamentos. O TRSul passou a 255 €, mas a conta continuou em 319,80 € /
 * 221 €, porque lia o preço do pedido, que ficou nos 260 €.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const HOJE = { ofertaClyon: "distribuida", valorFixoClyon: 260, taxaClyon: 0.15, precoClienteClyon: 260 };
const ANTIGO = { ofertaClyon: "directa", valorFixoClyon: 200, taxaClyon: null, precoClienteClyon: 260 };
const DO_SITE = { ofertaClyon: null, valorFixoClyon: null, taxaClyon: null, precoClienteClyon: null };

describe("o que acompanha a correcção do valor", () => {
  it("Trabalho CLYON de hoje: o preço ao cliente e o valor fixo passam os dois ao valor novo", () => {
    expect(precoClyonAcompanha(HOJE, 300)).toEqual({ valorFixoClyon: 300, precoClienteClyon: 300 });
  });

  it("Trabalho CLYON antigo: só o valor do profissional; o preço ao cliente fica", () => {
    expect(precoClyonAcompanha(ANTIGO, 220)).toEqual({ valorFixoClyon: 220 });
  });

  it("negociação do site: o pedido não muda", () => {
    expect(precoClyonAcompanha(DO_SITE, 300)).toBeNull();
  });

  it("depois de acompanhar, a conta do #447 bate com o TRSul: 369 € ao cliente, 255 € ao profissional", () => {
    const m = precoClyonAcompanha(HOJE, 300)!;
    const conta = contaDoTrabalhoClyon(
      { valorFixo: m.valorFixoClyon, taxa: HOJE.taxaClyon, precoAoCliente: m.precoClienteClyon ?? null },
      false,
    )!;
    expect(conta.total).toBe(369);
    expect(conta.semIva).toBe(300);
    expect(conta.clyon).toBe(45);
    expect(conta.profissional).toBe(255);
  });
});

describe("o #447 como ficou: valor acordado 300, pedido em 260", () => {
  it("conta como desalinhado, e gravar 300 outra vez é permitido para o acertar", () => {
    expect(precoClyonDesalinhado(HOJE, 300)).toBe(true);
    expect(precoClyonDesalinhado(HOJE, 260)).toBe(false);
    expect(precoClyonDesalinhado(ANTIGO, 200)).toBe(false);
    expect(precoClyonDesalinhado(DO_SITE, 300)).toBe(false);
  });

  it("lê os números como a base os devolve (DECIMAL em texto)", () => {
    expect(
      precoDoTrabalhoClyonDaLinha({ ofertaClyon: "distribuida", valorFixoClyon: "260.00", taxaClyon: "0.15", precoClienteClyon: "260.00" }),
    ).toEqual(HOJE);
  });
});

describe("as rotas usam a regra", () => {
  const VALOR = ler("src/app/api/admin/negociacoes/valor/route.ts");
  const PAGAMENTOS = ler("src/app/api/admin/pagamentos/route.ts");
  const PAINEL = ler("src/components/admin/AdminPagamentosPanel.tsx");

  it("a correcção grava também o preço do pedido, e aceita o mesmo valor quando está desalinhado", () => {
    expect(VALOR).toContain("const acompanha = precoClyonAcompanha(clyon, novo);");
    expect(VALOR).toContain("SET valorFixoClyon = ?,");
    expect(VALOR).toContain("&& !precoClyonDesalinhado(clyon, novo)) {");
  });

  it("os Pagamentos dizem quando está desalinhado, e o botão deixa acertar", () => {
    expect(PAGAMENTOS).toContain("valorDesalinhado: trabalhoClyon && precoClyonDesalinhado(");
    expect(PAINEL).toContain("&& !t.valorDesalinhado;");
    expect(PAINEL).toContain("A conta acima ainda usa o preço antigo deste Trabalho CLYON.");
  });
});
