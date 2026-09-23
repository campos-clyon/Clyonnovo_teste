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

/**
 * O array `BLOCOS` — e é ELE que decide a ordem no ecrã.
 *
 * O memo acima arruma os pedidos dentro de cada prateleira; a ordem por que as
 * prateleiras aparecem, em cima nos cartões e em baixo na mesa, sai daqui. São
 * duas coisas, e confundi-las já deixou passar uma mutação que mandava um
 * bloco inteiro para o fundo da página sem um único teste dar por isso.
 */
const blocos = (() => {
  const i = MESA.indexOf("const BLOCOS: Array<");
  expect(i).toBeGreaterThan(-1);
  return MESA.slice(i, MESA.indexOf("\n];", i));
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

describe("«Precisa de si» só tem o que precisa MESMO dele", () => {
  /*
   * "Vamos criar uma nova categoria que vai chamar-se «A aguardar Cliente».
   * Os pedidos que estão à espera de o cliente responder, hoje estão em
   * «Precisa de si», e vamos colocá-los aqui." — 23-09-2026.
   *
   * O ecrã já se contradizia sozinho: por baixo do título «Precisa de si»
   * com treze linhas, uma nota a dizer «4 pedidos estão à espera de si».
   * Os outros nove esperavam por um cliente que tem email e responde pelo
   * link. Um bloco assim ensina a descontá-lo, e o desconto apaga também os
   * quatro em que a demora custa dinheiro.
   */
  it("a divisão é por quem tem de responder, e usa a regra do servidor", () => {
    expect(prateleiras).toContain('quemNegoceia(p) === "clyon"');
    expect(prateleiras).toContain('quemNegoceia(p) !== "clyon"');
  });

  it("nenhum pedido cai nas duas, nem fica de fora", () => {
    // A mesma lista partida em duas com a condição negada. É isto que garante
    // que a soma das duas é a que estava em «Precisa de si».
    expect(prateleiras).toContain(
      'const precisam = semConfirmar.filter((p) => quemNegoceia(p) === "clyon");',
    );
    expect(prateleiras).toContain(
      'const aguardaCliente = semConfirmar.filter((p) => quemNegoceia(p) !== "clyon");',
    );
  });

  it("os FEITOS ficam de fora da divisão — ali há dinheiro preso", () => {
    /*
     * Um trabalho por confirmar também espera pelo cliente, e mesmo assim
     * não se mexe: tem urgência própria e prateleira própria, primeira de
     * todas. O corte é sobre `semConfirmar`, e não sobre `precisamDeSi`.
     */
    expect(prateleiras).toContain(
      "const semConfirmar = precisamDeSi.filter((p) => !p.negociacoes.some(esperaConfirmacao));",
    );
    expect(prateleiras).toContain("const porConfirmar = precisamDeSi.filter((p) => p.negociacoes.some(esperaConfirmacao));");
  });

  it("vem logo a seguir ao «Precisa de si», e antes das propostas", () => {
    /*
     * A ORDEM LÊ-SE NO `BLOCOS`, e não no memo — 23-09-2026.
     *
     * A primeira versão deste teste comparava as posições dentro do corpo do
     * `useMemo`, e isso não guardava nada: quem decide a ordem dos cartões do
     * topo e dos blocos da mesa é o array `BLOCOS`, que fica a mil linhas
     * dali. A revisão mediu-o — moveu a entrada do bloco novo para o fundo da
     * mesa, atrás dos «Contratados», e os 3659 testes passaram todos.
     *
     * Pelas CHAVES e não pelos títulos: é a chave que o desenho usa.
     *
     * Não está parado, e é por isso que fica aqui: há um profissional do
     * outro lado à espera. O que muda é o gesto — aqui lembra-se o cliente,
     * ali responde-se por ele.
     */
    const si = blocos.indexOf('chave: "n1"');
    const cliente = blocos.indexOf('chave: "aguardaCliente"');
    const propostas = blocos.indexOf('chave: "n2"');
    expect(si).toBeGreaterThan(-1);
    expect(cliente).toBeGreaterThan(-1);
    expect(propostas).toBeGreaterThan(-1);
    expect(si).toBeLessThan(cliente);
    expect(cliente).toBeLessThan(propostas);
    // E o memo continua a emitir a prateleira, que é outra coisa.
    // Com `\s*` porque o ficheiro tem CRLF e a chamada está partida em linhas.
    expect(prateleiras).toMatch(/bloco\(\s*"aguardaCliente"/);
  });

  it("e o cartão de cima conta-a a par com o bloco", () => {
    /*
     * `nivelDe` é a segunda cópia da mesma decisão — os números do topo saem
     * de lá. As duas têm de andar a par, senão o cartão diz um número e o
     * bloco mostra outro.
     */
    expect(MESA).toContain('return quemNegoceia(p) === "clyon" ? "n1" : "aguardaCliente";');
    expect(MESA).toContain("aguardaCliente: [],");
  });
});

describe("os títulos só aparecem quando separam alguma coisa", () => {
  it("com um nível só, não há linha nenhuma", () => {
    /*
     * Antes a conta era feita entre duas listas. Com três, «precisam > 0 &&
     * correm > 0» deixaria a mesa sem títulos sempre que uma das pontas
     * estivesse vazia — mesmo com duas prateleiras cheias no meio.
     */
    /*
     * A 23-09-2026 entrou uma quarta prateleira — «A aguardar cliente» — e a
     * conta tem de a incluir. O que este teste guarda é que a decisão se faz
     * contando as prateleiras CHEIAS, e não comparando duas pontas.
     */
    expect(prateleiras).toMatch(
      /const comCoisas = \[precisam, aguardaCliente, aoAr, contratados\]\.filter\(\s*\(l\) => l\.length > 0,?\s*\)\.length;/,
    );
    expect(prateleiras).toContain("if (comCoisas > 1) {");
  });
});
