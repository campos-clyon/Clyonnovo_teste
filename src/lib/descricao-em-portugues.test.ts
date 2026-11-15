import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  descricaoEmPortugues,
  esquecerAsDescricoesTraduzidas,
  instrucaoParaPortugues,
  linhasNoutraLingua,
  rotuloDoOriginal,
  temOutraLingua,
  traducaoQueServe,
  type TradutorParaPortugues,
} from "./descricao-em-portugues";

/**
 * A DESCRIÇÃO SEMPRE EM PORTUGUÊS — 15-11-2026 (decisão d46).
 *
 * O caso: o #623, registado pela Vitória, ficou com «Pormenores (ditos pelo
 * cliente): A lot of cardboard boxes, a few trash bags of styrofoam, two
 * lamps, a twin size mattress and a rug.» — e é isto que o parceiro lê.
 */

const DO_623 =
  "Pormenores (ditos pelo cliente): A lot of cardboard boxes, a few trash bags of styrofoam, two lamps, a twin size mattress and a rug.";

/** Um tradutor de mentira, com as traduções certas — e a lista do que lhe pediram. */
function tradutor(respostas: Record<string, string>): TradutorParaPortugues & { pedidos: Array<[string, string]> } {
  const pedidos: Array<[string, string]> = [];
  const f = (async (texto: string, de: string) => {
    pedidos.push([texto, de]);
    const saiu = respostas[texto];
    return saiu ? { saiu, motivo: null } : { saiu: null, motivo: "sem resposta de teste" };
  }) as TradutorParaPortugues & { pedidos: Array<[string, string]> };
  f.pedidos = pedidos;
  return f;
}

beforeEach(() => esquecerAsDescricoesTraduzidas());

describe("o que está noutra língua", () => {
  it("o #623 está em inglês — só o texto, sem o rótulo português", () => {
    const l = linhasNoutraLingua(DO_623);
    expect(l).toHaveLength(1);
    expect(l[0].lingua).toBe("en");
    expect(l[0].rotulo).toBe("Pormenores (ditos pelo cliente): ");
    expect(l[0].texto.startsWith("A lot of cardboard boxes")).toBe(true);
  });

  it("francês e espanhol também se vêem", () => {
    expect(linhasNoutraLingua("Bonjour, nous avons des cartons, un matelas et une armoire.")[0]?.lingua).toBe("fr");
    expect(linhasNoutraLingua("Hola, tengo muchas cajas y un colchón para tirar, gracias.")[0]?.lingua).toBe("es");
  });

  it("o português fica de fora — também a descrição arrumada das regras", () => {
    const pt = [
      "Para levar: 1 sofá de 3 lugares, 2 colchões, 10 caixas de cartão",
      "Acesso: 3.º andar, sem elevador",
      "Quando: sábado de manhã",
      "Pormenores (ditos pelo cliente): O sofá está na garagem e o prédio não tem elevador.",
    ].join("\n");
    expect(linhasNoutraLingua(pt)).toEqual([]);
    expect(temOutraLingua(pt)).toBe(false);
    expect(temOutraLingua("")).toBe(false);
    expect(temOutraLingua(null)).toBe(false);
  });

  it("uma linha curta em inglês, no meio de um pedido em inglês, também vai", () => {
    const l = linhasNoutraLingua("I need to remove the furniture from my apartment, please.\nTwo lamps and a rug");
    expect(l.map((x) => x.indice)).toEqual([0, 1]);
  });
});

describe("traduzir para português de Portugal", () => {
  it("o #623: inglês → português, com os nomes de cá, e o original à parte", async () => {
    const t = tradutor({
      "A lot of cardboard boxes, a few trash bags of styrofoam, two lamps, a twin size mattress and a rug.":
        "Muitas caixas de cartão, alguns sacos do lixo com esferovite, dois candeeiros, um colchão de solteiro e um tapete.",
    });
    const r = await descricaoEmPortugues(DO_623, { traduzir: t });
    expect(r.porTraduzir).toBe(false);
    expect(r.lingua).toBe("en");
    expect(r.original).toBe(DO_623);
    expect(r.descricao).toBe(
      "Pormenores (ditos pelo cliente): Muitas caixas de cartão, alguns sacos do lixo com esferovite, dois candeeiros, um colchão de solteiro e um tapete.",
    );
    expect(t.pedidos).toHaveLength(1);
    expect(t.pedidos[0][1]).toBe("en");
  });

  it("francês → português", async () => {
    const fr = "Bonjour, nous avons des cartons, un matelas et une armoire.";
    const r = await descricaoEmPortugues(`Para levar: móveis\n${fr}`, {
      traduzir: tradutor({ [fr]: "Bom dia, temos caixas de cartão, um colchão e um roupeiro." }),
    });
    expect(r.lingua).toBe("fr");
    expect(r.descricao).toBe("Para levar: móveis\nBom dia, temos caixas de cartão, um colchão e um roupeiro.");
    expect(r.original).toContain(fr);
  });

  it("espanhol → português", async () => {
    const es = "Hola, tengo muchas cajas y un colchón para tirar, gracias.";
    const r = await descricaoEmPortugues(es, {
      traduzir: tradutor({ [es]: "Olá, tenho muitas caixas e um colchão para deitar fora, obrigado." }),
    });
    expect(r.lingua).toBe("es");
    expect(r.porTraduzir).toBe(false);
    expect(r.descricao).toBe("Olá, tenho muitas caixas e um colchão para deitar fora, obrigado.");
  });

  it("o português fica intacto, letra a letra, e não vai ao tradutor", async () => {
    const pt = "Para levar: 1 sofá, 1 frigorífico\nPormenores (ditos pelo cliente): Está tudo na cave.";
    const t = tradutor({});
    const r = await descricaoEmPortugues(pt, { traduzir: t });
    expect(r).toEqual({ descricao: pt, original: null, lingua: null, porTraduzir: false, motivo: null });
    expect(t.pedidos).toHaveLength(0);
  });

  it("o tradutor falhou: fica a original, «por traduzir», com o motivo — nunca em inglês calado", async () => {
    const r = await descricaoEmPortugues(DO_623, { traduzir: tradutor({}) });
    expect(r.porTraduzir).toBe(true);
    expect(r.descricao).toBe(DO_623);
    expect(r.original).toBe(DO_623);
    expect(r.motivo).toBeTruthy();
  });

  it("o tradutor rebentou: também «por traduzir»", async () => {
    const r = await descricaoEmPortugues(DO_623, {
      traduzir: async () => {
        throw new Error("503 unavailable");
      },
    });
    expect(r.porTraduzir).toBe(true);
    expect(r.motivo).toContain("503");
  });

  it("uma «tradução» que voltou em inglês não serve", async () => {
    const texto = "A lot of cardboard boxes, a few trash bags of styrofoam, two lamps, a twin size mattress and a rug.";
    expect(traducaoQueServe(texto, texto, "en")).toBeNull();
    expect(traducaoQueServe("", texto, "en")).toBeNull();
    expect(traducaoQueServe("«Muitas caixas de cartão e um tapete.»", texto, "en")).toBe("Muitas caixas de cartão e um tapete.");
    const r = await descricaoEmPortugues(DO_623, { traduzir: tradutor({ [texto]: texto }) });
    expect(r.porTraduzir).toBe(true);
  });

  it("sem chave do Gemini, o caminho de verdade dá «por traduzir» (e não atira)", async () => {
    const antes = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    vi.resetModules();
    try {
      const m = await import("./descricao-em-portugues");
      const r = await m.descricaoEmPortugues(DO_623);
      expect(r.porTraduzir).toBe(true);
      expect(r.motivo).toContain("GEMINI_API_KEY");
    } finally {
      if (antes !== undefined) process.env.GEMINI_API_KEY = antes;
    }
  }, 30_000);
});

describe("a instrução ao tradutor", () => {
  it("leva os nomes de cá — colchão de solteiro, esferovite — e pede português de Portugal", () => {
    const i = instrucaoParaPortugues("en");
    expect(i).toContain("inglês");
    expect(i).toContain("português de Portugal");
    expect(i).toMatch(/twin[^\n]*→ colchão de solteiro/);
    expect(i).toMatch(/styrofoam[^\n]*→ esferovite/);
    expect(i).toMatch(/cardboard boxes[^\n]*→ caixas de cartão/);
    expect(i).toContain("CLYON");
  });

  it("o rótulo do original no backoffice", () => {
    expect(rotuloDoOriginal("en")).toBe("Dito pelo cliente (inglês)");
    expect(rotuloDoOriginal("fr")).toBe("Dito pelo cliente (francês)");
    expect(rotuloDoOriginal(null)).toBe("Dito pelo cliente");
  });
});

describe("os caminhos que gravam a descrição passam pela tradução", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("a criação de qualquer pedido, a Vitória e as reescritas", () => {
    const db = ler("src/lib/db.ts");
    const criar = db.slice(db.indexOf("export async function createSimulatorOrder"), db.indexOf("export async function getAllSimulatorOrders"));
    expect(criar).toContain("descricaoEmPortugues(");
    expect(ler("src/lib/registar-pedido-por-whatsapp.ts")).toContain("descricaoEmPortugues(");
    const nb = ler("src/lib/descricao-do-pedido-na-base.ts");
    expect((nb.match(/descricaoEmPortugues\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(ler("src/app/api/admin/pedidos/arrumar-descricao/route.ts")).toContain("descricaoEmPortugues(");
  });
  it("por traduzir, a Vitória passa a conversa à equipa", () => {
    const n = ler("src/lib/whatsapp-negociacao.ts");
    expect(n).toMatch(/if \(porTraduzir\) \{\s*await interromperNumeroWhatsApp/);
  });
  it("o original sai com a descrição quando o pedido se anonimiza", () => {
    expect(ler("src/lib/regras-novas-da-retencao.ts")).toMatch(/descricaoOriginal: "nulo"/);
    expect(ler("src/lib/db.ts")).toContain("descricaoOriginal = NULL");
  });
});
