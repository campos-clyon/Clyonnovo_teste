import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MOTIVOS_DE_CANCELAMENTO, oQueSeDesfaz } from "./cancelamento";

/**
 * CANCELAR — na agenda também, e com o motivo em botões.
 *
 * "Coloque a opção de cancelar pedidos aqui também. Esses clientes desistem e
 * não há hora de cancelar; em vez de ter que colocar textos com o motivo,
 * dê-me opções tipo cliente desistiu, ou não deseja mais, já foi feito, etc."
 * — 10-09-2026.
 *
 * Duas coisas de uma vez. É na AGENDA que se dá pela desistência — liga-se ao
 * cliente para confirmar o dia e ouve-se «já não preciso» — e era o único ecrã
 * sem por onde cancelar: o caminho era sair, procurar o pedido noutro sítio e
 * perder a lista dos atrasados a meio.
 *
 * E o motivo era uma caixa de texto vazia. Escrever dá trabalho na hora em que
 * se quer despachar, e um ano depois ninguém consegue contar quantos pedidos
 * se perderam por desistência, porque cada pessoa escreveu a mesma coisa de
 * maneira diferente.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const CAIXA = ler("src/components/admin/CancelarPedido.tsx");
const FICHA = ler("src/components/admin/FichaDaAgenda.tsx");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");

describe("os motivos são uma lista fechada", () => {
  it("cobrem o que ele nomeou", () => {
    const todos = MOTIVOS_DE_CANCELAMENTO.join(" | ");
    expect(todos).toContain("O cliente desistiu");
    expect(todos).toContain("O cliente já não precisa");
    expect(todos).toContain("Já foi feito por outra pessoa");
  });

  it("«outro motivo» existe, e é o único que pede texto", () => {
    /*
     * Uma lista fechada a que falte a razão verdadeira obriga quem cancela a
     * escolher a mentira mais parecida — e é essa que fica no registo.
     */
    expect(MOTIVOS_DE_CANCELAMENTO as readonly string[]).not.toContain("Outro motivo");
    expect(CAIXA).toContain('[...MOTIVOS_DE_CANCELAMENTO, "Outro motivo"]');
    expect(CAIXA).toContain('const ehOutro = escolhido === "Outro motivo";');
  });

  it("vivem num sítio só, para os dois ecrãs dizerem o mesmo", () => {
    // Duas listas divergem à primeira alteração, e o registo fica com dois
    // vocabulários para a mesma coisa.
    expect(CAIXA).toContain('from "@/lib/cancelamento"');
    expect(FICHA).toContain('import CancelarPedido from "./CancelarPedido"');
    expect(MESA).toContain('import CancelarPedido from "./CancelarPedido"');
  });
});

describe("o peso do que se desfaz não se perdeu", () => {
  it("com alguém contratado, o motivo é obrigatório", () => {
    const d = oQueSeDesfaz([
      { estado: "acordada", valorAcordado: 260, profissionalNome: "TRSul" },
    ]);
    expect(d.temCompromisso).toBe(true);
    expect(d.motivoObrigatorio).toBe(true);
    expect(CAIXA).toContain("desfaz.motivoObrigatorio ? motivo.length > 0 : true");
  });

  it("sem ninguém contratado é arrumação, e passa sem motivo", () => {
    const d = oQueSeDesfaz([{ estado: "aberta", valorAcordado: null, profissionalNome: "X" }]);
    expect(d.motivoObrigatorio).toBe(false);
  });

  it("o aviso aparece ANTES, com o nome e o valor", () => {
    // O direito de cancelar é absoluto; absoluto não quer dizer silencioso.
    expect(CAIXA).toContain("avisoDoCancelamento(desfaz)");
    expect(CAIXA).toContain("{aviso}");
  });

  it("já pago, avisa que cancelar NÃO traz o dinheiro de volta", () => {
    const d = oQueSeDesfaz([
      { estado: "acordada", valorAcordado: 300, profissionalNome: "Sthefanny", pagoEm: "2026-09-01" },
    ]);
    expect(d.dinheiroJaLibertado).toBe(true);
  });
});

describe("a agenda ganhou o botão", () => {
  it("cancela sem sair da ficha", () => {
    expect(FICHA).toContain("Cancelar o pedido");
    expect(FICHA).toContain("setACancelar(true)");
  });

  it("o que a agenda mostra está sempre contratado — e o aviso segue o ponto", () => {
    /*
     * Tudo o que entra na agenda já tem profissional. O que muda o peso do
     * aviso é já estar confirmado ou pago, e é isso que vai daqui.
     */
    const bloco = FICHA.slice(FICHA.indexOf("<CancelarPedido"), FICHA.indexOf("/>", FICHA.indexOf("<CancelarPedido")) + 2);
    expect(bloco).toContain('estado: "acordada"');
    expect(bloco).toContain("confirmadoEm: t.jaConfirmado ? true : null");
    expect(bloco).toContain("pagoEm: t.jaPago ? true : null");
  });

  it("cancelado, a ficha fecha-se — a linha já não existe", () => {
    const bloco = FICHA.slice(FICHA.indexOf("onCancelado={"), FICHA.indexOf("onCancelado={") + 400);
    expect(bloco).toContain("onMudou()");
    expect(bloco).toContain("onFechar()");
  });
});

describe("a mesa deixou de usar o window.prompt", () => {
  it("o motivo já não se escreve à mão numa caixa do browser", () => {
    expect(MESA).not.toContain("window.prompt(");
    expect(MESA).toContain("setACancelar(p)");
  });
});
