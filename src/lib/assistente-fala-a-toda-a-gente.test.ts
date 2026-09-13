import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O ASSISTENTE DEIXA DE TRATAR TODA A GENTE POR HOMEM.
 *
 * A cliente do #311 — a mesma que escreveu «Ok, obrigada» — receberia, mais à
 * frente na mesma conversa:
 *
 *   «Uma última coisa e não O incomodo mais...»
 *   «...fico por aqui para não O estar a incomodar.»
 *   «...não quero deixá-LO pendurado.»
 *
 * O projecto já tinha tomado esta decisão e escrito-a: `comoTratar` não
 * adivinha o género de ninguém a partir do nome. Estas frases ficaram de fora
 * por serem pronomes soltos no meio do texto, onde ninguém foi à procura.
 *
 * A solução não é adivinhar melhor — é escrever frases que não precisem de
 * saber. É também o que já se fez com a concordância dos serviços, em
 * `servico-em-palavras.ts`.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Os ficheiros onde nasce texto que sai para o telemóvel de um cliente. */
const OUTBOUND = [
  "src/lib/assistente-automatico.ts",
  "src/lib/whatsapp-negociacao.ts",
  "src/lib/texto-da-mesa.ts",
  "src/lib/servico-em-palavras.ts",
  "src/lib/conta-em-palavras.ts",
];

describe("nenhuma frase decide o sexo de quem a lê", () => {
  /*
   * Só as construções EXACTAS que saíram, e não a letra «o» à solta: um
   * guarda que chumba quem escreve a razão da regra é um guarda que acaba
   * desligado.
   */
  const PROIBIDAS = [
    "não o incomodo mais",
    "para não o estar a incomodar",
    "deixá-lo pendurado",
    "Aviso-o assim que",
    "aviso-o assim que",
  ];

  for (const ficheiro of OUTBOUND) {
    it(`${ficheiro} não trata o cliente por homem`, () => {
      const texto = ler(ficheiro);
      for (const frase of PROIBIDAS) {
        expect(texto).not.toContain(frase);
      }
    });
  }

  it("as três frases foram reescritas para não precisarem de género", () => {
    const AVISOS = ler("src/lib/assistente-automatico.ts");
    expect(AVISOS).toContain("Uma última coisa e não volto a incomodar");
    expect(AVISOS).toContain("fico por aqui para não estar a incomodar");
    expect(AVISOS).toContain("não quero deixar isto pendurado");
  });

  it("e o texto novo da mesa nasceu já sem o mesmo defeito", () => {
    expect(ler("src/lib/texto-da-mesa.ts")).toContain("escrevo-lhe assim que chegar o primeiro");
    expect(ler("src/lib/whatsapp-negociacao.ts")).toContain(
      "Escrevo-lhe assim que ele responder.",
    );
  });
});
