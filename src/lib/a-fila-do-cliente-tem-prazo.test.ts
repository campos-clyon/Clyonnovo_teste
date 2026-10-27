import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONVERSA_VIVA_S, PRAZO_DA_FILA_S, oQueFazerNaFila } from "./fila-do-cliente";

/**
 * A FILA DO CLIENTE TEM PRAZO — o teste da conversa (27-10-2026, decisão d7).
 *
 * A ponte esteve parada uma tarde. Quando volta, o que estava na fila não
 * pode sair de rajada: uma resposta com 3 horas fica «atrasada» na Mesa, e a
 * equipa decide. E de noite só sai a resposta a quem está a escrever agora.
 */

/* Uma base de mentira atrás do mysql2: a fila e as mensagens do cliente. */
type LinhaDaFila = { id: number; telefone: string; texto: string; solta: number; idadeS: number };
const base = {
  fila: [] as LinhaDaFila[],
  ultimaDoCliente: new Map<string, number>(),
  marcadasAtrasadas: [] as number[],
};
vi.mock("mysql2/promise", () => ({
  default: {
    createPool: () => ({
      execute: async (sql: string, params: unknown[] = []) => {
        if (/FROM whatsappFila/.test(sql) && /idadeS/.test(sql)) return [base.fila, []];
        if (/FROM whatsappMensagens/.test(sql)) {
          const linhas = (params as string[])
            .filter((t) => base.ultimaDoCliente.has(t))
            .map((t) => ({ t9: t, haS: base.ultimaDoCliente.get(t) }));
          return [linhas, []];
        }
        if (/UPDATE whatsappFila SET atrasadaEm/.test(sql)) {
          base.marcadasAtrasadas.push(...(params as number[]));
          return [{ affectedRows: params.length }, []];
        }
        return [[], []];
      },
    }),
  },
}));

// 15:00 e 23:00 em Lisboa (Inverno: Lisboa = UTC).
const DE_TARDE = new Date("2026-11-10T15:00:00Z");
const DE_NOITE = new Date("2026-11-10T23:00:00Z");

describe("a regra, pura", () => {
  it("uma mensagem com 3 h na fila não sai sozinha: fica atrasada", () => {
    expect(oQueFazerNaFila({ idadeS: 3 * 3600, clienteEscreveuHaS: 60 }, DE_TARDE)).toBe("atrasada");
    expect(oQueFazerNaFila({ idadeS: 3 * 3600, clienteEscreveuHaS: 60 }, DE_NOITE)).toBe("atrasada");
  });

  it("o prazo é de 2 h", () => {
    expect(PRAZO_DA_FILA_S).toBe(7200);
    expect(oQueFazerNaFila({ idadeS: PRAZO_DA_FILA_S - 1, clienteEscreveuHaS: null }, DE_TARDE)).toBe("sai");
    expect(oQueFazerNaFila({ idadeS: PRAZO_DA_FILA_S + 1, clienteEscreveuHaS: null }, DE_TARDE)).toBe("atrasada");
  });

  it("de noite, a resposta a quem está a escrever agora sai; o resto espera pela manhã", () => {
    expect(oQueFazerNaFila({ idadeS: 20, clienteEscreveuHaS: 30 }, DE_NOITE)).toBe("sai");
    expect(oQueFazerNaFila({ idadeS: 20, clienteEscreveuHaS: CONVERSA_VIVA_S + 60 }, DE_NOITE)).toBe("espera");
    expect(oQueFazerNaFila({ idadeS: 20, clienteEscreveuHaS: null }, DE_NOITE)).toBe("espera");
  });

  it("a equipa carregou em «Enviar»: sai, mesmo de noite", () => {
    expect(oQueFazerNaFila({ idadeS: 60, soltaPelaEquipa: true, clienteEscreveuHaS: null }, DE_NOITE)).toBe("sai");
  });
});

describe("a ponte, com a base", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://teste/teste";
    base.fila = [];
    base.ultimaDoCliente = new Map();
    base.marcadasAtrasadas = [];
  });

  it("a ponte volta depois de uma tarde parada: a de 3 h fica atrasada, a de 10 min sai", async () => {
    base.fila = [
      { id: 1, telefone: "351912345678", texto: "Resposta velha", solta: 0, idadeS: 3 * 3600 },
      { id: 2, telefone: "351910000002", texto: "Resposta nova", solta: 0, idadeS: 600 },
    ];
    const { filaWhatsAppParaAPonte } = await import("./db");
    const sai = await filaWhatsAppParaAPonte(20, DE_TARDE);
    expect(sai.map((m) => m.id)).toEqual([2]);
    expect(base.marcadasAtrasadas).toEqual([1]);
  }, 30_000);

  it("às 23h só sai a resposta a quem escreveu há pouco", async () => {
    base.fila = [
      { id: 3, telefone: "351912345678", texto: "Lembrete", solta: 0, idadeS: 300 },
      { id: 4, telefone: "351910000002", texto: "Resposta", solta: 0, idadeS: 20 },
    ];
    base.ultimaDoCliente.set("910000002", 40);
    const { filaWhatsAppParaAPonte } = await import("./db");
    const sai = await filaWhatsAppParaAPonte(20, DE_NOITE);
    expect(sai.map((m) => m.id)).toEqual([4]);
    expect(base.marcadasAtrasadas).toEqual([]);
  }, 30_000);
});

describe("as ligações", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

  it("a ponte leva a fila COM prazo, nos dois sítios", () => {
    const ponte = ler("src/app/api/whatsapp/ponte/route.ts");
    expect(ponte).not.toContain("filaWhatsAppPorEnviar");
    expect(ponte.match(/paraEnviar: await filaWhatsAppParaAPonte\(\)/g)?.length).toBe(2);
  });

  it("a Mesa mostra as atrasadas com Enviar e Descartar, e elas contam no selo do WhatsApp", () => {
    const painel = ler("src/components/admin/AdminWhatsAppPanel.tsx");
    expect(painel).toContain('void agirNaFila("soltar", m.id)');
    expect(painel).toContain("Atrasadas na fila");
    expect(ler("src/lib/db.ts")).toMatch(/saida\.whatsapp = \(saida\.whatsapp \?\? 0\) \+/);
    expect(ler("src/app/api/admin/whatsapp/route.ts")).toContain('if (accao === "soltar")');
  });

  it("não mexe na regra «equipa à mão → a Vitória cala-se»: a fila não decide quem fala", () => {
    expect(ler("src/lib/fila-do-cliente.ts")).not.toMatch(/interromp|MARCA_DE_MAO/);
  });
});
