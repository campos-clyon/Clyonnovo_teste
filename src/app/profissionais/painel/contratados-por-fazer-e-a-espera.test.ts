import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS CONTRATADOS EM DOIS GRUPOS, CADA UM DA SUA COR — 08-10-2026.
 *
 * «Os pedidos devem ser separados entre os "à espera de confirmação" e os "por
 * fazer"; coloque isso no lado da direita e com cores diferentes para serem
 * destacados; pode até mudar a cor das bordas dos cartões.»
 */

const T = readFileSync(join(process.cwd(), "src/app/profissionais/painel/Trabalhos.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

const entre = (inicio: string, fim: string) => {
  const i = T.indexOf(inicio);
  expect(i).toBeGreaterThan(-1);
  return T.slice(i, T.indexOf(fim, i));
};

describe("os Contratados do profissional", () => {
  it("por fazer é âmbar e à espera é violeta — na etiqueta e na borda do cartão", () => {
    const FASE = entre("const FASE: Record<string, { texto: string; cls: string; borda: string }> = {", "\n};\n");
    const porFazer = FASE.slice(FASE.indexOf("a_executar:"), FASE.indexOf("a_confirmar:"));
    const aEspera = FASE.slice(FASE.indexOf("a_confirmar:"), FASE.indexOf("confirmado:"));
    expect(porFazer).toContain('cls: "border-amber-400 bg-amber-100 text-amber-900"');
    expect(porFazer).toContain('borda: "border-amber-400 ring-1 ring-amber-200"');
    expect(aEspera).toContain('cls: "border-violet-300 bg-violet-100 text-violet-800"');
    expect(aEspera).toContain('borda: "border-violet-400 ring-1 ring-violet-200"');
    // Já não são o mesmo ciano.
    expect(porFazer).not.toContain("cyan");
    expect(aEspera).not.toContain("cyan");
    // E o cartão toma a borda da fase.
    expect(T).toContain('? (fase?.borda ?? "border-emerald-300 ring-1 ring-emerald-100")');
  });

  it("primeiro o que há para fazer, depois o que espera a confirmação, cada grupo com o seu título", () => {
    const grupos = entre("const GRUPOS_DOS_CONTRATADOS = [", "] as const;");
    expect(grupos.indexOf('fase: "a_executar"')).toBeLessThan(grupos.indexOf('fase: "a_confirmar"'));
    expect(grupos).toContain('titulo: "Por fazer"');
    expect(grupos).toContain('titulo: "À espera da confirmação"');
    expect(T).toContain(
      'separador === "contratados" ? [...visiveis].sort((a, b) => ordemDoGrupo(a) - ordemDoGrupo(b)) : visiveis;',
    );
    expect(T).toContain("{naLista.map((p, i) => {");
    expect(T).toContain('separador === "contratados" && (i === 0 || naLista[i - 1].fase !== p.fase)');
  });

  it("a etiqueta da fase está à direita, por cima do «há quanto tempo», e não na fila da esquerda", () => {
    const direita = entre(
      '<div className="ml-auto flex shrink-0 flex-col items-end gap-1">',
      "haQuantoTempo(p.actualizadoEm)}",
    );
    expect(direita).toContain("{fase.texto}");
    const filaDaEsquerda = entre('<div className="mt-1 flex flex-wrap gap-1.5">', "{sinais.map((sinal) => (");
    expect(filaDaEsquerda).not.toContain("fase.texto");
    expect(filaDaEsquerda).toContain("{estado.texto}");
  });
});
