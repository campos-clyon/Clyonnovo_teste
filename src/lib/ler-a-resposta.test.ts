import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerARespostaDirecta, jaSeLeSemModelo, normalizar } from "./ler-a-resposta";

/**
 * "O bot não conseguiu entender a resposta da cliente." — 14-09-2026.
 *
 *   CLYON:   Revolution propõe 94,00 € para a sua recolha de móveis (#318).
 *   CLIENTE: Sim serve                      14:50
 *   CLYON:   Pedido #318 - o que já recebeu: ...
 *   CLIENTE: Revolution 94                  14:54
 *   CLYON:   Pedido #318 - o que já recebeu: ...   (outra vez, igualzinha)
 *
 * A leitura sem modelo era `^(sim|fechar|aceito|aceitar|pode fechar)$` — a
 * palavra exacta e mais nada. «Sim serve» não é uma frase difícil: é a forma
 * normal de aceitar em português, e falhava por ter duas palavras. E
 * «Revolution 94» era exactamente a forma que o próprio ponto de situação
 * ensinava — «Diga qual pelo valor» — e a única que ele não sabia ler.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("as duas frases que a cliente escreveu", () => {
  it("«Sim serve» é um sim", () => {
    expect(lerARespostaDirecta("Sim serve")).toEqual({ tipo: "sim", valor: null });
  });

  it("«Revolution 94» é escolher aquela proposta", () => {
    expect(lerARespostaDirecta("Revolution 94")).toEqual({
      tipo: "nome_e_valor",
      nome: "revolution",
      valor: 94,
    });
  });
});

describe("o sim, nas formas em que aparece", () => {
  for (const frase of [
    "sim",
    "Sim!",
    "Serve",
    "serve sim",
    "Pode ser",
    "Está bem",
    "esta bem",
    "Aceito",
    "Combinado",
    "De acordo",
    "Vamos a isso",
    "Pode fechar",
  ]) {
    it(`«${frase}»`, () => {
      expect(lerARespostaDirecta(frase)?.tipo).toBe("sim");
    });
  }

  it("com valor: «aceito 300»", () => {
    expect(lerARespostaDirecta("aceito 300")).toEqual({ tipo: "sim", valor: 300 });
    expect(lerARespostaDirecta("fechar 148,57")).toEqual({ tipo: "sim", valor: 148.57 });
    expect(lerARespostaDirecta("sim 94 €")).toEqual({ tipo: "sim", valor: 94 });
  });
});

describe("o não, e o par que mais importa", () => {
  /*
   * «Não serve» é o par de «serve», e uma expressão regular que se fosse
   * alargando apanhava-o do lado errado. É a razão de a lista ser escrita
   * frase a frase em vez de crescer como padrão.
   */
  it("«não serve» é um NÃO, e não um sim com um advérbio à frente", () => {
    expect(lerARespostaDirecta("Não serve")?.tipo).toBe("nao");
    expect(lerARespostaDirecta("nao me serve")?.tipo).toBe("nao");
  });

  for (const frase of ["não", "Não quero", "não obrigada", "recuso", "fica para outra"]) {
    it(`«${frase}»`, () => {
      expect(lerARespostaDirecta(frase)?.tipo).toBe("nao");
    });
  }

  it("com valor: «recuso 300»", () => {
    expect(lerARespostaDirecta("recuso 300")).toEqual({ tipo: "nao", valor: 300 });
  });
});

describe("na dúvida, não se lê nada", () => {
  /*
   * Uma leitura errada fecha um negócio errado; não perceber custa uma
   * mensagem a mais. É por isso que o que não está na lista devolve null em
   * vez de um palpite.
   */
  it("um agradecimento não é um sim", () => {
    expect(lerARespostaDirecta("Ok, obrigada")).toBeNull();
    expect(lerARespostaDirecta("Obrigado")).toBeNull();
  });

  it("uma pergunta não é nada", () => {
    expect(lerARespostaDirecta("Conseguem dizer-me o valor, por favor?")).toBeNull();
    expect(lerARespostaDirecta("Chega como comprovativo?")).toBeNull();
  });

  it("«ok» sozinho ficou de fora de propósito", () => {
    // Por causa de «Ok, obrigada» — que é uma despedida, e que já fechou uma
    // conversa nesta plataforma sem fechar negócio nenhum.
    expect(lerARespostaDirecta("ok")).toBeNull();
  });

  it("um valor sozinho é contraproposta, e tem o seu próprio leitor", () => {
    expect(lerARespostaDirecta("300")).toBeNull();
    expect(lerARespostaDirecta("94 €")).toBeNull();
  });

  it("uma data não é um nome com um número", () => {
    expect(lerARespostaDirecta("27/08 14:30")).toBeNull();
    expect(lerARespostaDirecta("12/10 09:00")).toBeNull();
  });

  it("vazio não é resposta", () => {
    expect(lerARespostaDirecta("")).toBeNull();
    expect(lerARespostaDirecta("   ")).toBeNull();
  });
});

describe("os acentos e a pontuação não mudam a palavra", () => {
  it("«Não!» e «nao» são a mesma coisa", () => {
    expect(normalizar("Não!")).toBe("nao");
    expect(normalizar("  SIM,  SERVE.  ")).toBe("sim serve");
  });

  it("e quem já se lê não gasta uma chamada ao modelo", () => {
    expect(jaSeLeSemModelo("Sim serve")).toBe(true);
    expect(jaSeLeSemModelo("Revolution 94")).toBe(true);
    expect(jaSeLeSemModelo("Chega como comprovativo?")).toBe(false);
  });
});

describe("ligado ao cérebro, com as guardas de sempre", () => {
  const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");

  it("o cérebro usa esta leitura em vez das quatro expressões", () => {
    expect(CEREBRO).toContain("const lida = lerARespostaDirecta(chave);");
    expect(CEREBRO).not.toContain('/^(sim|fechar|aceito|aceitar|pode fechar)$/.test(chave)');
  });

  /*
   * O valor sozinho pode estar empatado entre dois pedidos; valor E nome ao
   * mesmo tempo identificam uma negociação só — ou nenhuma, e aí não se fecha
   * nada. É o que torna esta leitura segura sem modelo nenhum.
   */
  it("o nome aperta a escolha, e o empate continua a ir para uma pessoa", () => {
    expect(CEREBRO).toContain("semAcentos(nomeEValor.nome)");
    expect(CEREBRO).toContain("casam.length > 1");
    expect(CEREBRO).toContain("passarAUmaPessoa");
  });
});

describe("o ecrã repetido — a guarda comparava o texto errado", () => {
  const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");

  /*
   * O envio passa por `paraTeclado` antes de registar: troca o travessão por
   * hífen, as aspas curvas por rectas. O texto escrito tem «Pedido #318 — o
   * que já recebeu» e o gravado tem «Pedido #318 - o que já recebeu».
   * Comparados assim nunca batiam, e a guarda nunca disparava — a mesma
   * cliente levou o mesmo ecrã às 14:50 e às 14:54.
   */
  it("compara-se o que fica gravado, e não o que se escreveu", () => {
    expect(CEREBRO).toContain("jaFoiDito(paraTeclado(texto), gravadas, new Date())");
  });
});
