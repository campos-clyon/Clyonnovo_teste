import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Gravar o pedido é gravar o pedido TODO.
 *
 * O #228 foi editado para 30 € e ficou com 121,43 € na base. O ecrã deu o
 * pedido por actualizado e mostrou 30,00 € como valor de partida — mas era o
 * formulário a mostrar-se a si próprio. A fotografia anexada desapareceu pelo
 * mesmo caminho, e a caixa da fatura também não guardava.
 *
 * `updateSimulatorOrder` filtra as colunas por uma lista de permitidos, e faz
 * bem: as chaves vão para a lista de colunas do SQL, e uma consulta preparada
 * parametriza valores, não identificadores. O `colunas-pedido.test.ts` já
 * garante que essa lista e o tipo dizem o mesmo.
 *
 * O que faltava era isto: o editor mandava TRÊS CAMPOS que nem o tipo nem a
 * lista conheciam, e um `as Parameters<typeof updateSimulatorOrder>[1]` calava
 * o TypeScript, que teria apanhado os três à primeira. Um molde forçado sobre
 * um objecto que se está a construir não converte nada — só manda calar.
 */

const EDITOR = readFileSync(
  join(process.cwd(), "src/app/api/admin/pedidos/[id]/editar/route.ts"),
  "utf8",
);

describe("o editor de pedidos", () => {
  it("não força o molde do tipo — é o TypeScript que tem de o proteger", () => {
    expect(EDITOR).not.toContain("as Parameters<typeof updateSimulatorOrder>");
  });

  it("grava o valor de partida, a fatura e as fotografias", () => {
    const i = EDITOR.indexOf("await updateSimulatorOrder(pedidoId, {");
    expect(i).toBeGreaterThan(-1);
    const chamada = EDITOR.slice(i, EDITOR.indexOf("});", i));
    expect(chamada).toContain("valorDesejadoCliente:");
    expect(chamada).toContain("precisaFatura:");
    expect(chamada).toContain("filesJson:");
  });

  it("não mandar fotografias não é o mesmo que apagá-las", () => {
    // Enquanto a coluna era ignorada isto não fazia diferença nenhuma. Agora
    // faz: um corpo sem o campo escreveria NULL e o pedido perdia as fotos.
    expect(EDITOR).toContain("const enviouFotografias = Array.isArray(corpo.files);");
    const i = EDITOR.indexOf("filesJson:");
    const linha = EDITOR.slice(i, i + 120).split(/\r?\n/)[0];
    expect(linha).toContain("enviouFotografias ?");
    // undefined é o que updateSimulatorOrder salta — a coluna nem entra no SQL.
    expect(linha).toContain("undefined");
  });
});
