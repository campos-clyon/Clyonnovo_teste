import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TRANSIÇÕES LIMPAS E A AGENDA NA SEMANA — ordem do CEO com o sim do dono,
 * 02-11-2026. Ao abrir um pedido viam-se dois ecrãs ao mesmo tempo (a
 * transição do sistema do Android esvanece os dois); a Agenda da app Pro
 * abria sempre no Dia.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("uma só transição, com fundo opaco, nas duas apps", () => {
  it.each(["app-pro/src/app/_layout.tsx", "app-cliente/src/app/_layout.tsx"])("%s: slide_from_right e o fundo do tema", (f) => {
    const s = ler(f);
    expect(s).toContain('animation: "slide_from_right",');
    expect(s).toMatch(/contentStyle: \{ backgroundColor: (c\.fundo|CORES\.fundo) \}/);
    expect(s).not.toMatch(/presentation: "transparentModal"|animation: "fade"/);
  });

  it("o azul-noite da Pro é o fundo do modo escuro", () => {
    expect(ler("app-pro/src/tema.ts")).toContain('fundo: "#0F172A"');
  });

  it("outro pedido é outro ecrã: nunca mostra o anterior", () => {
    expect(ler("app-pro/src/app/trabalho/[id].tsx")).toContain("<Detalhe key={t.negociacaoId} t={t} />");
    expect(ler("app-cliente/src/app/pedido/[id].tsx")).toContain("<VistaDoPedido key={String(id)} pedidoId={pedidoId} />");
  });
});

describe("a Agenda abre na Semana", () => {
  const a = ler("app-pro/src/app/(app)/agenda.tsx");
  it("abre na Semana e volta à Semana ao sair para outro separador; a escolha não se guarda", () => {
    expect(a).toContain('const VISTA_AO_ABRIR: Vista = "semana";');
    expect(a).toContain("useState<Vista>(VISTA_AO_ABRIR)");
    expect(a).toContain('if (activo && activo !== "agenda") setVista(VISTA_AO_ABRIR);');
    expect(a).not.toMatch(/AsyncStorage|SecureStore|localStorage/);
  });
});
