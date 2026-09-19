import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { codigoPostalGuardado, completarComAMorada, partirMorada } from "./morada-partida";

/**
 * *«Os dados do cliente, mesmo vindo com o código postal no endereço, ele não
 * vem no campo "Código postal".»* — 18-09-2026.
 *
 * O campo ficava vazio com um placeholder por baixo — `2845-513`, que é a
 * morada da CLYON — e quem olhasse de lado lia o placeholder como se fosse o
 * valor do cliente.
 */

describe("partir uma morada escrita numa linha", () => {
  it("o caso relatado, tal como veio", () => {
    expect(partirMorada("Praceta Carlos da Costa Frescata, 4, 2910-758 Setúbal")).toEqual({
      rua: "Praceta Carlos da Costa Frescata, 4",
      codigoPostal: "2910-758",
      localidade: "Setúbal",
    });
  });

  it("aguenta as formas em que as pessoas escrevem mesmo", () => {
    for (const [morada, cp, loc] of [
      ["R. Pascoal de Melo 127, 1000-169 Lisboa, Portugal", "1000-169", "Lisboa, Portugal"],
      ["Av. da Liberdade 12 — 1250-096 Lisboa", "1250-096", "Lisboa"],
      ["Rua X n.º 3, 4º Esq, 2845-513", "2845-513", null],
      ["2910-758 Setúbal", "2910-758", "Setúbal"],
    ] as const) {
      const r = partirMorada(morada);
      expect(r.codigoPostal, morada).toBe(cp);
      expect(r.localidade, morada).toBe(loc);
    }
  });

  /*
   * ⚠️ SEM HÍFEN NÃO É CÓDIGO POSTAL.
   *
   * «Avenida 1234 567» seria lido como um — e um número de porta a virar
   * código postal manda o trabalho para a outra ponta do país, porque são as
   * coordenadas que decidem que profissionais o alcançam.
   */
  it("não inventa um código postal onde não há", () => {
    for (const morada of [
      "Rua Sousa Viterbo 29",
      "Avenida 1234 567",
      "Rua 25 de Abril, 2910",
      "Praceta dos 12345-67 Amigos",
      "",
    ]) {
      expect(partirMorada(morada).codigoPostal, morada).toBeNull();
    }
  });

  it("uma morada sem código postal fica inteira na rua", () => {
    expect(partirMorada("Rua Sousa Viterbo 29")).toEqual({
      rua: "Rua Sousa Viterbo 29",
      codigoPostal: null,
      localidade: null,
    });
  });
});

describe("completar os campos vazios", () => {
  it("preenche o código postal e a localidade a partir da morada", () => {
    expect(
      completarComAMorada({
        address: "Praceta Carlos da Costa Frescata, 4, 2910-758 Setúbal",
        postalCode: "",
        city: "",
      }),
    ).toEqual({ postalCode: "2910-758", city: "Setúbal" });
  });

  /*
   * ⚠️ O TESTE QUE PROTEGE O TRABALHO DE UMA PESSOA.
   *
   * Se alguém corrigiu o código postal à mão porque a morada estava mal
   * escrita, a correcção é a verdade. Um preenchimento automático a passar-lhe
   * por cima desfazia isso com uma regra de três linhas.
   */
  it("nunca escreve por cima do que já lá está", () => {
    expect(
      completarComAMorada({
        address: "Praceta Carlos da Costa Frescata, 4, 2910-758 Setúbal",
        postalCode: "2845-513",
        city: "Seixal",
      }),
    ).toEqual({ postalCode: "2845-513", city: "Seixal" });
  });

  it("um campo cheio e outro vazio — só o vazio é tocado", () => {
    expect(
      completarComAMorada({
        address: "R. Pascoal de Melo 127, 1000-169 Lisboa",
        postalCode: "",
        city: "Arroios",
      }),
    ).toEqual({ postalCode: "1000-169", city: "Arroios" });
  });

  it("sem nada na morada, os campos ficam como estavam", () => {
    expect(
      completarComAMorada({ address: "Rua Sousa Viterbo 29", postalCode: "", city: "" }),
    ).toEqual({ postalCode: "", city: "" });
  });
});

/**
 * ⚠️ O COMENTÁRIO QUE ESCONDEU O CÓDIGO POSTAL DURANTE MESES.
 *
 * *«PEDIDOS CONTINUA A VIR SEM CÓDIGO POSTAL»* — 19-09-2026.
 *
 * A rota do simulador tinha escrito «não existe como coluna separada na DB —
 * guardado em rawOrderJson». Era verdade quando foi escrito, e deixou de o ser
 * quando alguém acrescentou a coluna. Ninguém apagou o comentário, e todos os
 * pedidos nascidos no site ficaram com o campo a nulo — com o valor certo,
 * vindo do Google, a dois níveis de profundidade num JSON.
 */
describe("recuperar o que ficou no rawOrderJson", () => {
  it("lê o código postal de onde o simulador o deixou", () => {
    const cru = JSON.stringify({
      serviceType: "recolha_moveis",
      address: { formattedAddress: "Largo X, 4", city: "Linda-a-Velha", postalCode: "2795-242" },
    });
    expect(codigoPostalGuardado(cru)).toBe("2795-242");
  });

  it("nas mudanças, vale o da morada de partida", () => {
    const cru = JSON.stringify({
      originAddress: { postalCode: "1000-169" },
      destinationAddress: { postalCode: "4000-007" },
    });
    expect(codigoPostalGuardado(cru)).toBe("1000-169");
  });

  it("um JSON estragado é o mesmo que não ter nada", () => {
    for (const mau of [null, undefined, "", "{isto não é json", "{}", '{"address":{}}']) {
      expect(codigoPostalGuardado(mau), String(mau)).toBe("");
    }
  });

  /*
   * A ORDEM IMPORTA: a coluna é a verdade quando existe. Se alguém a corrigiu à
   * mão porque o Google devolveu o código postal errado, essa correcção não
   * pode ser desfeita pelo que ficou no JSON antigo.
   */
  it("a coluna manda sobre o JSON", () => {
    const cru = JSON.stringify({ address: { postalCode: "2795-242" } });
    const daColuna = "1000-169";
    expect(
      completarComAMorada({
        address: "Largo X, 4",
        postalCode: daColuna || codigoPostalGuardado(cru),
        city: "",
      }).postalCode,
    ).toBe("1000-169");
  });
});

/**
 * ⚠️ O GUARDA QUE IMPEDE ISTO DE VOLTAR.
 *
 * O erro não foi de código — foi de um COMENTÁRIO que deixou de ser verdade e
 * que ninguém apagou. A rota lia-se bem, fazia sentido, e estava errada há
 * meses. Um teste a olhar para a rota é a única coisa que apanha isso.
 */
describe("a rota do simulador grava o código postal", () => {
  const ROTA = readFileSync(
    join(process.cwd(), "src/app/api/simulador/pedido/route.ts"),
    "utf8",
  );

  it("escreve a coluna, e não só o JSON", () => {
    expect(ROTA).toContain("postalCode: order.address?.postalCode");
  });

  /*
   * SEM OS COMENTÁRIOS — e é a terceira vez em dois dias que esta lição se
   * paga. O comentário que hoje está na rota CITA o antigo, para explicar
   * porque é que o campo esteve nulo durante meses. Proibir a frase à letra
   * era chumbar por se ter escrito bem.
   *
   * O que se guarda é que a afirmação errada não está em CÓDIGO VIVO.
   */
  it("o código já não diz que a coluna não existe", () => {
    const codigo = ROTA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toContain("não existe como coluna separada");
    expect(codigo).toContain("postalCode:");
  });

  /*
   * Não é cosmético: o código postal, com a localidade, é o que localiza a
   * morada — e são as coordenadas que decidem que profissionais alcançam o
   * trabalho. Um pedido sem ele chega a menos gente.
   */
  it("e as outras portas de entrada continuam a gravá-la", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(ler("src/app/api/hero-quote/route.ts")).toContain("postalCode: codigoPostal");
    expect(ler("src/lib/registar-pedido-por-whatsapp.ts")).toContain("postalCode,");
  });
});
