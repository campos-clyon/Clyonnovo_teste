import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eSemFactura, modeloDaLinha, paraQueDaLinha, taxasSemFactura } from "./sem-factura";
import { contaDaLinha, contaFecha } from "./conta-do-pagamento";
import { contaDoCliente, quantoOProfissionalRecebe } from "./taxas-plataforma";
import { valorDoPagamento } from "./pagamento-declarado";

/**
 * SEM FACTURA — 21-10-2026, o #375 da Mónica.
 *
 * *«A cliente pagou 510 total sem fatura, temos que ter a opção de sem
 * fatura.»* — *«Uni o 5 % do cliente e o 6 % do pro, fica 11 % para ser
 * descontado do valor total que o cliente pagou nas negociações.»* — o dono:
 * 510 € pagos, 56,10 € da CLYON, 453,90 € ao profissional.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const COM = { cliente: 0.05, profissional: 0.06 };
const SEM = taxasSemFactura(COM);

describe("a regra", () => {
  it("as duas taxas juntam-se do lado do profissional", () => {
    expect(SEM).toEqual({ cliente: 0, profissional: 0.11 });
  });

  it("o #375: o cliente paga 510, a CLYON fica com 56,10 e o profissional recebe 453,90", () => {
    const linha = {
      valorAcordado: "510.00",
      taxaCliente: SEM.cliente,
      taxaProfissional: SEM.profissional,
      formaDePagamento: "na_plataforma",
      negociacaoCriadaEm: "2026-10-05T10:00:00Z",
      pagamentoParaQue: null,
      semFactura: 1,
    };
    const conta = contaDaLinha(linha, null)!;
    expect(conta.total).toBe(510);
    expect(conta.iva).toBe(0);
    expect(conta.clyon).toBe(56.1);
    expect(conta.profissional).toBe(453.9);
    expect(contaFecha(conta)).toBe(true);
    expect(quantoOProfissionalRecebe(510, SEM)).toBe(453.9);
    // O que os Pagamentos pedem ao cliente.
    expect(valorDoPagamento(contaDoCliente(510, SEM), paraQueDaLinha(linha), modeloDaLinha(linha, linha.negociacaoCriadaEm))).toBe(510);
  });

  it("sem a marca, fica tudo como estava — com IVA desde 2 de outubro", () => {
    const linha = { semFactura: 0 };
    expect(eSemFactura(linha)).toBe(false);
    expect(modeloDaLinha(linha, "2026-10-05T10:00:00Z")).toBe("iva_incluido");
    expect(modeloDaLinha({ semFactura: 1 }, "2026-10-05T10:00:00Z")).toBe("sem_iva");
    expect(paraQueDaLinha({ semFactura: 0, pagamentoParaQue: "com_factura" })).toBe("com_factura");
    const conta = contaDaLinha(
      { valorAcordado: 510, taxaCliente: 0.05, taxaProfissional: 0.06, formaDePagamento: "na_plataforma", negociacaoCriadaEm: "2026-10-05T10:00:00Z" },
      null,
    )!;
    expect(conta.total).toBe(658.67);
    expect(conta.profissional).toBe(479.4);
  });
});

describe("as peças", () => {
  const DB = ler("src/lib/db.ts");
  const MUDA = DB.slice(DB.indexOf("export async function mudarAFacturaDaNegociacao("));

  it("a marca e as taxas de antes ficam na negociação, e voltam com «Com factura»", () => {
    expect(DB).toContain("`ALTER TABLE negociacoes ADD COLUMN semFactura TINYINT NOT NULL DEFAULT 0`,");
    expect(DB).toContain("`ALTER TABLE negociacoes ADD COLUMN taxasComFacturaJson VARCHAR(80) NULL DEFAULT NULL`,");
    expect(DB).toContain("const VERSAO_DAS_NEGOCIACOES = 9;");
    expect(MUDA).toContain("SET taxaCliente = ?, taxaProfissional = ?, semFactura = 1, taxasComFacturaJson = ?");
    expect(MUDA).toContain("SET taxaCliente = ?, taxaProfissional = ?, semFactura = 0, taxasComFacturaJson = NULL");
  });

  it("só antes de o dinheiro entrar ou sair, nunca num Trabalho CLYON nem em dinheiro", () => {
    expect(MUDA).toContain('if (n.estado !== "acordada" || n.valorAcordado == null) return recusar("nao_fechado");');
    expect(MUDA).toContain('return recusar("trabalho_clyon");');
    expect(MUDA).toContain('if (lerForma(n.formaDePagamento) === "dinheiro") return recusar("em_dinheiro");');
    expect(MUDA).toContain('if (n.pagoEm != null) return recusar("ja_entrou");');
    expect(MUDA).toContain('"SELECT 1 FROM pagamentos WHERE negociacaoPaga = ? AND pagoEm IS NOT NULL LIMIT 1",');
  });

  it("a rota é do administrador e escreve no histórico", () => {
    const ROTA = ler("src/app/api/admin/pagamentos/factura/route.ts");
    expect(ROTA).toContain("const { err, colab } = await requireAdminGeral(req);");
    expect(ROTA).toContain("await appendOrderHistory(r.pedidoId, {");
  });

  it("os Pagamentos, as Finanças e a Mesa lêem a marca", () => {
    const P = ler("src/app/api/admin/pagamentos/route.ts");
    expect(P).toContain("n.createdAt AS negociacaoCriadaEm, n.semFactura,");
    expect(P).toContain("valorDoPagamento(contaDoCliente(acordado, taxas), paraQueDaLinha(l), modelo)");
    expect(P).toContain("semFactura: eSemFactura(l),");
    expect(ler("src/app/api/admin/pagamentos/recebido/route.ts")).toContain("paraQueDaLinha(l),");
    expect(ler("src/app/api/admin/carteiras/route.ts")).toContain("const clientePaga = eSemFactura(l) ? contaDoCliente(acordado, taxas).semIva : contaDoCliente(acordado, taxas).total;");
    expect(DB).toContain("n.pagamentoParaQue, n.semFactura,");
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("semFactura: acordada.semFactura,");
  });

  it("o cartão dos Pagamentos tem «Com factura / Sem factura» antes de «O cliente pagou-nos?»", () => {
    const PAINEL = ler("src/components/admin/AdminPagamentosPanel.tsx");
    const factura = PAINEL.indexOf('{sem ? "Sem factura" : "Com factura"}');
    expect(factura).toBeGreaterThan(-1);
    expect(factura).toBeLessThan(PAINEL.indexOf("O cliente pagou-nos?"));
    expect(PAINEL).toContain('onFactura={(semFactura) => void agir(t, "/api/admin/pagamentos/factura", { semFactura })}');
    expect(PAINEL).toContain("disabled={ocupado || !t.podeMudarFactura}");
  });
});
