import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { camposDoFioSemModelo, type MensagemDoFio } from "./reler-a-conversa";
import { pareceMorada } from "./whatsapp-recolha";

/**
 * "Ele releu e veio com a pergunta mais feia possível — o endereço está enorme
 * à frente dele, como é que ele não leu?" — 14-09-2026.
 *
 *   CLIENTE: Rua Francisco Andrade Alapraia Sao Joao do estoril   10:42
 *   CLIENTE: Codigo postal 2765-094                               10:43
 *   ...
 *   CLYON:   Qual é a morada? Rua e número — é por aí que o
 *            profissional se orienta.
 *
 * Com o Gemini sem quota, a releitura não lia NADA e o botão limitava-se a
 * repetir a pergunta do passo onde a conversa tinha ficado. Era honesto e era
 * estúpido: um código postal são quatro dígitos e três, e uma morada começa
 * por «Rua». Nada disto precisa de um modelo de linguagem.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const dele = (texto: string, min: number): MensagemDoFio => ({
  direccao: "in",
  texto,
  criadoEm: new Date(2026, 8, 11, 10, min).toISOString(),
});
const nosso = (texto: string, min: number): MensagemDoFio => ({
  direccao: "out",
  texto,
  criadoEm: new Date(2026, 8, 11, 10, min).toISOString(),
});

/** O fio da Ana Almeida, como ele está na base. */
const FIO: MensagemDoFio[] = [
  dele("Quarto 1 1cama casal +colchao +comoda +2mesas de cabeceira.", 40),
  nosso("Com quem estou a falar?", 41),
  dele("Pretendo saber tambem se levam a mercadoria. Esta a falar com Ana Almeida", 41),
  nosso("Qual é a morada certa? Rua e número — é por aí que o profissional se orienta.", 41),
  dele("Tem contacto telefonico???", 42),
  dele("Rua Francisco Andrade Alapraia Sao Joao do estoril", 42),
  dele("Codigo postal 2765-094", 43),
  dele("Ok.Ligarei entao depois das 14h", 44),
];

describe("o que estava à frente dele", () => {
  it("lê a morada, o código postal e o nome — sem modelo nenhum", () => {
    const c = camposDoFioSemModelo(FIO, {});
    expect(c.morada).toBe("Rua Francisco Andrade Alapraia Sao Joao do estoril");
    expect(c.codigoPostal).toBe("Codigo postal 2765-094");
    expect(c.nome).toBe("Ana Almeida");
  });

  it("a linha que é só o código postal não é tomada por morada", () => {
    // Tem dígitos, e sem esta guarda passava no teste da morada.
    const c = camposDoFioSemModelo([dele("Codigo postal 2765-094", 43)], {});
    expect(c.codigoPostal).toBeTruthy();
    expect(c.morada).toBeUndefined();
  });

  it("não sobrepõe o que já está gravado", () => {
    const c = camposDoFioSemModelo(FIO, {
      address: "Rua que já lá estava",
      contactName: "Ana",
      postalCode: "1000-001",
    } as never);
    expect(c.morada).toBeUndefined();
    expect(c.codigoPostal).toBeUndefined();
    expect(c.nome).toBeUndefined();
  });
});

describe("as formas de dizer o nome", () => {
  for (const [frase, nome] of [
    ["Esta a falar com Ana Almeida", "Ana Almeida"],
    ["sou o João Filipe", "João Filipe"],
    ["chamo-me Maria", "Maria"],
    ["O meu nome é Rui Costa", "Rui Costa"],
  ] as const) {
    it(`«${frase}»`, () => {
      expect(camposDoFioSemModelo([dele(frase, 10)], {}).nome).toBe(nome);
    });
  }

  /*
   * NA DÚVIDA NÃO SE LÊ. Um campo inventado é muito pior do que um campo a
   * menos: quem o vir no resumo assume que foi o cliente que o disse.
   */
  it("uma linha solta não é tomada por nome", () => {
    expect(camposDoFioSemModelo([dele("Tem contacto telefonico???", 42)], {}).nome).toBeUndefined();
    expect(camposDoFioSemModelo([dele("Ok.obg.", 44)], {}).nome).toBeUndefined();
  });
});

describe("só o que ELE escreveu", () => {
  it("as nossas perguntas não são lidas como respostas", () => {
    // «Qual é a morada certa? Rua e número...» tem a palavra «rua» e um
    // número no exemplo — se se lesse o que nós dizemos, a morada do cliente
    // passava a ser a nossa pergunta.
    const so = camposDoFioSemModelo(
      [nosso("Qual é a morada certa? Rua e número — é por aí que o profissional se orienta.", 41)],
      {},
    );
    expect(so.morada).toBeUndefined();
  });

  it("um fio vazio não inventa nada", () => {
    expect(camposDoFioSemModelo([], {})).toEqual({});
  });
});

describe("a regra da morada é a mesma do passo da morada", () => {
  /*
   * Repetida na releitura, divergia no dia em que alguém acrescentasse
   * «travessa» a uma das cópias.
   */
  it("com palavra de rua ou com número, é morada", () => {
    expect(pareceMorada("Rua Francisco Andrade Alapraia")).toBe(true);
    expect(pareceMorada("Avenida da Liberdade 200")).toBe(true);
    expect(pareceMorada("Foros de Amora, 91")).toBe(true);
  });

  it("sem nenhum dos dois, não é", () => {
    expect(pareceMorada("É um apartamento e tem elevador")).toBe(false);
    expect(pareceMorada("Ok")).toBe(false);
  });
});

describe("a rota tenta isto antes de desistir", () => {
  const ROTA = ler("src/app/api/admin/whatsapp/route.ts");

  it("só quando o modelo falhou, e só se trouxer alguma coisa", () => {
    expect(ROTA).toContain("camposDoFioSemModelo(fio,");
    expect(ROTA).toContain("Object.keys(semModelo).length > 0");
  });

  it("e sem nada de nada, ainda continua a conversa", () => {
    // O caminho de repetir a pergunta continua a existir — é o último degrau.
    expect(ROTA).toContain("semLeitura: true");
  });
});
