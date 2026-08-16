import { describe, it, expect } from "vitest";
import {
  kmPorCodigoPostal,
  extrairCodigoPostal,
  kmParaOrcamento,
  KM_POR_OMISSAO,
} from "./distancia-estimada";

describe("kmPorCodigoPostal", () => {
  it("as zonas à volta da base", () => {
    expect(kmPorCodigoPostal("2865-123")).toBe(7);   // Fernão Ferro / Amora
    expect(kmPorCodigoPostal("2840-000")).toBe(10);  // Corroios
    expect(kmPorCodigoPostal("2830-100")).toBe(15);  // Barreiro
    expect(kmPorCodigoPostal("2805-000")).toBe(18);  // Almada
  });

  it("Lisboa atravessa a ponte", () => {
    expect(kmPorCodigoPostal("1600-608")).toBe(35);
    expect(kmPorCodigoPostal("1900-000")).toBe(25);
  });

  it("Setúbal e Sesimbra", () => {
    expect(kmPorCodigoPostal("2900-000")).toBe(45);
    expect(kmPorCodigoPostal("2970-000")).toBe(35);
  });

  /**
   * As faixas 2830–2839 e 2836–2844 sobrepunham-se na versão que estava
   * dentro do hero-quote, e a primeira condição a aparecer ganhava. Aqui as
   * fronteiras não se cruzam: cada código postal tem uma resposta só.
   */
  it("cada código postal tem uma resposta só, sem faixas sobrepostas", () => {
    expect(kmPorCodigoPostal("2836-000")).toBe(10);
    expect(kmPorCodigoPostal("2835-000")).toBe(15);
    expect(kmPorCodigoPostal("2829-000")).toBe(18);
  });

  it("lixo e vazio caem no valor por omissão", () => {
    expect(kmPorCodigoPostal("")).toBe(KM_POR_OMISSAO);
    expect(kmPorCodigoPostal(null)).toBe(KM_POR_OMISSAO);
    expect(kmPorCodigoPostal("sem código")).toBe(KM_POR_OMISSAO);
  });
});

describe("extrairCodigoPostal", () => {
  /**
   * O formulário de contactos tem um campo de morada só, onde a pessoa
   * escreve o que quer. O código postal está lá muitas vezes, e é a única
   * pista boa que temos sobre a distância.
   */
  it("encontra o código postal no meio de uma morada escrita à mão", () => {
    expect(extrairCodigoPostal("Rua das Flores, 12, 2845-123 Amora")).toBe("2845-123");
    expect(extrairCodigoPostal("Prcta D. Leonor de Mascarenhas 1600-608 Lisboa")).toBe("1600-608");
  });

  it("não confunde um número de porta com um código postal", () => {
    expect(extrairCodigoPostal("Rua X, 1234")).toBeNull();
    expect(extrairCodigoPostal("Rua X, 12-34")).toBeNull();
  });

  it("sem nada, devolve null e não uma string vazia", () => {
    expect(extrairCodigoPostal("")).toBeNull();
    expect(extrairCodigoPostal(null)).toBeNull();
  });
});

describe("kmParaOrcamento — a ordem das pistas", () => {
  /**
   * Uma distância já medida pelo Google ganha sempre a uma estimativa por
   * código postal. Trocar a ordem era substituir um número bom por um palpite.
   */
  it("a medida ganha ao código postal", () => {
    const r = kmParaOrcamento({ distanciaMedidaKm: 25.7, codigoPostal: "2845-123" });
    expect(r).toEqual({ km: 25.7, origem: "medida" });
  });

  it("sem medida, o código postal manda", () => {
    expect(kmParaOrcamento({ codigoPostal: "2865-000" })).toEqual({ km: 7, origem: "codigo_postal" });
  });

  it("sem código postal, procura-o dentro da morada", () => {
    const r = kmParaOrcamento({ morada: "Rua das Flores, 2900-500 Setúbal" });
    expect(r).toEqual({ km: 45, origem: "codigo_postal" });
  });

  it("sem pista nenhuma, assume — e diz que assumiu", () => {
    expect(kmParaOrcamento({})).toEqual({ km: KM_POR_OMISSAO, origem: "omissao" });
  });

  it("uma distância a zero não conta como medida", () => {
    expect(kmParaOrcamento({ distanciaMedidaKm: 0, codigoPostal: "2865-000" }).origem).toBe("codigo_postal");
  });
});
