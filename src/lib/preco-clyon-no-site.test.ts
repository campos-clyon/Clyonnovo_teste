import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { precoClyonParaOCliente } from "./preco-clyon-para-o-cliente";

/** S20 — o preço do Trabalho CLYON também no site, e «O cliente aceitou» no backoffice (29-10-2026). */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("S20 — o preço da CLYON no site", () => {
  it("só depois de enviado, com IVA e o sem IVA ao lado, e com a versão para o aceite", () => {
    const base = { valorFixoClyon: 250, taxaClyon: 0.1, precoClienteClyon: null, baseDoPreco: "total" };
    expect(precoClyonParaOCliente({ ...base, propostaEnviadaEm: null })).toBeNull();
    expect(precoClyonParaOCliente({ valorFixoClyon: null, propostaEnviadaEm: "2026-10-29T10:00:00Z" })).toBeNull();
    const p = precoClyonParaOCliente({ ...base, propostaEnviadaEm: "2026-10-29T10:00:00Z" })!;
    expect(p.versao).toBe("2026-10-29T10:00:00.000Z");
    expect(p.principal).toMatch(/€/);
    expect(`${p.principal} ${p.detalhe}`).toMatch(/IVA/);
    // Nunca o valor que o profissional recebe nem a taxa.
    expect(JSON.stringify(p)).not.toMatch(/valorFixo|taxa/i);
  });

  it("o «Aceito este preço» passa por todas as portas, e o link, a conta e a app mostram-no", () => {
    const A = ler("src/lib/agir-como-cliente.ts");
    expect(A).not.toMatch(/a\.porta !== "app" \|\| a\.pedido\.valorFixoClyon == null/);
    expect(ler("src/app/pedido/[token]/VistaDoPedido.tsx")).toContain("<PrecoDaClyon");
    expect(ler("src/app/conta/components/OrderDetailModal.tsx")).toContain("<PrecoDaClyon");
    expect(ler("src/lib/pedidos-da-conta.ts")).toContain("precoClyonParaOCliente(");
  });

  it("o backoffice regista «O cliente aceitou (por telefone)» pela mesma escrita, sobre a versão enviada", () => {
    const R = ler("src/app/api/admin/trabalhos-clyon/route.ts");
    expect(R).toContain('if (accao === "cliente_aceitou") {');
    expect(R).toMatch(/await aceitarPrecoClyon\(pedidoId, versao\)/);
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain("O cliente aceitou (por telefone)");
  });
});
