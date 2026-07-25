import { describe, it, expect } from "vitest";
import { suggestJustifications, type RequestFacts } from "./proposal-suggestions";

const acessoDificil: RequestFacts = {
  service: "moveis",
  local: { andar: 3, elevador: false, carrinha_perto: false, lat: 38.77 },
  carga: { itens: [{ nome: "Roupeiro grande", qtd: 3 }, { nome: "Cómoda", qtd: 2 }], volume_m3: 4 },
  fotos: [{ url: "x" }],
  quando: { urgencia: "amanha" },
};

const acessoFacil: RequestFacts = {
  service: "moveis",
  local: { andar: 0, elevador: true, carrinha_perto: true, lat: 38.77 },
  carga: { itens: [{ nome: "Mesa de centro", qtd: 1 }], volume_m3: 1.5 },
  fotos: [{ url: "x" }],
  quando: { urgencia: "flexivel" },
};

describe("direcção do ajuste", () => {
  it("subir acima do limiar é 'up'", () => {
    const r = suggestJustifications({ proposalAmount: 300, referencePrice: 249, facts: acessoDificil });
    expect(r.direction).toBe("up");
    expect(r.deltaEur).toBe(51);
    expect(r.deltaPct).toBeCloseTo(20.5, 1);
  });

  it("descer abaixo do limiar é 'down'", () => {
    const r = suggestJustifications({ proposalAmount: 200, referencePrice: 249, facts: acessoFacil });
    expect(r.direction).toBe("down");
    expect(r.deltaEur).toBe(-49);
  });

  it("arredondamento não conta como ajuste — 250 sobre 249 é 'same'", () => {
    const r = suggestJustifications({ proposalAmount: 250, referencePrice: 249, facts: acessoDificil });
    expect(r.direction).toBe("same");
  });

  it("limiar mínimo de 5 € protege valores pequenos", () => {
    // 3% de 60 = 1,80 → o limiar é 5 €, por isso +4 € ainda é "same"
    expect(suggestJustifications({ proposalAmount: 64, referencePrice: 60 }).direction).toBe("same");
    expect(suggestJustifications({ proposalAmount: 70, referencePrice: 60 }).direction).toBe("up");
  });

  it("sem referência do motor não classifica direcção", () => {
    const r = suggestJustifications({ proposalAmount: 300, referencePrice: null });
    expect(r.direction).toBe("same");
    expect(r.deltaEur).toBe(0);
  });
});

describe("sugestões para SUBIR — saem dos factos do pedido", () => {
  const r = suggestJustifications({ proposalAmount: 340, referencePrice: 249, facts: acessoDificil });
  const ids = r.suggestions.map((s) => s.id);

  it("cita o andar e a ausência de elevador do próprio cliente", () => {
    expect(ids).toContain("escadas");
    const t = r.suggestions.find((s) => s.id === "escadas")!.text;
    expect(t).toContain("3.º andar");
    expect(t).toMatch(/sem elevador/i);
  });

  it("cita a carrinha que não encosta", () => {
    expect(ids).toContain("carrinha-longe");
  });

  it("cita a urgência declarada", () => {
    expect(ids).toContain("urgencia-amanha");
  });

  it("nomeia os itens exigentes concretos", () => {
    expect(ids).toContain("itens-exigentes");
    expect(r.suggestions.find((s) => s.id === "itens-exigentes")!.text).toContain("Roupeiro grande");
  });

  it("todas as sugestões são do tom 'increase' ou neutras", () => {
    expect(r.suggestions.every((s) => s.tone !== "decrease")).toBe(true);
  });

  it("não sugere razões de acesso fácil quando o acesso é difícil", () => {
    expect(ids).not.toContain("acesso-facil");
    expect(ids).not.toContain("data-flexivel");
  });
});

describe("sugestões para DESCER — saem dos factos do pedido", () => {
  const r = suggestJustifications({ proposalAmount: 180, referencePrice: 249, facts: acessoFacil });
  const ids = r.suggestions.map((s) => s.id);

  it("junta os factos de acesso fácil numa frase só", () => {
    expect(ids).toContain("acesso-facil");
    const t = r.suggestions.find((s) => s.id === "acesso-facil")!.text;
    expect(t).toContain("elevador");
    expect(t).toContain("rés-do-chão");
    expect(t).toContain("carrinha encosta");
  });

  it("cita o volume reduzido", () => {
    expect(ids).toContain("volume-pequeno");
  });

  it("cita a data flexível como origem da poupança", () => {
    expect(ids).toContain("data-flexivel");
  });

  it("oferece sempre uma saída comercial genérica", () => {
    expect(ids).toContain("ajuste-comercial");
  });

  it("não sugere razões de agravamento", () => {
    expect(ids).not.toContain("escadas");
    expect(ids).not.toContain("urgencia-hoje");
    expect(r.suggestions.every((s) => s.tone !== "increase")).toBe(true);
  });
});

describe("confirmar o valor do motor (direcção 'same')", () => {
  const r = suggestJustifications({ proposalAmount: 249, referencePrice: 249, facts: acessoDificil });

  it("explica o que entrou no cálculo", () => {
    const t = r.suggestions.find((s) => s.id === "detalhe-calculo")!.text;
    expect(t).toContain("5 itens"); // 3 roupeiros + 2 cómodas
    expect(t).toContain("3.º andar");
  });

  it("oferece a variante 'tudo incluído'", () => {
    expect(r.suggestions.map((s) => s.id)).toContain("tudo-incluido");
  });
});

describe("sem fotos e sem coordenadas", () => {
  it("subir sem fotos convida o cliente a enviá-las", () => {
    const r = suggestJustifications({
      proposalAmount: 320, referencePrice: 249,
      facts: { ...acessoDificil, fotos: [] },
    });
    const t = r.suggestions.find((s) => s.id === "sem-fotos");
    expect(t).toBeDefined();
    expect(t!.text).toMatch(/rever este valor/i);
  });

  it("morada sem coordenadas é assinalada como distância estimada", () => {
    const r = suggestJustifications({
      proposalAmount: 260, referencePrice: 249,
      facts: { ...acessoDificil, local: { ...acessoDificil.local, lat: null } },
    });
    expect(r.suggestions.map((s) => s.id)).toContain("morada-manual");
  });

  it("pedido em revisão explica que o valor é estimativa", () => {
    const r = suggestJustifications({
      proposalAmount: 400, referencePrice: 380, facts: acessoDificil, priceStatus: "revisao",
    });
    expect(r.suggestions.map((s) => s.id)).toContain("revisao-presencial");
  });
});

describe("aviso de piso anti-prejuízo", () => {
  it("avisa quando a proposta desce abaixo do piso", () => {
    const r = suggestJustifications({
      proposalAmount: 150, referencePrice: 249, engineFloor: 191.66, facts: acessoFacil,
    });
    expect(r.belowFloorWarning).toMatch(/abaixo do piso/i);
    expect(r.belowFloorWarning).toContain("191.66");
  });

  it("não avisa quando fica acima do piso", () => {
    const r = suggestJustifications({
      proposalAmount: 200, referencePrice: 249, engineFloor: 191.66, facts: acessoFacil,
    });
    expect(r.belowFloorWarning).toBeNull();
  });

  it("sem piso conhecido não inventa aviso", () => {
    expect(suggestJustifications({ proposalAmount: 10, referencePrice: 249 }).belowFloorWarning).toBeNull();
  });
});

describe("robustez", () => {
  it("sem factos nenhuns ainda devolve algo utilizável", () => {
    const r = suggestJustifications({ proposalAmount: 249, referencePrice: 249 });
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("factos malformados não rebentam", () => {
    const r = suggestJustifications({
      proposalAmount: 300, referencePrice: 249,
      facts: { carga: { itens: [null as never, { qtd: "2" as never }] }, local: null },
    });
    expect(Array.isArray(r.suggestions)).toBe(true);
  });

  it("toda a sugestão tem texto suficiente para cumprir o mínimo obrigatório", () => {
    for (const amount of [180, 249, 340]) {
      const r = suggestJustifications({ proposalAmount: amount, referencePrice: 249, facts: acessoDificil });
      for (const s of r.suggestions) {
        expect(s.text.trim().length, `${s.id}`).toBeGreaterThanOrEqual(10);
        expect(s.basis.length, `${s.id}`).toBeGreaterThan(0);
      }
    }
  });
});
