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
    const grupos = entre("  contratados: [\n", "  ],\n");
    expect(grupos.indexOf('fase: "a_executar"')).toBeLessThan(grupos.indexOf('fase: "a_confirmar"'));
    expect(grupos).toContain('titulo: "Por fazer"');
    expect(grupos).toContain('titulo: "À espera da confirmação"');
    expect(T).toContain("const grupos = GRUPOS[separador] ?? null;");
    expect(T).toContain(
      "const naLista = grupos ? [...visiveis].sort((a, b) => ordemDoGrupo(a) - ordemDoGrupo(b)) : visiveis;",
    );
    expect(T).toContain("{naLista.map((p, i) => {");
    expect(T).toContain("grupos && (i === 0 || naLista[i - 1].fase !== p.fase)");
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

describe("os Terminados — «faça o mesmo separador nos Terminados»", () => {
  it("primeiro os confirmados (verde, na carteira), depois os pagos (azul, transferidos)", () => {
    const grupos = entre("  terminados: [\n", "  ],\n");
    expect(grupos.indexOf('fase: "confirmado"')).toBeLessThan(grupos.indexOf('fase: "pago"'));
    expect(grupos).toContain('titulo: "Confirmados"');
    expect(grupos).toContain('titulo: "Pagos"');
    const FASE = entre("const FASE: Record<string, { texto: string; cls: string; borda: string }> = {", "\n};\n");
    const confirmado = FASE.slice(FASE.indexOf("confirmado:"), FASE.indexOf("pago:"));
    const pago = FASE.slice(FASE.indexOf("pago:"));
    expect(confirmado).toContain('borda: "border-emerald-400 ring-1 ring-emerald-200"');
    expect(pago).toContain('borda: "border-sky-400 ring-1 ring-sky-200"');
    // O pago já não é cinzento com borda verde: tem a sua cor.
    expect(pago).not.toContain("emerald");
  });
});

describe("o dia de um trabalho já feito não vai a vermelho", () => {
  it("só o que está por fazer e passou do dia é atraso — no cartão e no detalhe", () => {
    const feito = entre("function trabalhoFeito(p: Pedido): boolean {", "\n}\n");
    expect(feito).toContain('p.fase === "a_confirmar" || p.fase === "confirmado" || p.fase === "pago"');
    expect(feito).not.toContain("a_executar");
    expect(T).toContain('quando.passou && !trabalhoFeito(p) ? "font-semibold text-rose-600" : ""');
    expect(T).toContain("const diaAtrasado = quandoDoPedido.passou && !feito;");
    expect(T).not.toContain("quandoDoPedido.passou ?");
    // E o aviso «o dia combinado já passou, corrija-o» não aparece num trabalho feito.
    expect(T).toContain("{quandoDoPedido.aviso && !feito && (");
  });
});
