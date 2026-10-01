import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { perguntaDoOrcamento, valoresDoQueOClienteEscreveu } from "./orcamento-do-cliente";
import { precoParaOCliente } from "./preco-do-cliente";
import { IVA_INCLUIDO_DESDE, modeloDeHoje } from "./iva-incluido";
import { TAXAS_DE_ORIGEM, type Taxas } from "./taxas-plataforma";

/**
 * «QUANTO CONTA GASTAR? — COMO PREÇO COM IVA.» Decisão do dono, 01-10-2026.
 *
 * Desde o IVA incluído, o número que o cliente escreve no pedido é o que ele
 * conta pagar com a taxa e os 23 %; o profissional vê o equivalente dele, sem
 * IVA. Pedidos anteriores ficam como estavam.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const COM = "iva_incluido" as const;
const SEM = "sem_iva" as const;

describe("o número do cliente faz a volta antes de se gravar", () => {
  it("100 € com IVA são 77,43 € para o profissional — e 77,43 € voltam a dar 100,00 €", () => {
    const v = valoresDoQueOClienteEscreveu(100, TAXAS_DE_ORIGEM, COM);
    expect(v).toEqual({ valorDesejadoCliente: 77.43, valorDoClienteComIva: 100 });
    expect(precoParaOCliente(77.43, TAXAS_DE_ORIGEM, COM)).toBe(100);
  });

  it("nunca passa do que ele escreveu: fica o cêntimo de baixo quando não há conta exacta", () => {
    for (const escrito of [37, 99.99, 150, 233.33, 452.03, 1000]) {
      const v = valoresDoQueOClienteEscreveu(escrito, TAXAS_DE_ORIGEM, COM);
      const volta = precoParaOCliente(v.valorDesejadoCliente, TAXAS_DE_ORIGEM, COM);
      expect(volta, String(escrito)).toBeLessThanOrEqual(escrito);
      // E a três cêntimos, no máximo (o salto entre dois preços possíveis).
      expect(escrito - volta, String(escrito)).toBeLessThanOrEqual(0.03 + 1e-9);
    }
  });

  it("segue as taxas de hoje (as que a negociação vai gravar)", () => {
    const outras: Taxas = { cliente: 0.07, profissional: 0.06 };
    const v = valoresDoQueOClienteEscreveu(100, outras, COM);
    expect(precoParaOCliente(v.valorDesejadoCliente, outras, COM)).toBeLessThanOrEqual(100);
    expect(v.valorDesejadoCliente).toBeLessThan(77.43);
  });

  it("antes do corte nada muda: grava-se o que foi escrito, e não há valor com IVA", () => {
    expect(valoresDoQueOClienteEscreveu(100, TAXAS_DE_ORIGEM, SEM)).toEqual({
      valorDesejadoCliente: 100,
      valorDoClienteComIva: null,
    });
  });

  it("o modelo é o do momento em que o pedido se grava", () => {
    expect(modeloDeHoje(new Date(IVA_INCLUIDO_DESDE.getTime() - 1))).toBe(SEM);
    expect(modeloDeHoje(IVA_INCLUIDO_DESDE)).toBe(COM);
  });
});

describe("a rota do pedido grava o equivalente, e guarda o escrito ao lado", () => {
  const ROTA = semComentarios(ler("src/app/api/simulador/pedido/route.ts"));

  it("converte com o modelo de hoje e as taxas de hoje", () => {
    expect(ROTA).toContain("const modelo = modeloDeHoje();");
    expect(ROTA).toContain("valoresDoQueOClienteEscreveu(");
    expect(ROTA).toContain('modelo === "iva_incluido" ? await taxasActuais() : undefined');
    expect(ROTA).toContain("valorDesejadoCliente: String(v.valorDesejadoCliente),");
    expect(ROTA).toContain("valorDoClienteComIva: String(v.valorDoClienteComIva)");
  });

  it("o valor de partida sai do equivalente (e a estimativa nunca é convertida)", () => {
    // O arranque lê o que ficou gravado — já o valor do profissional.
    expect(ROTA).toContain("clienteIndicouValores ? valoresParaGravar.valorDesejadoCliente : null,");
    // A estimativa entra por outro ramo, sem passar pela volta do IVA.
    expect(ROTA).toContain("valoresParaGravar = { valorDesejadoCliente: String(valorDeArranque) };");
  });

  it("o email repete-lhe o que ELE escreveu, com IVA", () => {
    expect(ROTA).toContain(
      "Number(valoresParaGravar.valorDoClienteComIva ?? valoresParaGravar.valorDesejadoCliente)",
    );
    expect(ROTA).toContain("valorDesejadoComIva: valoresParaGravar.valorDoClienteComIva != null,");
    const email = ler("src/lib/email-pedido.ts");
    expect(email).toContain("Disse que conta pagar <strong>${minimo}</strong>, com IVA.");
  });

  it("a coluna existe, e não sai para o profissional", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("ALTER TABLE simulatorOrders ADD COLUMN valorDoClienteComIva DECIMAL(10,2)");
    expect(db).toContain("const MIGRATION_VERSION = 15;");
    // `vistaDoProfissional` é uma lista fechada; o valor com IVA não está nela.
    const valores = ler("src/lib/pedido-valores.ts");
    expect(valores).not.toContain("valorDoClienteComIva");
  });
});

describe("os formulários dizem «com IVA» — desde o corte", () => {
  it("as palavras de cada modelo", () => {
    expect(perguntaDoOrcamento(COM).rotulo).toContain("com IVA");
    expect(perguntaDoOrcamento(COM).ajuda).toContain("com IVA e a taxa CLYON incluídos");
    expect(perguntaDoOrcamento(SEM).rotulo).not.toContain("IVA");
  });

  it("o pedido da plataforma e o simulador perguntam pelo modelo de hoje", () => {
    const pedir = semComentarios(ler("src/app/plataforma/pedir/components/ValoresEFaturacao.tsx"));
    expect(pedir).toContain("perguntaDoOrcamento(modeloDeHoje())");
    expect(pedir).toContain("{pergunta.rotulo} *");
    expect(pedir).not.toContain("Valor desejado *");
    const simulador = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(simulador).toContain('temIvaIncluido(modeloDeHoje()) ? "Quanto conta gastar, com IVA?"');
  });

  it("o backoffice vê o que o cliente escreveu e o que o profissional vê", () => {
    const modal = ler("src/components/admin/PedidoDetailModal.tsx");
    expect(modal).toContain("€ com IVA");
    expect(modal).toContain("para o profissional:");
    const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa).toContain("o cliente conta pagar ${euros(p.valorDoClienteComIva)} c/IVA");
  });
});
