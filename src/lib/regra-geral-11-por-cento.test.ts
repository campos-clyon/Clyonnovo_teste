import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comissaoEmPalavras } from "./como-funciona-para-o-profissional";
import { contaDaLinha, contaFecha } from "./conta-do-pagamento";
import { quotaDaClyon, taxaDoProfissionalParaAQuota } from "./quota-da-clyon";

/**
 * A REGRA GERAL — 22-10-2026. *«Essa regra é geral, mude em todo o site.»* —
 * o dono, sobre o #469: o valor do trabalho é o que o cliente paga sem IVA, a
 * CLYON fica com 11 % dele e o IVA vai por cima — *«os 23 % não pertencem à
 * CLYON»*.
 *
 * Nas Configs do backoffice: cliente 0 %, CLYON 11 % — o profissional sai a
 * 11 %. Cada negociação grava as taxas com que nasce, e por isso vale para as
 * que nascerem a partir daí.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const NOVAS = { cliente: 0, profissional: taxaDoProfissionalParaAQuota(0, 0.11) };

describe("a regra geral: 11 % do valor, o IVA por cima", () => {
  it("nas Configs, cliente 0 % e CLYON 11 % dão 11 % ao profissional", () => {
    expect(NOVAS).toEqual({ cliente: 0, profissional: 0.11 });
    expect(quotaDaClyon(NOVAS)).toBe(0.11);
  });

  it("uma negociação nova de 282: com factura 346,86, sem factura 282 — o profissional 250,98 e a CLYON 31,02", () => {
    const linha = {
      valorAcordado: "282.00",
      taxaCliente: NOVAS.cliente,
      taxaProfissional: NOVAS.profissional,
      formaDePagamento: "na_plataforma",
      negociacaoCriadaEm: "2026-10-23T10:00:00Z",
      pagamentoParaQue: null,
    };
    const com = contaDaLinha({ ...linha, semFactura: 0 }, null)!;
    const sem = contaDaLinha({ ...linha, semFactura: 1 }, null)!;
    expect(com.total).toBe(346.86);
    expect(sem.total).toBe(282);
    for (const c of [com, sem]) {
      expect(c.profissional).toBe(250.98);
      expect(c.clyon).toBe(31.02);
      expect(contaFecha(c)).toBe(true);
      // Uma taxa só, e nenhuma linha de 0 % ao cliente.
      expect(c.degraus.some((d) => d.rotulo === "Taxa da CLYON")).toBe(true);
      expect(c.degraus.some((d) => d.rotulo === "Taxa da CLYON (cliente)")).toBe(false);
    }
  });

  it("as páginas dos profissionais dizem-no com o exemplo do dono: propõe 350, o cliente vê 430,50, recebe 311,50", () => {
    const e = comissaoEmPalavras(NOVAS, "iva_incluido");
    expect(e.proposta).toBe("350 €");
    expect(e.cliente).toBe("430,50 €");
    expect(e.recebe).toBe("311,50 €");
    expect(e.quota).toBe("11 %");
    expect(e.notaDoCliente).toBe("O seu valor, com IVA incluído");
    expect(e.frase).toContain("o cliente vê-o com IVA incluído. A CLYON fica com 11 % desse valor");
    expect(e.frase).not.toContain("taxa da plataforma");
    // Com o acréscimo ao cliente (as taxas de antes), a frase de antes.
    expect(comissaoEmPalavras({ cliente: 0.05, profissional: 0.0655 }, "iva_incluido").notaDoCliente).toBe(
      "Com a taxa da plataforma e IVA incluído",
    );
    expect(ler("src/app/profissionais/page.tsx")).toContain("{exemplo.notaDoCliente}");
  });

  it("os Termos só falam de taxa ao cliente quando há", () => {
    expect(ler("src/app/termos/page.tsx")).toContain(
      'esse valor {taxas.cliente > 0 ? "com a taxa de plataforma e " : ""}com IVA à taxa de {iva}.',
    );
  });

  it("o aviso «Receberia X» ao distribuir conta com as taxas em vigor, e não com as de origem", () => {
    const D = ler("src/lib/distribuir-pedido.ts");
    expect(D).toContain("quantoRecebe(pedido.valorDesejadoCliente, await taxasParaUmaNegociacaoNova(pedido.id))");
    expect(D).not.toContain('import { TAXA_PROFISSIONAL } from "./taxas-plataforma";');
    expect(D).not.toContain("(1 - TAXA_PROFISSIONAL)");
  });

  it("a ajuda do profissional já não diz «6 % e o cliente paga mais 5 %»", () => {
    const A = ler("src/lib/ajuda-plataforma.ts");
    expect(A).not.toContain("TAXA_CLIENTE");
    expect(A).not.toContain("TAXA_PROFISSIONAL");
    expect(A).toContain("Nas negociações, a CLYON fica com 11 % do valor do trabalho, sem IVA; nos trabalhos ");
  });

  it("a caixa de confirmar da Mesa não mostra uma taxa de 0 %", () => {
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain(
      "{conta.taxa > 0 && linha(`Taxa CLYON (${pct(taxas.cliente)})`, conta.taxa)}",
    );
  });
});

describe("só os pedidos novos, e só as negociações — 22-10-2026", () => {
  const DB = ler("src/lib/db.ts");
  const F = DB.slice(DB.indexOf("export async function taxasParaUmaNegociacaoNova("));

  it("um pedido que já tem negociações dá as dele a quem entra depois; só um novo leva as de hoje", () => {
    expect(F).toContain("WHERE pedidoId = ? AND ofertaClyon IS NULL AND COALESCE(semFactura, 0) = 0");
    expect(F).toContain("if (linhas[0]) return taxasDaNegociacao(linhas[0]);");
    expect(F.indexOf("return taxasActuais();")).toBeGreaterThan(F.indexOf("if (linhas[0])"));
  });

  it("os Trabalhos CLYON de valor fixo ficam com a taxa escolhida (10, 15 ou 20 %)", () => {
    const C = DB.slice(DB.indexOf("export async function criarNegociacao("));
    // Numa oferta, as taxas da oferta — as Configs não lhe tocam.
    expect(C).toContain("const taxas = dados.oferta\n    ? dados.oferta.taxas\n");
    expect(ler("src/lib/distribuir-pedido.ts")).toContain("? quantoOProfissionalRecebe(oferta.valor, taxasDaOferta)");
  });
});
