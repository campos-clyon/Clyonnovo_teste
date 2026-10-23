import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { diaEHoraCurtosEmLisboa } from "./hora-de-lisboa";

/**
 * «TODOS OS PEDIDOS», MAIS APERTADO — 23-10-2026. *«Redesenhe esta página
 * para organizar as informações e aproveitar o espaço; dentro do cartão dos
 * pedidos, reduza os textos e os ícones uns 15 %, para caber mais informação,
 * bem organizada.»* — o dono.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const L = ler("src/components/admin/LegacyAdminClient.tsx");
const S = L.slice(L.indexOf('id="gestao-de-pedidos"'), L.indexOf("{/* Modal de confirmação de aceitar pedido */}"));

describe("o topo numa linha", () => {
  it("o título, os números como botões pequenos, o filtro e os botões", () => {
    expect(S).toContain('<h2 className="mr-1 text-[15px] font-semibold text-slate-900">Todos os pedidos</h2>');
    expect(S).toContain('{ key: "todos", label: "activos", n: activos,');
    expect(S).not.toContain("Total activos");
    expect(S).not.toContain("Pedidos do simulador");
    expect(S).toContain('aria-label="Filtrar pelo estado"');
  });
});

describe("a tabela mais apertada, com mais informação", () => {
  it("letras mais pequenas, linhas mais baixas, botões lado a lado", () => {
    expect(S).toContain('<table className="w-full min-w-[820px] border-collapse text-[13px]">');
    expect(S).not.toContain("py-3.5");
    expect(S).toContain('<div className="ml-auto flex items-center justify-end gap-1">');
    expect(S).not.toContain("max-w-[15rem] flex-wrap");
  });

  it("o serviço e a localidade numa coluna; quem o tem e para quando, por baixo", () => {
    expect(S).toContain('"Serviço e local"');
    expect(S).toContain("{p.assignedToName && (");
    expect(S).toContain("const para = instanteDaBase(p.dataAgendada ?? null);");
  });

  it("o dia, curto e em Lisboa — só o dia quando não há hora", () => {
    expect(diaEHoraCurtosEmLisboa(new Date("2026-10-20T08:00:00Z"))).toBe("20/10, 09:00");
    expect(diaEHoraCurtosEmLisboa(new Date("2026-10-19T23:00:00Z"))).toBe("20/10");
  });
});
