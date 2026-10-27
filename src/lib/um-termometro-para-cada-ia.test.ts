import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esquecerTraducoes, traduzirParaOCliente } from "./traduzir-para-o-cliente";
import { linhaDaFalha } from "./saude-da-ia";
import "./whatsapp-compreensao";

/**
 * UM TERMÓMETRO PARA CADA USO DA IA — 27-10-2026 (decisão d7).
 *
 * O tradutor caía para português sem aviso (esteve morto 15-09 a 14-10
 * assim). Agora cada falha fica anotada, e o painel do WhatsApp mostra-a.
 */

const anotadas: Array<{ uso: string; motivo: string | null }> = [];
vi.mock("./saude-da-ia-na-base", () => ({
  anotarSaudeDaIa: async (uso: string, motivo: string | null) => {
    anotadas.push({ uso, motivo });
  },
  falhasDaIa: async () => [],
}));

let falhar = true;
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => {
          if (falhar) throw new Error("[404 Not Found] model not available");
          return { response: { text: () => "Good afternoon!" } };
        },
      };
    }
  },
}));

const COM_TEMPO = 30_000;

describe("o tradutor diz quando falha", () => {
  const antes = { ...process.env };
  beforeEach(() => {
    anotadas.length = 0;
    process.env.GEMINI_API_KEY = "chave-de-teste";
    esquecerTraducoes();
  });
  afterEach(() => {
    process.env = { ...antes };
  });

  it("todos os modelos falham: sai em português — e fica anotado com o motivo", async () => {
    falhar = true;
    const saiu = await traduzirParaOCliente("Boa tarde!", "en");
    expect(saiu).toBe("Boa tarde!");
    const t = anotadas.filter((a) => a.uso === "tradutor");
    expect(t).toHaveLength(1);
    expect(t[0].motivo).toMatch(/404 Not Found.*saiu em português \(en\)/);
  }, COM_TEMPO);

  it("sem chave: também se diz", async () => {
    delete process.env.GEMINI_API_KEY;
    await traduzirParaOCliente("Boa tarde!", "en");
    expect(anotadas).toEqual([{ uso: "tradutor", motivo: "sem GEMINI_API_KEY — saiu em português" }]);
  });

  it("volta a traduzir: anota que correu bem (a faixa desaparece)", async () => {
    falhar = false;
    expect(await traduzirParaOCliente("Boa tarde!", "en")).toBe("Good afternoon!");
    expect(anotadas).toEqual([{ uso: "tradutor", motivo: null }]);
  }, COM_TEMPO);
});

describe("a leitura das conversas e a das fotografias também", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

  it("cada uma anota a falha e o sucesso", () => {
    const leitura = ler("src/lib/leitura-das-conversas.ts");
    expect(leitura).toContain('await anotar("leitura", ultimoMotivo);');
    expect(leitura).toContain('await anotar("leitura", lida ? null :');
    const imagem = ler("src/lib/whatsapp-imagem.ts");
    expect(imagem).toContain('await anotar("imagem", ultimoMotivo);');
    expect(imagem).toContain('await anotar("imagem", null);');
  });

  it("o painel do WhatsApp mostra-as, como a da compreensão", () => {
    expect(ler("src/app/api/admin/whatsapp/route.ts")).toContain("falhasDaIa().catch(() => [])");
    expect(ler("src/components/admin/AdminWhatsAppPanel.tsx")).toContain("{linhaDaFalha(f)}");
    expect(linhaDaFalha({ uso: "tradutor", motivo: "x", falhas: 3, quando: "" })).toBe(
      "Tradutor: 3 falha(s) desde a última que correu bem — as mensagens a clientes estrangeiros saem em português.",
    );
  });
});
