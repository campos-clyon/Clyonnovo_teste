import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MODELO_ACTUAL, RETIRADOS } from "./modelo-do-gemini";
import { esquecerTraducoes, traduzirParaOCliente } from "./traduzir-para-o-cliente";
import { nomeDoTexto } from "./leitor-da-recolha";
import { responderNaRecolha } from "./whatsapp-recolha";
// O tradutor vai buscá-lo à hora da chamada; carregado aqui, não conta para o tempo do teste.
import "./whatsapp-compreensao";

/** A escada vai à base (que nos testes não existe) antes de desistir dela. */
const COM_TEMPO = 30_000;

/**
 * O TRADUTOR ESTAVA MORTO — 14-10-2026, a Hannah.
 *
 *   CLIENTE: Hello, I just sent a request for collection of bulky items…
 *   CLYON:   Bom dia! Aqui é a Vitória, assistente online da CLYON 😊 …
 *
 * A língua dela estava detectada; o tradutor pedia o `gemini-2.5-flash`, que a
 * Google retirou a 15-09-2026, e cada tradução saía em português sem aviso. A
 * varredura desse dia não o apanhou porque um carácter NUL no ficheiro fazia o
 * `grep` lê-lo como binário.
 */

const chamados: string[] = [];

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel({ model }: { model: string }) {
      return {
        generateContent: async () => {
          chamados.push(model);
          if (model === "gemini-degrau-que-falha") throw new Error("[404 Not Found] model not available");
          return { response: { text: () => "Good afternoon! This is Vitória, CLYON's online assistant 😊" } };
        },
      };
    }
  },
}));

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function ficheirosDeCodigo(pasta: string, fora: string[] = []): string[] {
  for (const nome of readdirSync(pasta)) {
    const p = join(pasta, nome);
    if (statSync(p).isDirectory()) ficheirosDeCodigo(p, fora);
    else if (/\.(ts|tsx|css|json|md)$/.test(nome)) fora.push(p);
  }
  return fora;
}

describe("o tradutor usa o modelo do assistente", () => {
  const T = ler("src/lib/traduzir-para-o-cliente.ts");

  it("nenhum modelo retirado, e nada de `GEMINI_MODEL || …` escrito à mão", () => {
    for (const morto of RETIRADOS) expect(T).not.toContain(`"${morto}"`);
    expect(T).not.toMatch(/process\.env\.GEMINI_MODEL\s*\|\|/);
    expect(T).toContain("escadaDeModelos(modeloDoAssistente())");
  });

  describe("e desce a escada quando um degrau falha", () => {
    const antes = { ...process.env };
    beforeEach(async () => {
      chamados.length = 0;
      process.env.GEMINI_API_KEY = "chave-de-teste";
      process.env.WHATSAPP_GEMINI_MODEL = "gemini-degrau-que-falha";
      esquecerTraducoes();
    });
    afterEach(() => {
      process.env = { ...antes };
    });

    it("o primeiro dá 404, o seguinte traduz — e o inglês chega à Hannah", async () => {
      const saiu = await traduzirParaOCliente("Boa tarde! Aqui é a Vitória, assistente online da CLYON 😊", "en");
      expect(saiu).toMatch(/^Good afternoon!/);
      expect(chamados).toEqual(["gemini-degrau-que-falha", MODELO_ACTUAL]);
    }, COM_TEMPO);

    it("em português não se chama ninguém", async () => {
      expect(await traduzirParaOCliente("Olá", "pt")).toBe("Olá");
      expect(chamados).toEqual([]);
    });
  });
});

describe("e o nome dela lê-se em inglês, mesmo sem o Gemini", () => {
  it("«Thank you, my name is Hannah» é a Hannah", async () => {
    expect(nomeDoTexto("Thank you, my name is Hannah")).toBe("Hannah");
    expect(nomeDoTexto("Hola, me llamo Carmen")).toBe("Carmen");
    expect(nomeDoTexto("Bonjour, je m'appelle Pierre")).toBe("Pierre");
    const r = responderNaRecolha(
      { passo: "nome", dados: { serviceType: "recolha_monos" } },
      "Thank you, my name is Hannah",
      new Date("2026-10-14T12:48:00Z"),
      true,
    );
    expect(r.estado.dados.contactName).toBe("Hannah");
    expect(r.estado.passo).toBe("morada");
  }, COM_TEMPO);
});

describe("nenhum ficheiro de código esconde caracteres de controlo", () => {
  it("o grep tem de os conseguir ler a todos — foi assim que o tradutor escapou", () => {
    const comControlo = ficheirosDeCodigo(join(process.cwd(), "src")).filter((f) =>
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(readFileSync(f, "utf8")),
    );
    expect(comControlo).toEqual([]);
  });
});
