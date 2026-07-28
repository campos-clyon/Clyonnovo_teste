import { describe, it, expect } from "vitest";
import { CIDADES_LOCAIS, getCidadeLocal, tempoAproximado } from "./cidades-local";
import { CITIES } from "./seo-data";

describe("dados locais — cada página tem de ter algo que só existe ali", () => {
  it("todas as cidades do site têm dados locais", () => {
    const comDados = new Set(CIDADES_LOCAIS.map((c) => c.slug));
    const semDados = CITIES.filter((c) => !comDados.has(c.slug)).map((c) => c.slug);
    expect(semDados, `sem conteúdo local: ${semDados.join(", ")}`).toEqual([]);
  });

  it("não há dados locais para cidades que não existem no site", () => {
    const doSite = new Set(CITIES.map((c) => c.slug));
    const orfas = CIDADES_LOCAIS.filter((c) => !doSite.has(c.slug)).map((c) => c.slug);
    expect(orfas, `slug sem cidade: ${orfas.join(", ")}`).toEqual([]);
  });

  // Foi por serem todas iguais que o Google as recusou. Um texto repetido
  // entre duas cidades traz o problema de volta.
  it("os textos de acesso são todos diferentes", () => {
    const acessos = CIDADES_LOCAIS.map((c) => c.acesso);
    expect(new Set(acessos).size).toBe(acessos.length);
  });

  it("os textos de estacionamento são todos diferentes", () => {
    const est = CIDADES_LOCAIS.map((c) => c.estacionamento);
    expect(new Set(est).size).toBe(est.length);
  });

  it("cada cidade nomeia zonas próprias, e nenhuma repete a lista de outra", () => {
    const listas = CIDADES_LOCAIS.map((c) => c.zonas.join("|"));
    expect(new Set(listas).size).toBe(listas.length);
    for (const c of CIDADES_LOCAIS) {
      expect(c.zonas.length, c.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("o texto local tem substância, não uma linha", () => {
    for (const c of CIDADES_LOCAIS) {
      expect(c.acesso.length, `${c.slug}: acesso curto demais`).toBeGreaterThan(120);
    }
  });

  it("toda a cidade diz para onde vão os resíduos", () => {
    for (const c of CIDADES_LOCAIS) {
      expect(c.destinoResiduos.nome, c.slug).toBeTruthy();
      expect(c.destinoResiduos.entidade, c.slug).toBeTruthy();
    }
  });

  it("getCidadeLocal devolve null para quem não conhece", () => {
    expect(getCidadeLocal("porto")).toBeNull();
    expect(getCidadeLocal("lisboa")?.slug).toBe("lisboa");
  });
});

describe("tempoAproximado — estimativa honesta, não promessa", () => {
  it("nunca promete menos de 10 minutos", () => {
    expect(tempoAproximado(1)).toBe("cerca de 10 minutos");
  });

  it("arredonda a cinco minutos", () => {
    expect(tempoAproximado(20)).toBe("cerca de 25 minutos");
  });

  it("passa a horas quando passa dos 60 minutos", () => {
    expect(tempoAproximado(60)).toBe("cerca de 1h20");
  });

  // "cerca de" não é decoração: a ponte 25 de Abril não permite prometer
  // minutos exactos, e dizer que permite seria mentir.
  it("todas as respostas dizem que são aproximadas", () => {
    for (const km of [5, 15, 30, 48, 70]) {
      expect(tempoAproximado(km)).toMatch(/^cerca de /);
    }
  });
});
