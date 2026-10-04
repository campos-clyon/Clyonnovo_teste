import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A MESA ORDENA PELO NÚMERO DO PEDIDO, o mais alto em cima — 04-10-2026.
 *
 * "Coloque os pedidos por ordem … do número do pedido, do mais recente no
 * topo para os mais antigos; todas as categorias devem seguir essa ordem."
 *
 * Cada bloco fazia a sua conta pela data de criação, e os concluídos e os
 * cancelados vinham pela ordem da base. O que este teste guarda é que a ordem
 * é UMA e é a do número, nas listas de onde saem todos os blocos.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
// Sem comentários — a regra ancorada ao início da linha (ver
// tirar-comentarios-sem-comer-codigo.test.ts).
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx").replace(
  /^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm,
  "",
);

/** Do início de `marca` até ao `useMemo` / bloco seguinte. */
function trecho(marca: string, fim: string): string {
  const i = MESA.indexOf(marca);
  expect(i).toBeGreaterThan(-1);
  const j = MESA.indexOf(fim, i);
  expect(j).toBeGreaterThan(i);
  return MESA.slice(i, j);
}

describe("a ordem da mesa", () => {
  it("é a do número, do mais alto para o mais baixo", () => {
    expect(MESA).toMatch(
      /function porNumero\(a: \{ id: number \}, b: \{ id: number \}\): number \{\s*return b\.id - a\.id;\s*\}/,
    );
  });

  it("os pedidos com negociação saem já ordenados — concluídos e cancelados incluídos", () => {
    // `ordenados`, de onde saem os concluídos e os cancelados, é uma cópia
    // desta lista com um sort estável: herda a ordem do número.
    expect(trecho("const pedidosNaMesa = useMemo(", "const porPromoverNaMesa")).toContain(
      ".sort(porNumero)",
    );
  });

  it("os por enviar também", () => {
    expect(trecho("const porPromoverNaMesa = useMemo(", "const encontrados")).toContain(
      ".sort(porNumero)",
    );
  });

  it("dentro de cada bloco activo não volta a entrar a data", () => {
    const prateleiras = trecho("const activosOrdenados = useMemo(", "return saida;");
    expect(prateleiras.match(/\.sort\(porNumero\)/g)?.length).toBe(3);
    expect(prateleiras).not.toContain("createdAt");
    expect(prateleiras).not.toContain("porData");
  });
});
