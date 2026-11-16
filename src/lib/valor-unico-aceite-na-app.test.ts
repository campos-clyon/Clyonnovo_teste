import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ESTADO_DO_VALOR_UNICO, estadoDoPedidoParaOCliente } from "./pedido-para-a-app";
import { VALOR_UNICO_ACEITE } from "./promessas-publicas";

/*
 * d53 (16-11-2026), o ponto das Apps: a app já instalada mostrava «Para
 * aceitar, responda SIM» e o «Aceitar» enquanto o servidor mandasse
 * `pedido.valorUnico`. Aceite, o servidor manda `valorUnico: null` e o estado
 * «Aceitou o valor. A CLYON está a escolher o parceiro.» — a frase do site.
 */

const raiz = path.resolve(__dirname, "..", "..");
const ler = (f: string) => readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

const base = { status: "novo", trabalhoClyon: false, contratado: null, comPropostas: 0, enviado: true };

describe("o valor único aceite, na app", () => {
  it("o estado diz que aceitou, com a frase do site", () => {
    expect(estadoDoPedidoParaOCliente({ ...base, valorUnico: true, valorUnicoAceite: true })).toBe(VALOR_UNICO_ACEITE);
    expect(VALOR_UNICO_ACEITE).toBe("Aceitou o valor. A CLYON está a escolher o parceiro.");
  });

  it("por aceitar continua «Orçamento por aceitar»", () => {
    expect(estadoDoPedidoParaOCliente({ ...base, valorUnico: true })).toBe(ESTADO_DO_VALOR_UNICO);
  });

  it("o servidor deixa de mandar o valorUnico depois do aceite (a app tira o «Aceitar» sem update)", () => {
    const r = ler("src/lib/pedidos-do-cliente.ts");
    expect(r).toContain("!contratado && !trabalhoClyon && !valorUnicoAceite ? valorUnicoParaOCliente(v, base) : null");
    expect(r).toMatch(/const valorUnicoAceite = valorUnicoAceiteValido\(\s*\(pedido as \{ valorUnicoAceiteEm\?: unknown \}\)\.valorUnicoAceiteEm,\s*\(pedido as \{ valorUnicoEm\?: unknown \}\)\.valorUnicoEm,/);
    expect(r).toContain("valorUnicoAceite: aceites.has(Number(r.id))");
    expect(r).toContain("valorUnicoAceite: r.valorUnicoAceite === true,");
  });
});
