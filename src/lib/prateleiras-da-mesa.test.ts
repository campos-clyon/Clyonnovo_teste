import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contratado e à espera de propostas não são a mesma coisa.
 *
 * "Temos que separar os pedidos já contratados dos à espera de propostas."
 *
 * Os dois viviam em "A correr", porque nos dois a bola está do outro lado. Mas
 * o outro lado não é o mesmo: um pedido à espera de propostas pode morrer de
 * silêncio — ninguém responde, o cliente fica sem resposta, e nós não damos
 * por isso — e um pedido contratado está fechado, com o dinheiro cativo, à
 * espera de um dia chegar.
 *
 * Na mesa lia-se um #242 «à espera de 2 profissionais» exactamente como um
 * #239 «acordada por 260 € com a TRSul», seguidos, com o mesmo peso.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");

/** O corpo do `useMemo` que constrói as prateleiras. */
const prateleiras = (() => {
  const i = MESA.indexOf("const activosOrdenados = useMemo(");
  expect(i).toBeGreaterThan(-1);
  return MESA.slice(i, MESA.indexOf("return saida;", i));
})();

describe("as três prateleiras", () => {
  it("o que precisa dele continua em primeiro", () => {
    // É o único nível onde a demora custa dinheiro.
    expect(prateleiras).toContain('bloco("n1", "Precisa de si"');
  });

  it("à espera de propostas vem ANTES dos contratados", () => {
    /*
     * A ordem não é cosmética: desce por risco. Um pedido sem proposta
     * nenhuma pode morrer sozinho; um contratado não precisa de nada.
     */
    expect(prateleiras.indexOf('"À espera de propostas"')).toBeLessThan(
      prateleiras.indexOf('"Contratados"'),
    );
  });

  it("o que separa as duas é haver uma negociação acordada", () => {
    expect(prateleiras).toContain('p.negociacoes.some((n) => n.estado === "acordada")');
  });

  it("nenhum pedido cai nas duas, nem fica de fora", () => {
    // Uma parte-se em duas com a mesma condição, negada. Sem isso, um pedido
    // desaparecia da mesa sem ninguém reparar.
    expect(prateleiras).toContain("const restantes = visiveis.filter((p) => !p.negociacoes.some(precisaDeSi));");
    expect(prateleiras).toContain(
      ".filter((p) => p.negociacoes.some((n) => n.estado === \"acordada\"))",
    );
    expect(prateleiras).toContain(
      ".filter((p) => !p.negociacoes.some((n) => n.estado === \"acordada\"))",
    );
  });

  it("cada nível diz de quem é a vez, e não só o nome", () => {
    expect(prateleiras).toContain("a bola está com os profissionais");
    expect(prateleiras).toContain("falta o trabalho acontecer");
  });
});

describe("os títulos só aparecem quando separam alguma coisa", () => {
  it("com um nível só, não há linha nenhuma", () => {
    /*
     * Antes a conta era feita entre duas listas. Com três, «precisam > 0 &&
     * correm > 0» deixaria a mesa sem títulos sempre que uma das pontas
     * estivesse vazia — mesmo com duas prateleiras cheias no meio.
     */
    expect(prateleiras).toContain(
      "const comCoisas = [precisam, aoAr, contratados].filter((l) => l.length > 0).length;",
    );
    expect(prateleiras).toContain("if (comCoisas > 1) {");
  });
});
