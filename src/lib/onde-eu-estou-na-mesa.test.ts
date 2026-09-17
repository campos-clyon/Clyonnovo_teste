import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ONDE É QUE EU ESTOU, na mesa das negociações.
 *
 * "Mude a cor da borda do pedido que eu estiver com ele aberto para não me
 * confundir, pois fica tudo verde. Coloque a borda do pedido que estou com ele
 * aberto em azul." — 17-09-2026.
 *
 * O verde marcava dois estados ao mesmo tempo — «concluído por ver» e «tem
 * proposta à espera de si» — e o bloco «Precisa de si» tinha dez pedidos, ou
 * seja verde de cima a baixo. Aberto um deles, ele crescia para meio ecrã com
 * as negociações todas lá dentro; quem rolava até ao fim já não sabia dentro
 * de qual estava, porque a borda era igual à dos vizinhos.
 *
 * O azul não compete com nada nesta lista: o VERDE é o estado do negócio, o
 * AZUL é onde ele está. São duas perguntas diferentes e passam a ter duas
 * cores diferentes.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/*
 * O código sem comentários. Um teste que procure classes no ficheiro inteiro
 * encontra-as dentro do comentário que explica a mudança, e fica verde sem
 * guardar nada.
 */
const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

/** A cadeia de classes do cartão de um pedido, e só ela. */
const CARTAO = (() => {
  const i = MESA.indexOf("scroll-mt-24 rounded-2xl border bg-slate-900");
  return MESA.slice(i, MESA.indexOf("}`}", i));
})();

describe("o pedido aberto distingue-se dos outros", () => {
  it("a borda do que está aberto é azul", () => {
    expect(CARTAO).toContain("border-sky-400");
  });

  it("e o azul GANHA ao verde — senão não resolvia nada", () => {
    /*
     * É esta a asserção que interessa, e não a existência da classe. Posta
     * depois do `porVer` ou do `espera`, a regra azul nunca chegava a correr
     * nos cartões onde o problema existe: os verdes são precisamente os que
     * ele abre.
     */
    expect(CARTAO.indexOf("aberto")).toBeLessThan(CARTAO.indexOf("porVer"));
    expect(CARTAO.indexOf("aberto")).toBeLessThan(CARTAO.indexOf("espera"));
  });

  it("os verdes continuam lá, para quando o cartão está fechado", () => {
    // Não se apagou nenhum estado: fechado, o cartão volta a dizer em que pé
    // está o negócio. Aberto, isso lê-se lá dentro e a borda serve para outra
    // coisa.
    expect(CARTAO).toContain("border-emerald-400");
    expect(CARTAO).toContain("border-emerald-500/50");
    expect(CARTAO).toContain("border-slate-800");
  });

  it("o azul é do cartão aberto e de mais nada nesta lista", () => {
    /*
     * Uma cor só significa alguma coisa enquanto for de uma coisa só. Se
     * amanhã aparecer outra borda azul na mesma lista, o sinal desaparece —
     * e esta linha apanha-o antes de ele chegar ao ecrã dele.
     */
    expect((MESA.match(/border-sky-400/g) ?? []).length).toBe(1);
  });
});
