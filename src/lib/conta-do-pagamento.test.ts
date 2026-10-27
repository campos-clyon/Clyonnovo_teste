import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  contaDaLinha,
  contaDaNegociacao,
  contaDoTrabalhoClyon,
  contaFecha,
  emEuros,
  emPercentagem,
  type ContaDoPagamento,
} from "./conta-do-pagamento";
import { dividaDoProfissional } from "./divida-do-profissional";
import { contaDoCliente, quantoOProfissionalRecebe } from "./taxas-plataforma";
import ContaDoPagamentoVista from "@/components/ContaDoPagamento";

(globalThis as { React?: typeof React }).React = React;

/**
 * A CONTA DE UM PAGAMENTO, DEGRAU A DEGRAU — 15-10-2026.
 *
 * *«Seja didático: o valor que o cliente pagou, se pagou o IVA e quanto foi,
 * a taxa usada e o valor dela, e quanto temos de pagar ao profissional.»*
 * O que se guarda: que a conta fecha ao cêntimo em todos os regimes, que os
 * números são os mesmos das funções que já decidem o dinheiro, e que se lê
 * como uma conta feita à mão.
 */

const valores = (c: ContaDoPagamento) => c.degraus.map((d) => [d.tipo, d.rotulo, d.valor]);
const TAXAS_DE_HOJE = { cliente: 0.05, profissional: 0.0655 };

describe("Trabalhos CLYON", () => {
  it("#437 — 130 € sem IVA a 20 %: recebido 159,90; IVA 29,90; sem IVA 130; taxa 20 % 26; profissional 104", () => {
    const c = contaDoTrabalhoClyon({ valorFixo: 130, taxa: 0.2, precoAoCliente: 130 }, true)!;
    expect(valores(c)).toEqual([
      ["inicio", "Recebido do cliente", 159.9],
      ["menos", "IVA", 29.9],
      ["igual", "Valor sem IVA", 130],
      ["menos", "Taxa da plataforma", 26],
      ["igual", "A pagar ao profissional", 104],
    ]);
    expect(c.degraus[1].percentagem).toBe(0.23);
    expect(c.degraus[3].percentagem).toBe(0.2);
    expect(c.clyon).toBe(26);
    expect(contaFecha(c)).toBe(true);
  });

  it("#417, antigo — a percentagem calcula-se da diferença", () => {
    const c = contaDoTrabalhoClyon({ valorFixo: 250, taxa: null, precoAoCliente: 273 }, false)!;
    expect(c.degraus[0]).toMatchObject({ rotulo: "A receber do cliente", valor: 335.79 });
    expect(c.iva).toBe(62.79);
    expect(c.clyon).toBe(23);
    expect(emPercentagem(c.degraus[3].percentagem!)).toBe("8,42 %");
    expect(contaFecha(c)).toBe(true);
  });

  it("sem preço ao cliente não há conta", () => {
    expect(contaDoTrabalhoClyon({ valorFixo: 250, taxa: null, precoAoCliente: null }, null)).toBeNull();
  });
});

describe("trabalhos do site, com IVA incluído", () => {
  const base = { acordado: 350, taxas: TAXAS_DE_HOJE, modelo: "iva_incluido" as const, comFactura: true };

  it("pela plataforma: 452,03 − 84,53 de IVA = 367,50 − 17,50 (5 %) = 350 − 22,92 (6,55 %) = 327,08", () => {
    const c = contaDaNegociacao({ ...base, emDinheiro: false, pago: true });
    expect(valores(c)).toEqual([
      ["inicio", "Recebido do cliente", 452.03],
      ["menos", "IVA", 84.53],
      ["igual", "Valor sem IVA", 367.5],
      ["menos", "Taxa da plataforma (cliente)", 17.5],
      ["igual", "Valor do trabalho", 350],
      ["menos", "Taxa da plataforma (profissional)", 22.92],
      ["igual", "A pagar ao profissional", 327.08],
    ]);
    expect(c.clyon).toBe(40.42);
    expect(c.notas).toEqual([]);
    expect(contaFecha(c)).toBe(true);
  });

  it("os números são os das funções que já decidem o dinheiro", () => {
    const c = contaDaNegociacao({ ...base, emDinheiro: false, pago: null });
    const conta = contaDoCliente(350, TAXAS_DE_HOJE);
    expect(c.total).toBe(conta.total);
    expect(c.iva).toBe(conta.iva);
    expect(c.profissional).toBe(quantoOProfissionalRecebe(350, TAXAS_DE_HOJE));
    expect(c.degraus[0].rotulo).toBe("O cliente paga");
  });

  it("em dinheiro: o cliente paga em mão, e a nota diz o que ele deve à CLYON — a mesma dívida da carteira", () => {
    const c = contaDaNegociacao({ ...base, emDinheiro: true, pago: true });
    const d = dividaDoProfissional(350, TAXAS_DE_HOJE);
    expect(c.degraus[0].rotulo).toBe("Pago pelo cliente ao profissional, em mão");
    expect(c.degraus[c.degraus.length - 1].rotulo).toBe("Fica com o profissional");
    expect(c.notas[0]).toContain(`deve à CLYON ${emEuros(d.total)}`);
    expect(c.notas[0]).toContain("124,95 €");
    expect(c.notas[0]).toContain("84,53 € de IVA e 40,42 € de taxas");
    // A dívida é o IVA mais o que fica para a CLYON.
    expect(d.total).toBe(Math.round((c.iva + c.clyon) * 100) / 100);
    expect(contaFecha(c)).toBe(true);
  });
});

describe("trabalhos do site de antes de 2 de outubro (sem IVA)", () => {
  const base = { acordado: 350, taxas: { cliente: 0.05, profissional: 0.06 }, modelo: "sem_iva" as const };

  it("sem fatura, o IVA aparece a zero e diz porquê", () => {
    const c = contaDaNegociacao({ ...base, emDinheiro: false, comFactura: false, pago: true });
    expect(c.total).toBe(367.5);
    expect(c.degraus[1]).toMatchObject({ rotulo: "IVA", valor: 0 });
    expect(c.degraus[1].nota).toContain("não pagou IVA");
    expect(contaFecha(c)).toBe(true);
  });

  it("com fatura, paga o IVA por cima", () => {
    const c = contaDaNegociacao({ ...base, emDinheiro: false, comFactura: true, pago: true });
    expect(c.total).toBe(452.03);
    expect(c.iva).toBe(84.53);
    expect(contaFecha(c)).toBe(true);
  });

  it("em dinheiro: o profissional fica com o trabalho todo, e o cliente paga a taxa à CLYON", () => {
    // As taxas de um trabalho em dinheiro guardaram-se como {c + p, 0}.
    const taxas = { cliente: 0.11, profissional: 0 };
    const sem = contaDaNegociacao({ ...base, taxas, emDinheiro: true, comFactura: false, pago: true });
    expect(sem.total).toBe(388.5);
    expect(sem.clyon).toBe(38.5);
    expect(sem.profissional).toBe(350);
    expect(sem.degraus[0].nota).toBe("350,00 € em mão ao profissional + 38,50 € à CLYON, por referência");
    expect(contaFecha(sem)).toBe(true);
    const com = contaDaNegociacao({ ...base, taxas, emDinheiro: true, comFactura: true, pago: true });
    expect(com.iva).toBe(8.86);
    expect(com.total).toBe(397.36);
    expect(contaFecha(com)).toBe(true);
  });
});

describe("a conta fecha sempre, ao cêntimo", () => {
  it("em todos os regimes, para centenas de valores e taxas", () => {
    const taxasPossiveis = [
      { cliente: 0.05, profissional: 0.06 },
      { cliente: 0.05, profissional: 0.0655 },
      { cliente: 0, profissional: 0.2 },
      { cliente: 0.11, profissional: 0 },
      { cliente: 0.07, profissional: 0.03 },
    ];
    for (let v = 10; v <= 3000; v += 13.37) {
      const acordado = Math.round(v * 100) / 100;
      for (const taxas of taxasPossiveis) {
        for (const modelo of ["iva_incluido", "sem_iva"] as const) {
          for (const emDinheiro of [false, true]) {
            for (const comFactura of [false, true]) {
              const c = contaDaNegociacao({ acordado, taxas, modelo, emDinheiro, comFactura, pago: null });
              expect(contaFecha(c), `${acordado} ${JSON.stringify(taxas)} ${modelo} ${emDinheiro} ${comFactura}`).toBe(true);
            }
          }
        }
      }
      for (const taxa of [0.1, 0.15, 0.2, null]) {
        const c = contaDoTrabalhoClyon({ valorFixo: acordado, taxa, precoAoCliente: taxa == null ? acordado + 20 : acordado }, null)!;
        expect(contaFecha(c), `${acordado} ${taxa}`).toBe(true);
      }
    }
  });
});

describe("da linha da base", () => {
  const depoisDoCorte = "2026-10-10T10:00:00.000Z";
  const antesDoCorte = "2026-09-20T10:00:00.000Z";

  it("um Trabalho CLYON vai pela conta dele, com o valor e a taxa do pedido", () => {
    const c = contaDaLinha(
      { valorAcordado: "130.00", ofertaClyon: "fixo", valorFixoClyon: "130.00", taxaClyon: "0.20", precoClienteClyon: "130.00", taxaCliente: "0", taxaProfissional: "0.2" },
      true,
    )!;
    expect(c.total).toBe(159.9);
    expect(c.taxas).toEqual([{ rotulo: "Taxa da plataforma", percentagem: 0.2, valor: 26 }]);
  });

  it("um do site vai pelo modelo da data em que a negociação abriu", () => {
    const linha = { valorAcordado: 350, taxaCliente: 0.05, taxaProfissional: 0.0655, formaDePagamento: "plataforma" };
    expect(contaDaLinha({ ...linha, negociacaoCriadaEm: depoisDoCorte }, null)!.total).toBe(452.03);
    // Antes do corte, sem declaração: cada ecrã diz o que já assumia.
    expect(contaDaLinha({ ...linha, negociacaoCriadaEm: antesDoCorte }, null)!.total).toBe(452.03);
    expect(contaDaLinha({ ...linha, negociacaoCriadaEm: antesDoCorte }, null, true)!.total).toBe(367.5);
    // A declaração manda sobre a omissão.
    expect(
      contaDaLinha({ ...linha, negociacaoCriadaEm: antesDoCorte, pagamentoParaQue: "sem_factura" }, null)!.total,
    ).toBe(367.5);
  });

  it("sem valor acordado não há conta", () => {
    expect(contaDaLinha({ valorAcordado: null }, null)).toBeNull();
  });
});

describe("os números por extenso", () => {
  it("euros e percentagens", () => {
    expect(emEuros(159.9)).toBe("159,90 €");
    expect(emEuros(-10)).toBe("−10,00 €");
    expect(emPercentagem(0.23)).toBe("23 %");
    expect(emPercentagem(0.05)).toBe("5 %");
    expect(emPercentagem(0.0655)).toBe("6,55 %");
  });
});

describe("desenhada", () => {
  it("lê-se de cima para baixo, com os sinais, as percentagens e o que fica para a CLYON", () => {
    const conta = contaDoTrabalhoClyon({ valorFixo: 130, taxa: 0.2, precoAoCliente: 130 }, true)!;
    const html = renderToStaticMarkup(createElement(ContaDoPagamentoVista, { conta })).replace(/<!-- -->/g, "");
    const ordem = ["Recebido do cliente", "159,90 €", "IVA", "23 %", "− 29,90 €", "Valor sem IVA", "130,00 €", "Taxa da plataforma", "20 %", "− 26,00 €", "A pagar ao profissional", "104,00 €", "Fica para a CLYON"];
    let desde = 0;
    for (const pedaco of ordem) {
      const i = html.indexOf(pedaco, desde);
      expect(i, pedaco).toBeGreaterThan(-1);
      desde = i;
    }
    expect(html).toContain("Miragem Dourada");
  });

  it("num trabalho em dinheiro mostra a nota da dívida", () => {
    const conta = contaDaNegociacao({ acordado: 350, taxas: TAXAS_DE_HOJE, modelo: "iva_incluido", emDinheiro: true, comFactura: true, pago: true });
    const html = renderToStaticMarkup(createElement(ContaDoPagamentoVista, { conta, tom: "claro" }));
    expect(html).toContain("deve à CLYON 124,95 €");
  });
});

describe("nos Trabalhos CLYON", () => {
  const ler = (f: string) =>
    readFileSync(join(process.cwd(), f), "utf8")
      .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("o cartão desenha a conta em degraus — recebida quando o trabalho está concluído, nenhuma num cancelado", () => {
    const PAINEL = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(PAINEL).toContain(
      // E sem IVA quando é sem factura (21-10-2026).
      'r.fase === "cancelada" ? null : contaDoTrabalhoClyon(t, r.fase === "confirmada" || r.fase === "paga", Boolean(a?.semFactura));',
    );
    expect(PAINEL).toContain("<ContaDoPagamento conta={conta} />");
    // Os antigos continuam a escrever e a mudar o preço ao cliente.
    expect(PAINEL).toContain("Falta o preço ao cliente");
    expect(PAINEL).toContain('setPrecoEscrito(conta.semIva.toFixed(2).replace(".", ","));');
  });

  it("o editor do valor e da taxa desenha a mesma conta", () => {
    const EDITOR = ler("src/components/admin/ValorETaxaDoTrabalho.tsx");
    expect(EDITOR).toContain("contaDoTrabalhoClyon({ valorFixo: lido.valor, taxa, precoAoCliente: null }, null)");
    expect(EDITOR).toContain('<ContaDoPagamento conta={conta} titulo="Como fica a conta" />');
  });
});

describe("em todos os ecrãs do dinheiro — 15-10-2026", () => {
  const ler = (f: string) =>
    readFileSync(join(process.cwd(), f), "utf8")
      .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("as rotas mandam a conta feita, com o que decide cada regime", () => {
    const PAGAMENTOS = (ler("src/app/api/admin/pagamentos/route.ts") + ler("src/lib/trabalhos-para-gerir.ts"));
    expect(PAGAMENTOS).toContain("conta: ContaDoPagamento | null;");
    expect(PAGAMENTOS).toContain("const conta = contaDaLinha(l, recebido);");
    expect(PAGAMENTOS).toContain("n.ofertaClyon, o.valorFixoClyon, o.taxaClyon, o.precoClienteClyon,");
    // Um Trabalho CLYON antigo deixa de pedir ao cliente o valor do profissional com IVA.
    expect(PAGAMENTOS).toContain("trabalhoClyon && conta ? conta.total : valorDoPagamento(");

    const CARTEIRAS = ler("src/app/api/admin/carteiras/route.ts");
    expect(CARTEIRAS).toContain("conta: contaDaLinha(");
    expect(CARTEIRAS).toContain("n.pagamentoParaQue,");

    const AGENDA = ler("src/app/api/admin/agenda/route.ts");
    expect(AGENDA).toContain("conta: contaDaLinha(");
    expect(AGENDA).toContain("n.ofertaClyon, o.valorFixoClyon, o.taxaClyon, o.precoClienteClyon,");

    // As Negociações fazem a conta no ecrã, com a factura que a rota passou a trazer.
    // (O db.ts lê-se cru: a regra que tira os comentários engole SQL dele.)
    const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8").replace(/\r\n/g, "\n");
    // Com a marca «sem factura» ao lado, desde 21-10-2026.
    expect(DB).toContain("n.pagamentoParaQue, n.semFactura,\n            n.createdAt AS criadaEm");
  });

  it("e os ecrãs desenham-na", () => {
    expect(ler("src/components/admin/AdminPagamentosPanel.tsx")).toContain("<ContaDoPagamento conta={t.conta} />");
    expect(ler("src/components/admin/AdminCarteirasPanel.tsx")).toContain("{t.conta && <ContaDoPagamento conta={t.conta} />}");
    expect(ler("src/components/admin/FichaDaAgenda.tsx")).toContain("<ContaDoPagamento conta={t.conta} />");
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("<ContaDoPagamento conta={conta} />");
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain("<ContaDoPagamento conta={conta} />");
  });
});
