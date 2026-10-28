import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  esquecerTraducoes,
  modeloLeve,
  traduzirParaOCliente,
  traduzirSemLinguaErrada,
  valeTentarOutraVez,
} from "./traduzir-para-o-cliente";
import { MODELO_ACTUAL } from "./modelo-do-gemini";
import "./whatsapp-compreensao";

/**
 * O TRADUTOR A FALHAR — 28-10-2026 (decisão d35).
 *
 * *«gemini-3.6-flash: demorou mais de 8 s — saiu em português (en)»*, duas
 * vezes, com um cliente que tinha pedido «Do you speak English?». Agora: UMA
 * nova tentativa quando a falha é de tempo ou do servidor; o modelo leve, se
 * estiver configurado; as traduções fixas; e, sem elas, nada sai na língua
 * errada — a conversa passa à equipa (ver `whatsapp-cloud.ts`).
 */

const anotadas: Array<{ uso: string; motivo: string | null }> = [];
vi.mock("./saude-da-ia-na-base", () => ({
  anotarSaudeDaIa: async (uso: string, motivo: string | null) => {
    anotadas.push({ uso, motivo });
  },
  falhasDaIa: async () => [],
}));

/** Como responde cada chamada, pela ordem; o que sobra repete a última. */
let respostas: Array<{ erro?: string; texto?: string }> = [];
const chamados: string[] = [];
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel({ model }: { model: string }) {
      return {
        generateContent: async () => {
          chamados.push(model);
          const r = respostas[Math.min(chamados.length - 1, respostas.length - 1)] ?? { erro: "sem resposta" };
          if (r.erro) throw new Error(r.erro);
          return { response: { text: () => r.texto ?? "" } };
        },
      };
    }
  },
}));

const COM_TEMPO = 30_000;

describe("o tradutor a falhar não deixa sair português a um estrangeiro", () => {
  const antes = { ...process.env };
  beforeEach(() => {
    anotadas.length = 0;
    chamados.length = 0;
    respostas = [];
    process.env.GEMINI_API_KEY = "chave-de-teste";
    delete process.env.WHATSAPP_GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODELO_LEVE;
    esquecerTraducoes();
  });
  afterEach(() => {
    process.env = { ...antes };
  });

  it("falhou por tempo ou pelo servidor: UMA nova tentativa no mesmo modelo — e traduz", async () => {
    respostas = [{ erro: "[503 Service Unavailable] The model is overloaded" }, { texto: "Yes, of course! And what floor is it on?" }];
    const saiu = await traduzirSemLinguaErrada("Claro que sim! E em que andar é?", "en");
    expect(saiu).toBe("Yes, of course! And what floor is it on?");
    expect(chamados).toEqual([MODELO_ACTUAL, MODELO_ACTUAL]);
    expect(anotadas).toEqual([{ uso: "tradutor", motivo: null }]);
  }, COM_TEMPO);

  it("falhou por acesso (404, quota): não se insiste no mesmo — passa ao modelo leve, se houver", async () => {
    process.env.GEMINI_MODELO_LEVE = "modelo-leve-de-teste";
    respostas = [{ erro: "[404 Not Found] model not available" }, { texto: "Thank you!" }];
    expect(await traduzirSemLinguaErrada("Obrigada!", "en")).toBe("Thank you!");
    expect(chamados).toEqual([MODELO_ACTUAL, "modelo-leve-de-teste"]);
  }, COM_TEMPO);

  it("sem modelo leve configurado, não se inventa nenhum", async () => {
    expect(modeloLeve()).toBeNull();
    respostas = [{ erro: "[404 Not Found] model not available" }];
    await traduzirSemLinguaErrada("Obrigada!", "en");
    expect(chamados).toEqual([MODELO_ACTUAL]);
  }, COM_TEMPO);

  it("tudo falha e HÁ tradução fixa: sai a fixa, revista — e o painel conta a falha", async () => {
    respostas = [{ erro: "demorou mais de 12 s" }];
    const saiu = await traduzirSemLinguaErrada("Claro que sim! E em que andar é?", "en");
    expect(saiu).toBe("Yes, of course! And what floor is it on?");
    // A primeira e a nova tentativa, no mesmo modelo.
    expect(chamados).toEqual([MODELO_ACTUAL, MODELO_ACTUAL]);
    const t = anotadas.filter((a) => a.uso === "tradutor");
    expect(t).toHaveLength(1);
    expect(t[0].motivo).toMatch(/demorou.*saiu pela tradução fixa \(en\)/);
  }, COM_TEMPO);

  it("tudo falha e NÃO há tradução fixa: não sai nada (null) — e o painel di-lo", async () => {
    respostas = [{ erro: "demorou mais de 12 s" }];
    const saiu = await traduzirSemLinguaErrada("O Joaquim propõe 120 € pela recolha, com a carrinha grande.", "en");
    expect(saiu).toBeNull();
    expect(anotadas.at(-1)?.motivo).toMatch(/sem tradução fixa: não saiu \(en\)/);
  }, COM_TEMPO);

  it("sem chave também: a fixa, ou nada", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await traduzirSemLinguaErrada("Para quando precisa?", "fr")).toBe("Pour quand en avez-vous besoin ?");
    expect(await traduzirSemLinguaErrada("Uma frase que ninguém traduziu.", "fr")).toBeNull();
    expect(chamados).toEqual([]);
  });

  it("à mão (o painel) e nos avisos, o pior caso continua a ser o português de quem escreveu", async () => {
    respostas = [{ erro: "[404 Not Found] model not available" }];
    const escrita = "Bom dia, o Joaquim passa aí amanhã às 10h.";
    expect(await traduzirParaOCliente(escrita, "en")).toBe(escrita);
  }, COM_TEMPO);

  it("em português não se chama ninguém", async () => {
    expect(await traduzirSemLinguaErrada("Olá", "pt")).toBe("Olá");
    expect(await traduzirSemLinguaErrada("Olá", null)).toBe("Olá");
    expect(chamados).toEqual([]);
  });

  it("o que vale uma nova tentativa: tempo e servidor, e não acesso nem quota", () => {
    expect(valeTentarOutraVez("gemini-3.6-flash: demorou mais de 12 s")).toBe(true);
    expect(valeTentarOutraVez("[503 Service Unavailable] overloaded")).toBe(true);
    expect(valeTentarOutraVez("[500 Internal Server Error]")).toBe(true);
    expect(valeTentarOutraVez("[404 Not Found] model not available")).toBe(false);
    expect(valeTentarOutraVez("[429 Too Many Requests] quota")).toBe(false);
    expect(valeTentarOutraVez("[403 Forbidden] Your project has been denied access")).toBe(false);
  });
});
