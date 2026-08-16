import { describe, it, expect } from "vitest";
import {
  distanciaEmLinhaRecta,
  distanciaParaElegibilidade,
  pontoValido,
  FACTOR_DE_ESTRADA,
} from "./distancia-entre-pontos";

const LISBOA = { lat: 38.7223, lng: -9.1393 };
const PORTO = { lat: 41.1579, lng: -8.6291 };
const AMADORA = { lat: 38.7597, lng: -9.2245 };
const SETUBAL = { lat: 38.5244, lng: -8.8882 };

describe("distanciaEmLinhaRecta", () => {
  // Lisboa–Porto em linha recta são ~274 km (de estrada são ~313).
  it("acerta em distâncias conhecidas", () => {
    expect(distanciaEmLinhaRecta(LISBOA, PORTO)).toBeGreaterThan(270);
    expect(distanciaEmLinhaRecta(LISBOA, PORTO)).toBeLessThan(280);
  });

  it("Lisboa–Amadora são poucos quilómetros", () => {
    const km = distanciaEmLinhaRecta(LISBOA, AMADORA);
    expect(km).toBeGreaterThan(5);
    expect(km).toBeLessThan(12);
  });

  it("é zero para o mesmo ponto", () => {
    expect(distanciaEmLinhaRecta(LISBOA, LISBOA)).toBe(0);
  });

  it("é simétrica", () => {
    expect(distanciaEmLinhaRecta(LISBOA, PORTO)).toBeCloseTo(
      distanciaEmLinhaRecta(PORTO, LISBOA),
      6,
    );
  });

  it("não rebenta em pontos antípodas", () => {
    const km = distanciaEmLinhaRecta({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(Number.isFinite(km)).toBe(true);
    expect(km).toBeGreaterThan(20000);
  });
});

describe("pontoValido", () => {
  it("aceita coordenadas portuguesas", () => {
    expect(pontoValido(LISBOA)).toBe(true);
    expect(pontoValido(SETUBAL)).toBe(true);
  });

  // 0,0 fica no Golfo da Guiné. Em Portugal é sempre um campo por preencher
  // que alguém converteu para número — e passava a "0 km da base", ou seja,
  // elegível para tudo.
  it("recusa a ilha nula", () => {
    expect(pontoValido({ lat: 0, lng: 0 })).toBe(false);
  });

  it("recusa fora dos limites do globo", () => {
    expect(pontoValido({ lat: 91, lng: 0 })).toBe(false);
    expect(pontoValido({ lat: 0, lng: 181 })).toBe(false);
  });

  it("recusa o que não é um par de números", () => {
    for (const mau of [null, undefined, "38.7,-9.1", {}, { lat: "38.7", lng: -9.1 }, { lat: NaN, lng: 0 }]) {
      expect(pontoValido(mau)).toBe(false);
    }
  });
});

describe("distanciaParaElegibilidade", () => {
  // A linha recta subestima a estrada. Sem a folga, quem dissesse "30 km"
  // recebia pedidos que na prática ficam a 39 — e a promessa do registo
  // deixava de ser verdade logo no primeiro pedido.
  it("aplica a folga de estrada", () => {
    const recta = distanciaEmLinhaRecta(LISBOA, SETUBAL);
    const usada = distanciaParaElegibilidade(LISBOA, SETUBAL);
    expect(usada).toBeCloseTo(Math.round(recta * FACTOR_DE_ESTRADA * 10) / 10, 1);
    expect(usada!).toBeGreaterThan(recta);
  });

  it("devolve null quando falta um dos lados", () => {
    expect(distanciaParaElegibilidade(null, LISBOA)).toBeNull();
    expect(distanciaParaElegibilidade(LISBOA, undefined)).toBeNull();
    expect(distanciaParaElegibilidade({ lat: 0, lng: 0 }, LISBOA)).toBeNull();
  });

  it("arredonda a uma casa decimal", () => {
    const km = distanciaParaElegibilidade(LISBOA, AMADORA)!;
    expect(km).toBe(Math.round(km * 10) / 10);
  });
});
