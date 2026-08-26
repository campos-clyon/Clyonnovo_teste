import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Um trabalho feito é a vez dele.
 *
 * A Sthefanny fez a recolha e marcou. Ele tinha-lhe escrito pelo WhatsApp
 * "marca concluído para abrir o pagamento" e ela respondeu "já está" — e
 * estava mesmo: `execucaoEnviadaEm` ficou gravado às 16:00:47. Mas a mesa
 * continuou a dizer "✓ Acordada por 170,00 € com Sthefanny Lemos", debaixo de
 * "A CORRER — a bola está do outro lado", com exactamente as mesmas palavras
 * que dizia antes de ela lá ir. O único sítio onde a prova aparecia era dentro
 * da negociação, expandida uma a uma.
 *
 * Não foi caso único: o #219 tinha a prova enviada desde 25 de Agosto às 09:12
 * e ficou arquivado sem ninguém confirmar nada. É `confirmadoEm` que fecha o
 * pedido e liberta o dinheiro cativo — enquanto ele não existir, o
 * profissional foi lá e não recebeu.
 *
 * Estes testes prendem as três coisas que faziam o sinal desaparecer: a
 * definição, o nível onde o pedido cai, e as palavras da linha.
 */

const PAINEL = readFileSync(
  join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"),
  "utf8",
);

describe("esperar confirmação", () => {
  it("é prova enviada e confirmação em falta", () => {
    const i = PAINEL.indexOf("function esperaConfirmacao(");
    expect(i).toBeGreaterThan(-1);
    const corpo = PAINEL.slice(i, PAINEL.indexOf("\n}", i));
    expect(corpo).toContain("n.execucaoEnviadaEm != null");
    expect(corpo).toContain("n.confirmadoEm == null");
    // Quem desistiu ou morreu não deixou trabalho nenhum por confirmar.
    expect(corpo).toContain('n.estado === "desistida" || n.estado === "morta"');
  });

  it("não depende de o pedido estar acordado — é a execução que conta", () => {
    // O #226 estava `acordada` e o #219 também: se a condição pedisse outro
    // estado, os dois continuavam invisíveis.
    const i = PAINEL.indexOf("function esperaConfirmacao(");
    const corpo = PAINEL.slice(i, PAINEL.indexOf("\n}", i));
    expect(corpo).not.toContain('=== "acordada"');
  });
});

describe("de quem é a vez", () => {
  it("um trabalho por confirmar conta tanto como uma proposta por responder", () => {
    const i = PAINEL.indexOf("function precisaDeSi(");
    const corpo = PAINEL.slice(i, PAINEL.indexOf("\n}", i));
    expect(corpo).toContain("esperaConfirmacao(n)");
    expect(corpo).toContain("esperaResposta(n)");
  });

  it("o nível do topo lê precisaDeSi, e não só as propostas pendentes", () => {
    expect(PAINEL).toContain("visiveis.filter((p) => p.negociacoes.some(precisaDeSi))");
    expect(PAINEL).toContain("visiveis.filter((p) => !p.negociacoes.some(precisaDeSi))");
    // Era esta a linha que mandava o #226 para "A correr".
    expect(PAINEL).not.toContain("p.negociacoes.some(esperaResposta)).sort(porData)");
  });

  it("a linha da mesa diz que o trabalho está feito, e diz antes de tudo", () => {
    const i = PAINEL.indexOf("const bola = concluido");
    const bloco = PAINEL.slice(i, PAINEL.indexOf("return (", i));
    expect(bloco).toContain("Trabalho feito por");
    expect(bloco).toContain("falta confirmar");
    // ANTES do ramo das propostas: um pedido onde alguém já lá foi não deve
    // anunciar-se pela proposta pendente de outro profissional.
    expect(bloco.indexOf("feito")).toBeLessThan(bloco.indexOf(": espera"));
    // E antes do "Acordada", que era o que aparecia.
    expect(bloco.indexOf("feito")).toBeLessThan(bloco.indexOf("✓ Acordada por"));
  });

  it("o distintivo distingue confirmar de responder — não são a mesma acção", () => {
    expect(PAINEL).toContain("trabalho feito — falta confirmar");
    const i = PAINEL.indexOf("{precisaDeSi(n) && (");
    const distintivo = PAINEL.slice(i, i + 600);
    expect(distintivo).toContain("esperaConfirmacao(n)");
    expect(distintivo).toContain("amber");
  });
});
