import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aindaNaoEstaNaData, diaDoTrabalhoPorExtenso } from "./ainda-nao-esta-na-data";

/**
 * A TELA VERMELHA DOS TRABALHOS QUE AINDA NÃO ESTÃO NA DATA — 14-10-2026.
 *
 * «Os pedidos futuros devem ter uma proteção extra para serem confirmados que
 * foram realizados ou apagados: deve aparecer uma tela vermelha perguntando se
 * tem a certeza que quer continuar, pois esse pedido AINDA NÃO ESTÁ NA DATA.»
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Quarta, 14 de outubro de 2026, 15:00 em Lisboa (14:00 UTC, horário de Verão).
const AGORA = new Date("2026-10-14T14:00:00Z");

describe("ainda não está na data — contado em Lisboa", () => {
  it("amanhã e depois ainda não chegaram; ontem já passou", () => {
    expect(aindaNaoEstaNaData("2026-10-15T09:00:00Z", AGORA)).toBe(true);
    expect(aindaNaoEstaNaData("2026-10-19T08:00:00Z", AGORA)).toBe(true);
    expect(aindaNaoEstaNaData("2026-10-13T09:00:00Z", AGORA)).toBe(false);
  });

  it("hoje: só se tem hora marcada e ela ainda não passou", () => {
    expect(aindaNaoEstaNaData("2026-10-14T17:00:00Z", AGORA)).toBe(true); // 18:00 em Lisboa
    expect(aindaNaoEstaNaData("2026-10-14T08:00:00Z", AGORA)).toBe(false); // 09:00, já passou
    expect(aindaNaoEstaNaData("2026-10-13T23:00:00Z", AGORA)).toBe(false); // meia-noite de hoje: sem hora
  });

  it("sem dia, não se pergunta nada", () => {
    expect(aindaNaoEstaNaData(null, AGORA)).toBe(false);
    expect(aindaNaoEstaNaData("", AGORA)).toBe(false);
    expect(aindaNaoEstaNaData("isto não é data", AGORA)).toBe(false);
  });

  it("o dia por extenso, com a hora quando a há", () => {
    expect(diaDoTrabalhoPorExtenso("2026-10-19T09:00:00Z")).toContain("19 de outubro");
    expect(diaDoTrabalhoPorExtenso("2026-10-19T09:00:00Z")).toContain("às 10:00");
    expect(diaDoTrabalhoPorExtenso("2026-10-18T23:00:00Z")).not.toContain("às");
  });
});

describe("a tela vermelha", () => {
  const A = ler("src/components/admin/AvisoDeDataFutura.tsx");

  it("diz que ainda não está na data, o dia de cada um, e começa no «não»", () => {
    expect(A).toContain('"Este pedido ainda não está na data"');
    expect(A).toContain("marcado para {diaDoTrabalhoPorExtenso(t.quando)}");
    expect(A).toContain("Tem a certeza que quer continuar?");
    expect(A).toContain("border-red-500 bg-red-950");
    // O foco começa em «Não, voltar», e Esc é «não».
    expect(A.indexOf("autoFocus")).toBeLessThan(A.indexOf("Sim, continuar mesmo assim"));
    expect(A).toContain('if (e.key === "Escape") onResponder(false);');
  });

  it("só aparece quando há trabalhos que ainda não chegaram — os outros passam como antes", () => {
    expect(A).toContain("if (futuros.length === 0) return Promise.resolve(true);");
  });
});

describe("em todos os sítios que dão por feito, apagam ou pagam", () => {
  const casos: Array<[string, string[]]> = [
    [
      "src/components/admin/AdminNegociacoesPanel.tsx",
      ['quantos === 1 ? "apagar este pedido" : "apagar estes pedidos"', '"confirmar que estes trabalhos estão feitos"', '"confirmar que este trabalho está feito"'],
    ],
    ["src/components/admin/AdminTrabalhosClyonPanel.tsx", ['"confirmar que este trabalho está feito"']],
    [
      "src/components/admin/AdminPagamentosPanel.tsx",
      ['"marcar como pago ao profissional"', '"excluir este trabalho"', '"marcar como pagos aos profissionais"'],
    ],
    ["src/components/admin/LegacyAdminClient.tsx", ['"apagar estes pedidos"', '"marcar este pedido como realizado"']],
    ["src/components/admin/PedidoDetailModal.tsx", ['"apagar este pedido"', '"marcar este pedido como concluído"']],
    ["src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx", ['"apagar este pedido"']],
  ];
  for (const [ficheiro, accoes] of casos) {
    it(ficheiro, () => {
      const F = ler(ficheiro);
      expect(F).toContain("useAvisoDeDataFutura()");
      expect(F).toContain("{avisoDeData}");
      for (const a of accoes) expect(F).toContain(a);
    });
  }

  it("as Negociações sabem o dia que o cliente pediu", () => {
    expect(ler("src/lib/db.ts")).toContain("dataAgendada: (p.dataAgendada as Date) ?? null,");
  });
});
