import { describe, it, expect } from "vitest";
import {
  validarInscricao,
  nifValido,
  emailValido,
  telefoneValido,
  RAIO_MAXIMO_KM,
} from "./inscricao-profissional";

const valida = {
  nome: "Transportes Silva Lda",
  email: "geral@silva.pt",
  telefone: "912345678",
  nif: "501442600",
  cidade: "Amadora",
  categorias: ["recolha_moveis", "recolha_monos"],
  zonas: ["Lisboa", "Sintra"],
  raioKm: 30,
  emiteFatura: true,
  regimeIva: "isento",
  emiteGuiaTransporte: false,
  numeroTransportador: "",
};

const com = (p: Record<string, unknown>) => validarInscricao({ ...valida, ...p });

function erros(r: ReturnType<typeof validarInscricao>) {
  return r.ok ? [] : r.erros.map((e) => e.campo);
}

describe("nifValido", () => {
  // Dígito de controlo — apanha o engano de digitação quando ainda é barato
  // de corrigir, em vez de estragar uma fatura meses depois.
  it("aceita NIF com dígito de controlo certo", () => {
    expect(nifValido("501442600")).toBe(true);
    expect(nifValido("500 100 144")).toBe(true);
  });

  it("recusa NIF com dígito de controlo errado", () => {
    expect(nifValido("501442601")).toBe(false);
    expect(nifValido("111111111")).toBe(false);
    // 123456789 tem o dígito de controlo CERTO (soma 156, resto 2, controlo 9).
    // Parece inventado e passa — é por isso que o teste usa outro.
    expect(nifValido("123456789")).toBe(true);
  });

  it("recusa o que não tem nove dígitos", () => {
    expect(nifValido("50144260")).toBe(false);
    expect(nifValido("5014426000")).toBe(false);
    expect(nifValido("abcdefghi")).toBe(false);
    expect(nifValido("")).toBe(false);
  });
});

describe("telefoneValido", () => {
  it("aceita telemóvel e fixo, com e sem indicativo", () => {
    for (const t of ["912345678", "+351912345678", "00351912345678", "912 345 678", "213456789"]) {
      expect(telefoneValido(t)).toBe(true);
    }
  });

  it("recusa números que não existem em Portugal", () => {
    for (const t of ["12345678", "812345678", "91234567", "9123456789", ""]) {
      expect(telefoneValido(t)).toBe(false);
    }
  });
});

describe("emailValido", () => {
  it("aceita e recusa o óbvio", () => {
    expect(emailValido("a@b.pt")).toBe(true);
    expect(emailValido("sem-arroba.pt")).toBe(false);
    expect(emailValido("a@b")).toBe(false);
    expect(emailValido("")).toBe(false);
  });
});

describe("validarInscricao", () => {
  it("aceita uma inscrição completa", () => {
    const r = validarInscricao(valida);
    expect(r.ok).toBe(true);
  });

  it("exige nome, email, telefone e cidade", () => {
    expect(erros(com({ nome: "" }))).toContain("nome");
    expect(erros(com({ email: "xx" }))).toContain("email");
    expect(erros(com({ telefone: "123" }))).toContain("telefone");
    expect(erros(com({ cidade: "" }))).toContain("cidade");
  });

  it("exige pelo menos uma categoria", () => {
    expect(erros(com({ categorias: [] }))).toContain("categorias");
  });

  // Sem isto, alguém inscrevia-se com uma categoria inventada e ficava com um
  // perfil que nunca casava com pedido nenhum.
  it("ignora categorias que não existem", () => {
    expect(erros(com({ categorias: ["voar", "recolha_moveis"] }))).toEqual([]);
    const r = com({ categorias: ["voar", "recolha_moveis"] });
    if (r.ok) expect(r.dados.categorias).toEqual(["recolha_moveis"]);
  });

  it("recusa uma inscrição só com categorias inventadas", () => {
    expect(erros(com({ categorias: ["voar"] }))).toContain("categorias");
  });

  describe("raio", () => {
    it("recusa raios absurdos ou em falta", () => {
      expect(erros(com({ raioKm: 0 }))).toContain("raioKm");
      expect(erros(com({ raioKm: RAIO_MAXIMO_KM + 1 }))).toContain("raioKm");
      expect(erros(com({ raioKm: "muitos" }))).toContain("raioKm");
      expect(erros(com({ raioKm: undefined }))).toContain("raioKm");
    });

    it("aceita raio vindo como texto do formulário", () => {
      const r = com({ raioKm: "45" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.raioKm).toBe(45);
    });
  });

  describe("fatura", () => {
    it("quem emite fatura tem de dar NIF", () => {
      expect(erros(com({ emiteFatura: true, nif: "" }))).toContain("nif");
    });

    // O IVA é do regime DELE. Assumi-lo por nós mostrava 23% a quem contrata
    // um isento — um imposto que não é devido e que ninguém pode entregar.
    it("quem emite fatura tem de dizer o regime de IVA", () => {
      expect(erros(com({ emiteFatura: true, regimeIva: undefined }))).toContain("regimeIva");
      expect(erros(com({ emiteFatura: true, regimeIva: "inventado" }))).toContain("regimeIva");
    });

    it("aceita os dois regimes", () => {
      for (const r of ["isento", "normal"]) {
        const x = com({ emiteFatura: true, regimeIva: r });
        expect(x.ok).toBe(true);
        if (x.ok) expect(x.dados.regimeIva).toBe(r);
      }
    });

    // Quem não emite fatura não tem regime nenhum a declarar. Fica isento por
    // omissão, que é o que não mostra imposto ao cliente.
    it("quem não emite fatura não precisa de regime, e fica isento", () => {
      const x = com({ emiteFatura: false, nif: "", regimeIva: undefined });
      expect(x.ok).toBe(true);
      if (x.ok) expect(x.dados.regimeIva).toBe("isento");
    });

    it("quem não emite fatura pode não dar NIF", () => {
      expect(erros(com({ emiteFatura: false, nif: "" }))).toEqual([]);
    });

    it("um NIF errado é recusado mesmo sem emitir fatura", () => {
      expect(erros(com({ emiteFatura: false, nif: "111111111" }))).toContain("nif");
    });
  });

  describe("guia de transporte", () => {
    // Sem número não há nada para verificar, e sem verificação a declaração
    // não vale — não se liga um cliente a quem talvez não possa transportar.
    it("quem declara emitir guia tem de dar o número de registo", () => {
      expect(erros(com({ emiteGuiaTransporte: true, numeroTransportador: "" }))).toContain(
        "numeroTransportador",
      );
      expect(erros(com({ emiteGuiaTransporte: true, numeroTransportador: "ab" }))).toContain(
        "numeroTransportador",
      );
    });

    it("aceita com número", () => {
      const r = com({ emiteGuiaTransporte: true, numeroTransportador: "APA-123456" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.numeroTransportador).toBe("APA-123456");
    });

    it("quem não declara guia não precisa de número", () => {
      const r = com({ emiteGuiaTransporte: false, numeroTransportador: "" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.numeroTransportador).toBeNull();
    });
  });

  describe("zonas", () => {
    // Quem não escrevesse zonas nenhumas não recebia nada, nem sequer da sua
    // própria cidade.
    it("a cidade de base entra sempre nas zonas", () => {
      const r = com({ zonas: [] });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.zonas).toEqual(["Amadora"]);
    });

    it("não duplica a cidade quando ela já vem nas zonas", () => {
      const r = com({ zonas: ["Amadora", "Lisboa"] });
      if (r.ok) expect(r.dados.zonas).toEqual(["Amadora", "Lisboa"]);
    });
  });

  it("normaliza o email para minúsculas", () => {
    const r = com({ email: "Geral@Silva.PT" });
    if (r.ok) expect(r.dados.email).toBe("geral@silva.pt");
  });

  it("não rebenta com lixo à entrada", () => {
    for (const lixo of [null, undefined, "texto", 42, [], {}]) {
      expect(validarInscricao(lixo).ok).toBe(false);
    }
  });

  it("acumula os erros todos em vez de parar no primeiro", () => {
    const r = validarInscricao({});
    expect(erros(r).length).toBeGreaterThanOrEqual(5);
  });
});
