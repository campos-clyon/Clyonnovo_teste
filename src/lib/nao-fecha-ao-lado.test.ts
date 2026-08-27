import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Um formulário aberto não se fecha com um clique ao lado.
 *
 * "Uma coisa que está a stressar-me muito: ao clicar sem querer fora dessa tela
 * ela fecha e perco o que estava a fazer. Vamos remover isso e deixá-la fechar
 * apenas clicando no botão fechar."
 *
 * Fechar ao clicar fora é hábito de janelas pequenas — uma confirmação, um
 * menu — onde não há nada dentro para perder. O editor de pedidos são catorze
 * campos, fotografias incluídas, e gravá-lo recomeça o pedido do zero. O gesto
 * mais barato que existe apagava o trabalho todo sem perguntar nada.
 *
 * E a margem escura à volta é grande de propósito, para o formulário respirar
 * — o que torna o clique ao lado MAIS provável, não menos.
 *
 * Ele apanhou um; havia três. O mesmo editor abre-se por dois caminhos, e o
 * painel das contas tinha o mesmo hábito.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ler = (p: string) => semComentarios(readFileSync(join(process.cwd(), p), "utf8"));

const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const MODAL = ler("src/components/admin/PedidoDetailModal.tsx");
const CONTAS = ler("src/components/admin/ContasPanel.tsx");
const EDITOR = ler("src/components/admin/RegistarPedido.tsx");

describe("nenhum painel com formulário fecha ao lado", () => {
  it("o editor de pedidos, nos dois caminhos por onde abre", () => {
    // O mesmo componente abre-se da mesa e do modal do pedido. Corrigir só um
    // deixava o outro a apagar trabalho.
    expect(PAINEL).not.toContain("if (e.target === e.currentTarget) setAEditarPlataforma(null);");
    expect(MODAL).not.toContain("setAVerificar(false);\n              setVersao");
  });

  it("o painel das contas", () => {
    expect(CONTAS).not.toContain("if (e.target === e.currentTarget) onFechar();");
  });

  it("o agendamento no calendário", () => {
    expect(MODAL).not.toContain("if (e.target === e.currentTarget) setCalendarModalOpen(false);");
  });

  it("não sobra nenhum deles em lado nenhum", () => {
    for (const [nome, f] of [
      ["mesa", PAINEL],
      ["modal do pedido", MODAL],
      ["contas", CONTAS],
    ] as const) {
      expect(f, `${nome} ainda fecha ao clicar ao lado`).not.toContain(
        "e.target === e.currentTarget",
      );
    }
  });
});

describe("mas continua a haver por onde sair", () => {
  it("o editor tem o seu botão de fechar", () => {
    // Tirar a saída acidental não pode ser tirar a saída.
    expect(EDITOR).toContain("onFechar();");
    expect(EDITOR).toContain("Fechar");
  });

  it("o painel das contas tem o seu", () => {
    expect(CONTAS).toContain("onClick={onFechar}");
  });

  it("o agendamento tem o seu", () => {
    expect(MODAL).toContain("setCalendarModalOpen(false)");
  });
});
