import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eSemFactura, modeloDaLinha, paraQueDaLinha, taxasSemFactura } from "./sem-factura";
import { contaDaLinha, contaFecha } from "./conta-do-pagamento";
import { contaDoCliente, quantoOProfissionalRecebe } from "./taxas-plataforma";
import { valorDoPagamento } from "./pagamento-declarado";
import { carteiraDoCliente } from "./carteira-do-cliente";

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

  it("antes de o pagamento do cliente estar registado, nunca em dinheiro; depois de pagar ao pro, só se ele recebe o mesmo", () => {
    expect(MUDA).toContain('if (n.estado !== "acordada" || n.valorAcordado == null) return recusar("nao_fechado");');
    expect(MUDA).not.toContain('"trabalho_clyon"');
    expect(MUDA).toContain('if (lerForma(n.formaDePagamento) === "dinheiro") return recusar("em_dinheiro");');
    expect(MUDA).toContain('if (jaPagoAoProfissional && depois.profissional !== antes.profissional) return recusar("pro_ja_pago");');
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

describe("também nos Trabalhos CLYON — «deve ter essa opção para todos» (21-10-2026)", () => {
  it("o #459: sem factura sai só o IVA — o cliente paga 80, o profissional recebe os mesmos 72", () => {
    const linha = {
      valorAcordado: "80.00",
      taxaCliente: 0,
      taxaProfissional: 0.1,
      formaDePagamento: "na_plataforma",
      negociacaoCriadaEm: "2026-10-19T14:41:00Z",
      ofertaClyon: "distribuida",
      valorFixoClyon: "80.00",
      taxaClyon: "0.10",
      precoClienteClyon: "80.00",
      semFactura: 1,
    };
    const conta = contaDaLinha(linha, true)!;
    expect(conta.total).toBe(80);
    expect(conta.iva).toBe(0);
    expect(conta.profissional).toBe(72);
    expect(conta.clyon).toBe(8);
    expect(contaFecha(conta)).toBe(true);
    // As taxas não mudam: por isso também depois de se pagar ao profissional.
    expect(taxasSemFactura({ cliente: 0, profissional: 0.1 })).toEqual({ cliente: 0, profissional: 0.1 });
    // Com factura, o de sempre.
    expect(contaDaLinha({ ...linha, semFactura: 0 }, true)!.total).toBe(98.4);
  });

  it("os Pagamentos mostram a escolha a todos, e dizem porquê quando não se pode", () => {
    const P = ler("src/app/api/admin/pagamentos/route.ts");
    expect(P).toContain("(l.pagoEm == null || trabalhoClyon),");
    expect(P).toContain("porqueNaoMudaFactura:");
    const PAINEL = ler("src/components/admin/AdminPagamentosPanel.tsx");
    expect(PAINEL).toContain("{(t.podeMudarFactura || t.semFactura || t.porqueNaoMudaFactura) && (");
    expect(PAINEL).toContain("o profissional recebe o mesmo.");
  });

  it("e o cartão de valor fixo da Mesa faz a conta sem IVA", () => {
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain(
      'contaDoTrabalhoClyon(t, r.fase === "confirmada" || r.fase === "paga", Boolean(a?.semFactura))',
    );
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain("semFactura: n.semFactura,");
  });
});

describe("na conta do cliente — 21-10-2026, «coloque o sem factura também na conta do cliente»", () => {
  it("a carteira dele diz o que pagou sem factura: 510, e não 658,67", () => {
    const base = {
      negociacaoId: 1,
      pedidoId: 375,
      estado: "acordada",
      valorAcordado: 510,
      createdAt: "2026-10-05T10:00:00Z",
      confirmadoEm: "2026-10-20T10:00:00Z",
      pagoEm: null,
    };
    const sem = carteiraDoCliente([{ ...base, taxaCliente: 0, taxaProfissional: 0.11, semFactura: 1 }]);
    expect(sem.linhas[0].total).toBe(510);
    const com = carteiraDoCliente([{ ...base, taxaCliente: 0.05, taxaProfissional: 0.06, semFactura: 0 }]);
    expect(com.linhas[0].total).toBe(658.67);
  });

  it("a lista, o detalhe e o link do pedido lêem a marca", () => {
    expect(ler("src/app/api/users/me/orders/route.ts")).toContain("n.createdAt, n.semFactura,");
    expect(ler("src/lib/conta-server.ts")).toContain("n.createdAt, n.semFactura,");
    expect(ler("src/app/conta/components/types.ts")).toContain("const modeloDela = modeloDaLinha(fechada, fechada.createdAt);");
    expect(ler("src/app/conta/ContaCliente.tsx")).toContain("semFactura: n.semFactura ?? null,");
    expect(ler("src/app/conta/components/Carteira.tsx")).toContain("semFactura: n.semFactura ?? null,");
    expect(ler("src/app/pedido/[token]/VistaDoPedido.tsx")).toContain("semFactura: n.semFactura ?? null,");
    const P = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(P).toContain("const modeloDela = modeloDaLinha(acordada, acordada.criadaEm);");
    expect(P).toContain("const modeloDela = modeloDaLinha(n, n.criadaEm);");
  });
});
