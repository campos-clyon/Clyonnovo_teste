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
  "fotoViaturaUrl",
  // Um token de definição de palavra-passe é uma CREDENCIAL, e sobrevivia à
  // conta. A rota recusa o estado «apagado», e é só por isso que nunca foi
  // explorável — a guarda estava toda do lado de lá.
  "senhaTokenHash",
  "senhaTokenExpiraEm",
  "baseLat",
  "baseLng",
] as const;

/**
 * As colunas de `providers` que NÃO dizem quem a pessoa é.
 *
 * Esta lista existe para a de cima poder ser verificada contra a tabela a
 * sério, e não contra si própria. Uma coluna nova que não esteja em nenhuma
 * das duas chumba o teste — e é nesse momento, e não três meses depois, que
 * alguém decide se ela identifica alguém.
 *
 * FALHA PARA O LADO SEGURO: o esquecimento leva a um teste vermelho, não a
 * dados de uma pessoa apagada a sobreviverem em silêncio. Foi assim que o
 * `mbway`, as três colunas da morada fiscal e a fotografia da viatura
 * passaram — cada um acrescentado à tabela meses depois da função que os
 * devia limpar.
 */
const NAO_IDENTIFICAM = new Set([
  // Quem é na plataforma, não quem é na vida.
  "id", "createdAt", "updatedAt", "isActive", "estado", "papel", "tipo",
  // O trabalho que faz e como o faz.
  "categorias", "zonas", "raioKm", "tipoVeiculo", "pessoasNaEquipa",
  "descricao", "descricaoCurta", "experienciaAnos", "logoUrl",
  // Números e contas — dele enquanto empresa, não enquanto pessoa.
  "custoKm", "custoHoraPessoa", "custosFixosJson", "trabalhosPorMes",
  "margemPercent", "horasPorTrabalho", "riscoPercent",
  "emiteFatura", "regimeIva", "emiteGuiaTransporte",
  "guiaVerificadaEm", "guiaVerificadaPor",
  // Avaliações, distintivos, estado da conta.
  "avaliacao", "quantasAvaliacoes", "destaque", "verificado",
  // Uma data de último acesso sem nome, email nem telefone não diz quem é
  // ninguém — e a conta já ficou marcada como apagada.
  "ultimoAcesso",
  "ultimoLoginEm", "suspensoEm", "suspensoPor", "aprovadoEm", "aprovadoPor",
  "notasInternas", "origem", "convidadoPor",
]);

/** As colunas que `ensureProvidersSchema` acrescenta a `providers`. */
const COLUNAS_DA_TABELA = [
  ...new Set(
    [...DB.matchAll(/ALTER TABLE providers ADD COLUMN (\w+)/g)].map((m) => m[1]),
  ),
];

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

  it("a fotografia da viatura sai da coluna E do Blob", () => {
    // A matrícula está à vista nela. Limpar só a coluna deixava o ficheiro a
    // responder no endereço público onde estava, sem nada na base a dizer que
    // existia — que é o pior dos dois, porque ninguém o voltava a encontrar.
    expect(anonimizacao).toContain("fotoViaturaUrl = NULL");
    const i = DB.indexOf("export async function apagarProfissional(");
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 1));
    expect(corpo).toContain("p.fotoViaturaUrl");
    expect(corpo).toContain("apagarFotosDoBlob([p.fotoViaturaUrl])");
    // Depois do commit: uma chamada ao Blob a meio da transacção prende a
    // linha de `providers` enquanto se espera pela internet.
    expect(corpo.indexOf("apagarFotosDoBlob")).toBeGreaterThan(corpo.indexOf("conn.commit()"));
  });
});

describe("a lista acompanha a tabela", () => {
  it("há colunas para comparar — se a leitura falhar, este teste não vale nada", () => {
    // Sem esta guarda, uma mudança na forma dos ALTER TABLE tornava o teste
    // seguinte verde por não ter nada para verificar.
    expect(COLUNAS_DA_TABELA.length).toBeGreaterThan(20);
    expect(COLUNAS_DA_TABELA).toContain("mbway");
    expect(COLUNAS_DA_TABELA).toContain("fotoViaturaUrl");
  });

  it("toda a coluna de `providers` está decidida — ou limpa, ou dita como não pessoal", () => {
    /*
     * ISTO É O TESTE QUE FALTAVA. A lista de colunas a limpar era escrita à
     * mão e comparada consigo própria: uma coluna nova nunca aparecia em lado
     * nenhum e passava despercebida. Aconteceu três vezes — mbway, morada
     * fiscal, fotografia da viatura.
     *
     * Agora a tabela é que manda. Quem acrescentar uma coluna a `providers`
     * tem de a pôr numa das duas listas, e é aí que pensa no assunto.
     */
    const porDecidir = COLUNAS_DA_TABELA.filter(
      (c) => !IDENTIFICAM.includes(c as (typeof IDENTIFICAM)[number]) && !NAO_IDENTIFICAM.has(c),
    );
    expect(
      porDecidir,
      `Colunas novas em providers sem decisão: ${porDecidir.join(", ")}. ` +
        "Se identificam a pessoa, acrescente-as a IDENTIFICAM e ao UPDATE que anonimiza. " +
        "Se não, a NAO_IDENTIFICAM.",
    ).toEqual([]);
  });
});

describe("sem passado, é mesmo apagada", () => {
  it("há um DELETE para quem nunca trabalhou connosco", () => {
    // A linha só sobrevive quando alguma coisa lhe aponta. Sem isso, não há
    // razão nenhuma para ela ficar.
    expect(DB).toContain('await conn.execute("DELETE FROM providers WHERE id = ?", [providerId]);');
  });

  it("o passado é o que decide, e conta-se antes", () => {
    // As TRÊS coisas que fazem a linha ficar, e não a forma como estão
    // escritas: a contagem dos pedidos passou a ser uma lista de números (são
    // eles que permitem ir tirar o nome dele da folha do Google Sheets).
    expect(DB).toContain("const temPassado =");
    const i = DB.indexOf("const temPassado =");
    const condicao = DB.slice(i, i + 200);
    expect(condicao).toContain("negociacoes.length > 0");
    expect(condicao).toContain("levantamentos.length > 0");
    expect(condicao).toMatch(/pedidos\w*\.length > 0/);
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
