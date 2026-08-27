import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Apagar uma conta tem de apagar TUDO o que identifica a pessoa.
 *
 * "Se o pro foi removido, ele deveria ter sido 100% apagado dos nossos dados."
 *
 * Quase é. Quando não há passado — nenhuma negociação, nenhum levantamento,
 * nenhum pedido atribuído — a linha é mesmo apagada com um DELETE. Quando há,
 * fica um número com a etiqueta «Profissional removido» e mais nada, porque as
 * negociações antigas apontam-lhe por id e o cliente que o contratou continua a
 * ter direito a saber quem lhe fez o trabalho.
 *
 * O QUE ESTE TESTE GUARDA é a outra metade: que a limpeza acompanhe a tabela.
 * O `mbway` foi acrescentado a `providers` meses depois desta função e não
 * entrou na lista — uma conta apagada ficava com o número de telemóvel que
 * recebe dinheiro, intacto, para sempre. As três colunas da morada fiscal
 * tinham o mesmo problema: só a rua saía.
 *
 * Não foi um descuido isolado. É o que acontece sempre que uma lista escrita à
 * mão tem de crescer com uma tabela que cresce noutro sítio.
 */

const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");

/** O UPDATE que anonimiza a conta. */
const anonimizacao = (() => {
  const i = DB.indexOf("SET name = 'Profissional removido'");
  expect(i).toBeGreaterThan(-1);
  return DB.slice(i, DB.indexOf("WHERE id = ?", i));
})();

/**
 * As colunas de `providers` que dizem QUEM a pessoa é, onde vive, ou para onde
 * vai o dinheiro dela. Cada uma tem de sair na anonimização.
 *
 * Quem acrescentar uma coluna pessoal à tabela tem de a acrescentar aqui — e é
 * exactamente nesse momento que vale a pena pensar no assunto.
 */
const IDENTIFICAM = [
  "name",
  "slug",
  "email",
  "phone",
  "nif",
  "city",
  "passwordHash",
  "iban",
  "ibanTitular",
  "mbway",
  "moradaFiscal",
  "codigoPostalFiscal",
  "localidadeFiscal",
  "numeroTransportador",
  "baseLat",
  "baseLng",
] as const;

describe("a anonimização", () => {
  it.each(IDENTIFICAM)("limpa a coluna %s", (coluna) => {
    // Sem expressões regulares: o que interessa é que a coluna seja ATRIBUÍDA
    // no UPDATE, e `coluna = ` diz isso sem escapes para correr mal.
    expect(anonimizacao).toContain(`${coluna} = `);
  });

  it("as colunas do dinheiro saem todas — nenhuma sobrevive à conta", () => {
    // Um IBAN ou um MB WAY que sobrevive é um caminho aberto para uma conta
    // que já não existe.
    for (const c of ["iban", "ibanTitular", "mbway"]) {
      expect(anonimizacao).toContain(`${c} = NULL`);
    }
  });

  it("a morada fiscal sai INTEIRA — rua, código postal e localidade", () => {
    // Só a rua saía. Um código postal e uma localidade chegam para situar
    // alguém numa aldeia.
    expect(anonimizacao).toContain("moradaFiscal = NULL");
    expect(anonimizacao).toContain("codigoPostalFiscal = NULL");
    expect(anonimizacao).toContain("localidadeFiscal = NULL");
  });

  it("o slug é substituído, e não deixado como estava", () => {
    // É único na tabela, e um slug com o nome dele lá dentro sobreviveria a
    // tudo o resto.
    expect(anonimizacao).toContain("slug = CONCAT('removido-', id)");
  });

  it("a conta fica marcada como apagada, e inactiva", () => {
    expect(anonimizacao).toContain("isActive = 0");
    expect(anonimizacao).toContain("estado = 'apagado'");
  });
});

describe("sem passado, é mesmo apagada", () => {
  it("há um DELETE para quem nunca trabalhou connosco", () => {
    // A linha só sobrevive quando alguma coisa lhe aponta. Sem isso, não há
    // razão nenhuma para ela ficar.
    expect(DB).toContain('await conn.execute("DELETE FROM providers WHERE id = ?", [providerId]);');
  });

  it("o passado é o que decide, e conta-se antes", () => {
    expect(DB).toContain("const temPassado =");
    expect(DB).toContain("negociacoes.length > 0 || levantamentos.length > 0 || pedidosAtribuidos > 0");
  });

  it("não se apaga uma conta com dinheiro pelo meio", () => {
    // Cativo, por levantar ou em transferência: apagar seria perder o rasto de
    // dinheiro de outra pessoa.
    expect(DB).toContain("ContaComPendencias");
    expect(DB).toContain("carteira.cativo > 0");
    expect(DB).toContain("carteira.disponivel > 0");
  });
});

describe("e some dos ecrãs onde não faz sentido", () => {
  it("as carteiras não listam contas apagadas sem dinheiro", () => {
    // Uma carteira é «a quem pagar», e a uma etiqueta não se paga. Mas se
    // alguma vez tiver dinheiro por transferir, tem de aparecer — aí é um
    // problema a sério.
    const ROTA = readFileSync(
      join(process.cwd(), "src/app/api/admin/carteiras/route.ts"),
      "utf8",
    );
    expect(ROTA).toContain("p.estado <> 'apagado'");
    expect(ROTA).toContain("x.pagoEm IS NULL");
  });
});
