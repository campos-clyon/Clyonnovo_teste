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

/** Onde acaba a função que começa em `i` — a primeira chaveta na coluna zero. */
function fimDaFuncao(i: number): number {
  const fim = PAINEL.slice(i).search(/^\}/m);
  return fim === -1 ? PAINEL.length : i + fim;
}


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

describe("concluído é concluído", () => {
  it("um trabalho confirmado conta como concluído, mesmo com o pedido arquivado", () => {
    const i = PAINEL.indexOf("function pedidoConcluido(");
    expect(i).toBeGreaterThan(-1);
    const corpo = PAINEL.slice(i, fimDaFuncao(i));
    expect(corpo).toContain('p.status === "concluido"');
    expect(corpo).toContain("n.confirmadoEm != null");
  });

  it("as duas listas e o cartão usam a mesma regra", () => {
    // O #219 estava arquivado desde 25 de Agosto. Ele confirmou-o e libertou
    // os 100,00 € ao Manuel Martins, e a mesa continuou a mostrá-lo em "A
    // CORRER — ✓ Acordada", como se ainda houvesse alguém a jogar.
    expect(PAINEL).toContain("ordenados.filter(pedidoConcluido)");
    expect(PAINEL).toContain("ordenados.filter((p) => !pedidoConcluido(p))");
    expect(PAINEL).toContain("const concluido = pedidoConcluido(p);");
    // Nenhuma das três pode voltar a ler a coluna sozinha.
    expect(PAINEL).not.toContain('ordenados.filter((p) => p.status === "concluido")');
  });

  it("deixa de pedir confirmação depois de confirmado", () => {
    const i = PAINEL.indexOf("function esperaConfirmacao(");
    const corpo = PAINEL.slice(i, fimDaFuncao(i));
    expect(corpo).toContain("n.confirmadoEm == null");
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

  it("o cartão mostra a confirmação sem ter de abrir a negociação", () => {
    // Isto EXISTIA — prova, contas, botão — mas dentro da negociação, atrás de
    // um segundo toque no nome do profissional. Abrir o pedido mostrava quatro
    // linhas de nomes e nem uma palavra sobre alguém já lá ter ido.
    const i = PAINEL.indexOf("{feito && (");
    expect(i).toBeGreaterThan(-1);
    const bloco = PAINEL.slice(i, PAINEL.indexOf("<div className=\"mt-3 flex flex-wrap items-center gap-2 border-t", i));
    expect(bloco).toContain("deu o trabalho por feito");
    expect(bloco).toContain("<ConfirmarPelaClyon");
    // A prova à vista, e as contas vêm com o próprio ConfirmarPelaClyon.
    expect(bloco).toContain("provaDe(feito.provaJson)");
    expect(bloco).toContain("prova.fotos.map");
  });

  it("quando não é a CLYON a confirmar, diz porquê em vez de mostrar um botão que dá 403", () => {
    const i = PAINEL.indexOf("{feito && (");
    const bloco = PAINEL.slice(i, PAINEL.indexOf("<div className=\"mt-3 flex flex-wrap items-center gap-2 border-t", i));
    expect(bloco).toContain("clyonPodeConfirmar(p) ?");
    expect(bloco).toContain("porqueNaoPodeConfirmar(");
  });

  it("confirmar recarrega a mesa — senão o cartão ficava a dizer que falta confirmar", () => {
    const i = PAINEL.indexOf("<ConfirmarPelaClyon");
    const uso = PAINEL.slice(i, PAINEL.indexOf("/>", i));
    expect(uso).toContain("onMudou=");
  });

  it("o distintivo distingue confirmar de responder — não são a mesma acção", () => {
    expect(PAINEL).toContain("trabalho feito — falta confirmar");
    const i = PAINEL.indexOf("{precisaDeSi(n) && (");
    const distintivo = PAINEL.slice(i, i + 600);
    expect(distintivo).toContain("esperaConfirmacao(n)");
    expect(distintivo).toContain("amber");
  });
});
