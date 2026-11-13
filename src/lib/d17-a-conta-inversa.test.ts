import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  totalAoCliente,
  totalAoClienteDaNegociacao,
  valorDoPrecoEscrito,
  valorDoTotalAoCliente,
  valorDoTotalDaNegociacao,
} from "./total-ao-cliente";
import { baseDoPrecoDoCliente, precoDoCliente, precoParaOCliente } from "./preco-do-cliente";
import { valoresDoQueOClienteEscreveu } from "./orcamento-do-cliente";
import { mensagemDasPropostas, propostasParaOCliente } from "./mensagem-das-propostas";
import type { RegimeDoProfissional } from "./pagamento-directo";
import type { Taxas } from "./taxas-plataforma";

/**
 * D17 — OS DOIS SÍTIOS QUE FICARAM COM A CONTA ANTIGA (CEO e dono, 13-11-2026).
 *
 * 1. O preço que o cliente ESCREVE («posso pagar 358») volta ao valor do
 *    parceiro pela conta inversa do total do cartão, pelo regime dele.
 * 2. O texto do orçamento que a equipa copia na Mesa diz o total do cartão.
 *
 * 350 € a 0 % + 10 %: isento 358,05 €; com IVA 430,50 € (a conta actual).
 * Antes de 15-11 nada muda. Dados de teste.
 */

const TAXAS: Taxas = { cliente: 0, profissional: 0.1 };
const REGIMES: RegimeDoProfissional[] = ["isento", "normal"];
const totalCent = (cent: number, taxas: Taxas, regime: RegimeDoProfissional) =>
  Math.round(totalAoCliente(cent / 100, taxas, regime)!.total * 100);

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("a conta inversa do total ao cliente", () => {
  it("a paridade: 358,05 € isento e 430,50 € com IVA voltam a 350 €", () => {
    expect(totalAoCliente(350, TAXAS, "isento")!.total).toBe(358.05);
    expect(totalAoCliente(350, TAXAS, "normal")!.total).toBe(430.5);
    expect(valorDoTotalAoCliente(358.05, TAXAS, "isento")).toBe(350);
    expect(valorDoTotalAoCliente(430.5, TAXAS, "normal")).toBe(350);
  });

  for (const taxas of [TAXAS, { cliente: 0.05, profissional: 0.06 }, { cliente: 0, profissional: 0.11 }]) {
    for (const regime of REGIMES) {
      it(`ida e volta ao cêntimo (${regime}, ${taxas.cliente}/${taxas.profissional})`, () => {
        // Do valor para o total e de volta: o total repete-se exactamente.
        for (let s = 1; s <= 60000; s += 7) {
          const t = totalCent(s, taxas, regime);
          const v = valorDoTotalAoCliente(t / 100, taxas, regime)!;
          expect(totalCent(Math.round(v * 100), taxas, regime)).toBe(t);
        }
        // De um total qualquer: fica o de baixo — nunca acima, no máximo 3 cêntimos abaixo,
        // e um cêntimo a mais no valor já passava do escrito.
        for (let x = 100; x <= 80000; x += 13) {
          const v = valorDoTotalAoCliente(x / 100, taxas, regime)!;
          const c = Math.round(v * 100);
          const t = totalCent(c, taxas, regime);
          expect(t).toBeLessThanOrEqual(x);
          expect(x - t).toBeLessThanOrEqual(3);
          expect(totalCent(c + 1, taxas, regime)).toBeGreaterThan(x);
        }
      });
    }
  }

  it("um preço que não é preço não tem volta", () => {
    expect(valorDoTotalAoCliente(0, TAXAS, "normal")).toBeNull();
    expect(valorDoTotalAoCliente(-5, TAXAS, "normal")).toBeNull();
    expect(valorDoTotalAoCliente(Number.NaN, TAXAS, "normal")).toBeNull();
    expect(valorDoTotalAoCliente(200000, TAXAS, "normal")).toBeNull();
  });

  it("a negociação usa as taxas gravadas e o regime congelado ou o do perfil", () => {
    const isento = { taxaCliente: "0", taxaProfissional: "0.1000", regimeDoProfissional: "isento" };
    expect(valorDoTotalDaNegociacao(isento, 358.05)).toBe(350);
    // Sem regime congelado: o confirmado no perfil.
    const doPerfil = { taxaCliente: "0", taxaProfissional: "0.1000", regimeIva: "isento", regimeIvaConfirmadoEm: "2026-11-10T10:00:00Z" };
    expect(valorDoTotalDaNegociacao(doPerfil, 358.05)).toBe(350);
    // Por confirmar: como com IVA.
    const porConfirmar = { taxaCliente: "0", taxaProfissional: "0.1000", regimeIva: "isento", regimeIvaConfirmadoEm: null };
    expect(valorDoTotalDaNegociacao(porConfirmar, 430.5)).toBe(350);
  });
});

describe("o preço escrito pelo cliente (WhatsApp e ecrã do pedido)", () => {
  const linha = { taxaCliente: "0", taxaProfissional: "0.1000", regimeDoProfissional: "isento" };

  it("no modelo novo bate com o cartão", () => {
    const r = valorDoPrecoEscrito(linha, 358.05, "iva_incluido", true)!;
    expect(r).toEqual({ valor: 350, ficou: 358.05 });
    expect(totalAoClienteDaNegociacao(linha, r.valor)!.total).toBe(r.ficou);
  });

  it("antes de 15-11 a conta de sempre, sem mudar nada", () => {
    for (const preco of [100, 358.05, 430.5, 452.03]) {
      for (const modelo of ["iva_incluido", "sem_iva"] as const) {
        const r = valorDoPrecoEscrito(linha, preco, modelo, false)!;
        const t = { cliente: 0, profissional: 0.1 };
        expect(r.valor).toBe(baseDoPrecoDoCliente(preco, t, modelo));
        expect(r.ficou).toBe(precoParaOCliente(r.valor, t, modelo));
      }
    }
  });

  it("a Vitória e o ecrã do pedido passam pela porta única", () => {
    const wa = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
    expect(wa).toContain("valorDoPrecoEscrito(n, preco, modelo, novas.has(Number(n.id)))");
    expect(wa).not.toContain("baseDoPrecoDoCliente(");
    const ag = semComentarios(ler("src/lib/agir-como-cliente.ts"));
    expect(ag).toContain("valorDoPrecoEscrito(");
    expect(ag).toContain("negociacoesNoNovoModelo([linha], agoraDoModelo())");
  });
});

describe("o «quanto conta pagar» do pedido", () => {
  it("no modelo novo a volta é a conta inversa (como com IVA, sem parceiro ainda)", () => {
    const v = valoresDoQueOClienteEscreveu(430.5, TAXAS, "iva_incluido", true);
    expect(v).toEqual({ valorDesejadoCliente: 350, valorDoClienteComIva: 430.5 });
  });

  it("antes de 15-11 nada muda", () => {
    expect(valoresDoQueOClienteEscreveu(100, TAXAS, "iva_incluido")).toEqual({
      valorDesejadoCliente: baseDoPrecoDoCliente(100, TAXAS, "iva_incluido"),
      valorDoClienteComIva: 100,
    });
    expect(valoresDoQueOClienteEscreveu(100, TAXAS, "sem_iva", true)).toEqual({
      valorDesejadoCliente: 100,
      valorDoClienteComIva: null,
    });
  });

  it("a rota do simulador diz se o pedido nasce no modelo novo", () => {
    const rota = semComentarios(ler("src/app/api/simulador/pedido/route.ts"));
    expect(rota).toMatch(/valoresDoQueOClienteEscreveu\([\s\S]{0,300}novoModeloEmVigor\(agoraDoModelo\(\)\),\s*\)/);
  });
});

describe("o texto do orçamento que a equipa copia na Mesa", () => {
  const prop = JSON.stringify([{ por: "profissional", valor: 350, criadaEm: "2026-11-16T09:00:00Z", estado: "pendente" }]);
  const neg = (extra: Record<string, unknown>) => ({
    estado: "aberta",
    profissionalNome: "Parceiro de Teste",
    propostasJson: prop,
    taxaCliente: "0",
    taxaProfissional: "0.1000",
    criadaEm: "2026-11-16T08:00:00Z",
    ...extra,
  });
  const texto = (n: ReturnType<typeof neg>) =>
    mensagemDasPropostas({ nomeCliente: "Cliente", servico: "recolha de monos", propostas: propostasParaOCliente([n]) });

  it("isento: o número do cartão (358,05 €), não o da conta antiga", () => {
    const t = texto(neg({ noNovoModelo: true, regimeParaOTotal: "isento" }));
    expect(t).toContain("358,05 €");
    expect(t).not.toContain("430,50 €");
  });

  it("com IVA: 430,50 €", () => {
    expect(texto(neg({ noNovoModelo: true, regimeParaOTotal: "normal" }))).toContain("430,50 €");
  });

  it("antes de 15-11 (sem modelo novo) a conta de sempre, mesmo com regime", () => {
    const n = neg({ regimeParaOTotal: "isento", taxaCliente: "0.05" });
    const antigo = precoDoCliente(350, { cliente: 0.05, profissional: 0.1 }, "iva_incluido");
    expect(propostasParaOCliente([n])[0].aPagar).toBe(antigo.aPagar);
  });

  it("a rota da Mesa passa o regime das do modelo novo", () => {
    const rota = semComentarios(ler("src/app/api/admin/negociacoes/route.ts"));
    expect(rota).toContain("regimesDasNegociacoes([...doNovoModelo])");
    expect(rota).toContain("regimeParaOTotal: regimes.get(Number(n.id))");
  });
});
