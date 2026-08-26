import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Arquivar ao marcar.
 *
 * A barra que aparece quando se marcam pedidos dava duas saídas: desmarcar, ou
 * apagar. Quem tem seis pedidos velhos na mesa e os quer tirar da frente não
 * os quer apagar — quer arrumá-los. Sem esta opção, ou ficavam na mesa a
 * ocupar a vista, ou desapareciam para sempre por ser o único botão à mão.
 *
 * A outra barra da página — a dos pedidos por promover — já tinha arquivar
 * antes de apagar, e neutra. Esta ficou igual.
 */

const PAINEL = readFileSync(
  join(process.cwd(), "src/components/admin/AdminNegociacoesPanel.tsx"),
  "utf8",
);

describe("a barra dos marcados", () => {
  it("arquiva em lote, pela rota de arquivar um a um", () => {
    const i = PAINEL.indexOf("async function arquivarMarcados(");
    expect(i).toBeGreaterThan(-1);
    const corpo = PAINEL.slice(i, PAINEL.indexOf("\n  /**", i));
    expect(corpo).toContain("arquivarPedidos([...marcados])");
    // E limpa a marcação: deixar seis marcados depois de os arrumar é um
    // convite a carregar em apagar a seguir.
    expect(corpo).toContain("setMarcados(new Set())");
  });

  it("pergunta antes, e não com as palavras do apagar", () => {
    const i = PAINEL.indexOf("async function arquivarMarcados(");
    const corpo = PAINEL.slice(i, PAINEL.indexOf("\n  /**", i));
    expect(corpo).toContain("window.confirm");
    expect(corpo).toContain("Não são apagados.");
  });

  it("arquivar vem antes de apagar, como na outra barra", () => {
    const i = PAINEL.indexOf("{marcados.size > 0 && (");
    const barra = PAINEL.slice(i, PAINEL.indexOf("</div>\n        </div>", i));
    expect(barra.indexOf("arquivarMarcados")).toBeGreaterThan(-1);
    expect(barra.indexOf("arquivarMarcados")).toBeLessThan(barra.indexOf("apagarMarcados"));
  });

  it("a barra deixa de ser vermelha — o alarme fica no botão que o merece", () => {
    const i = PAINEL.indexOf("{marcados.size > 0 && (");
    const barra = PAINEL.slice(i, i + 900);
    expect(barra).not.toContain("bg-red-950/70");
    // O apagar continua vermelho.
    expect(PAINEL).toContain("bg-red-600 px-3 py-1.5 text-xs font-bold text-white");
  });

  it("os dois botões não podem correr ao mesmo tempo", () => {
    const i = PAINEL.indexOf("onClick={apagarMarcados}");
    const bloco = PAINEL.slice(i, i + 200);
    expect(bloco).toContain('ocupado === "lote-arquivar"');
  });
});
