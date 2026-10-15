import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { contasDoTrabalhoClyon, EMPRESA_PARCEIRA } from "./contas-do-trabalho-clyon";
import { precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { TAXAS_DO_TRABALHO_CLYON } from "./oferta-clyon";
import ValorETaxaDoTrabalho from "@/components/admin/ValorETaxaDoTrabalho";

// O JSX do componente sai como `React.createElement` nos testes.
(globalThis as { React?: typeof React }).React = React;

/**
 * PARA ONDE VAI O DINHEIRO DE UM TRABALHO CLYON — 15-10-2026.
 *
 * *«Esses cálculos não fazem sentido.»* — e a seguir: *«Deixe aqui quanto foi
 * pago pelo cliente, quanto vamos passar à empresa parceira e quanto a CLYON
 * fica.»* O cartão do #437 dizia «o pro recebe 104 €» e «fica para a CLYON
 * 26 €», e o botão da proposta dizia 159,90 €: faltava à vista o IVA, que passa
 * para a empresa parceira que emite a factura. Os números são os dos três
 * cartões da captura.
 */

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

describe("os três cartões da captura", () => {
  it("#437 — 130 € sem IVA a 20 %: o cliente paga 159,90 = 29,90 de IVA + 104 ao pro + 26 à CLYON", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 130, taxa: 0.2, precoAoCliente: 130 })).toEqual({
      cliente: 159.9,
      semIva: 130,
      parceira: 29.9,
      profissional: 104,
      clyon: 26,
    });
  });

  it("#428 — 100 € a 15 %: 123 = 23 + 85 + 15", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 100, taxa: 0.15, precoAoCliente: 100 })).toEqual({
      cliente: 123,
      semIva: 100,
      parceira: 23,
      profissional: 85,
      clyon: 15,
    });
  });

  it("#417, antigo — 250 € ao pro e 273 € sem IVA ao cliente: 335,79 = 62,79 + 250 + 23", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 250, taxa: null, precoAoCliente: 273 })).toEqual({
      cliente: 335.79,
      semIva: 273,
      parceira: 62.79,
      profissional: 250,
      clyon: 23,
    });
  });
});

describe("as contas", () => {
  it("as partes somam sempre o que o cliente paga, ao cêntimo", () => {
    for (let valor = 10; valor <= 2500; valor += 7.37) {
      const v = aosCentimos(valor);
      for (const taxa of TAXAS_DO_TRABALHO_CLYON) {
        const c = contasDoTrabalhoClyon({ valorFixo: v, taxa, precoAoCliente: v })!;
        expect(aosCentimos(c.parceira + c.profissional + c.clyon), `${v} a ${taxa}`).toBe(c.cliente);
        expect(aosCentimos(c.profissional + c.clyon), `${v} a ${taxa}`).toBe(c.semIva);
      }
    }
  });

  it("o que o cliente paga é o número do botão «Enviar proposta ao cliente»", () => {
    for (const t of [
      { valorFixo: 130, taxa: 0.2, precoAoCliente: 130 },
      { valorFixo: 250, taxa: null, precoAoCliente: 273 },
      { valorFixo: 333.33, taxa: 0.1, precoAoCliente: 333.33 },
    ]) {
      expect(contasDoTrabalhoClyon(t)!.cliente).toBe(precoDaPropostaClyon(t)!.total);
      expect(contasDoTrabalhoClyon(t)!.parceira).toBe(precoDaPropostaClyon(t)!.iva);
    }
  });

  it("um antigo sem preço ao cliente não tem conta — não se inventa", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 250, taxa: null, precoAoCliente: null })).toBeNull();
  });

  it("um antigo com o preço abaixo do que o pro recebe mostra a CLYON a perder, e não esconde", () => {
    expect(contasDoTrabalhoClyon({ valorFixo: 250, taxa: null, precoAoCliente: 240 })!.clyon).toBe(-10);
  });

  it("a empresa parceira é a que emite a factura", () => {
    expect(EMPRESA_PARCEIRA).toBe("Miragem Dourada");
  });
});

describe("no cartão do trabalho", () => {
  const PAGINA = readFileSync(join(process.cwd(), "src/components/admin/AdminTrabalhosClyonPanel.tsx"), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("as quatro partes, pela conta única, e nenhuma num cancelado", () => {
    expect(PAGINA).toContain('const contas = r.fase === "cancelada" ? null : contasDoTrabalhoClyon(t);');
    for (const rotulo of ["O cliente paga", "Passa à empresa parceira", "O profissional recebe", "Fica para a CLYON"]) {
      expect(PAGINA).toContain(`rotulo="${rotulo}"`);
    }
    expect(PAGINA).toContain("valor={contas.parceira}");
    expect(PAGINA).toContain("IVA da factura · {EMPRESA_PARCEIRA}");
  });

  it("os antigos continuam a poder escrever e mudar o preço ao cliente", () => {
    expect(PAGINA).toContain("Falta o preço ao cliente");
    expect(PAGINA).toContain("setPrecoEscrito(contas.semIva.toFixed(2).replace(\".\", \",\"));");
  });
});

describe("no editor do valor e da taxa", () => {
  const desenhar = (valor: string, taxa: number | null) =>
    renderToStaticMarkup(
      createElement(ValorETaxaDoTrabalho, { valor, taxa, onValor: () => {}, onTaxa: () => {} }),
    ).replace(/<!-- -->/g, "");

  it("o IVA da empresa parceira aparece entre o profissional e o cliente", () => {
    const html = desenhar("130", 0.2);
    const pro = html.indexOf("O profissional recebe");
    const parceira = html.indexOf("Empresa parceira");
    const cliente = html.indexOf("O cliente paga");
    expect(parceira).toBeGreaterThan(pro);
    expect(cliente).toBeGreaterThan(parceira);
    expect(html.slice(parceira, cliente)).toContain("29,90 €");
    expect(html.slice(parceira, cliente)).toContain("Miragem Dourada");
    expect(html.slice(cliente)).toContain("159,90 €");
  });
});
