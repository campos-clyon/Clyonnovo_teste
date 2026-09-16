import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * As três pontas actualizam-se sozinhas, e ninguém carrega em nada.
 *
 * Pedido dele: "remova o botão de refresh e adicione o botão de voltar, o
 * refresh deve ser automático a cada 30s tanto para os pros, clientes e
 * admin, sem deixar a tela inativa, tudo feito por baixo e o usuário só ver
 * as novidades aparecer."
 *
 * Um botão de recarregar ao lado de um ecrã que já se actualiza sozinho não
 * é ajuda: é dúvida. Quem o vê assume que o que está no ecrã está velho.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PRO = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");
const CLIENTE = ler("src/app/conta/ContaCliente.tsx");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const CICLO = ler("src/components/admin/useAutoRefresh.ts");

describe("uma cadência só, nas três pontas", () => {
  /*
   * ISTO PEDIA 30 SEGUNDOS EM CADA FICHEIRO — e era essa a forma errada.
   *
   * "Vamos unificar tudo, fazer tudo actualizar junto em 20s com um único."
   * — 16-09-2026. Cada um dos vinte e dois sítios trazia o seu número, e para
   * mudar o ritmo era preciso mudar vinte e dois — e no dia seguinte já havia
   * um por mudar. Pior: dois painéis do mesmo ecrã mostravam estados de
   * momentos diferentes.
   *
   * O número passou a viver uma vez, no hook. O que isto guarda agora é que
   * NINGUÉM volte a trazer o seu.
   */
  it("o número vive num sítio só", () => {
    expect(CICLO).toContain("export const INTERVALO_DO_CICLO = 20_000");
  });

  it("e nenhum ecrã traz o seu", () => {
    for (const ficheiro of [PRO, CLIENTE, MESA]) {
      expect(ficheiro).not.toContain("intervalMs");
    }
  });

  it("o backoffice actualiza em SILÊNCIO — a lista não pode piscar", () => {
    // carregar(true) não acende estados de "a carregar": sem isto a lista
    // saltava a cada batida e um valor a ser escrito perdia-se.
    expect(MESA).toContain("useAutoRefresh(() => carregar(true))");
    expect(MESA).toContain("if (!silencioso) setACarregar(true);");
  });

  it("há um temporizador, e não um por ecrã", () => {
    // O pulso vive fora do React: é um recurso do separador, não de um
    // componente. Um setInterval por dentro de cada hook era o problema.
    expect(CICLO).toContain("const ouvintes = new Set<Batida>()");
    expect(CICLO.match(/setInterval\(/g)?.length).toBe(2); // o pulso + o relógio do "há N min"
  });

  it("e o ciclo pára com o separador escondido, em vez de gastar pedidos", () => {
    expect(CICLO).toContain("visibilitychange");
  });
});

describe("os botões", () => {
  it("o profissional deixa de ter recarregar e passa a ter saída", () => {
    expect(PRO).not.toContain('aria-label="Actualizar"');
    expect(PRO).toContain('aria-label="Voltar"');
    expect(PRO).toContain("<ArrowLeft");
  });

  it("e a saída funciona mesmo sem histórico — telemóvel, link do email", () => {
    /*
     * A propriedade continua a mesma; a forma de a cumprir é que mudou, e para
     * melhor: deixou de DEPENDER de histórico em vez de o consultar.
     *
     * Numa aplicação instalada não há botão de trás nenhum, e quem chega por
     * um link do email não tem página anterior. Antes havia um ramo para esse
     * caso; agora a hierarquia do painel — trabalho, lista, menu, site — é a
     * mesma com histórico e sem ele.
     */
    expect(PRO).not.toContain("window.history.back()");
    expect(PRO).toContain('window.location.href = "/"');
    expect(PRO).toContain("if (trabalhoAberto)");
  });

  it("a mesa troca o «Actualizar» por dizer quando leu", () => {
    expect(MESA).not.toContain("Actualizar\n        </button>");
    expect(MESA).toContain("actualizado agora");
    expect(MESA).toContain('aria-live="polite"');
  });

  it("e o relógio anda, para a frase não mentir sobre a hora", () => {
    // Sem isto "actualizado agora" congelava até algo mais redesenhar o ecrã.
    expect(MESA).toContain("setAgoraParaOReloginho(Date.now())");
  });
});
