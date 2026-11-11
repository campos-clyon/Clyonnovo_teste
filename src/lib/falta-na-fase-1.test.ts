import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { faltaNaFase1, FALTA_A_DESCRICAO, linhaDasPecas, comLinhaDasPecas } from "./falta-na-fase-1";

describe("o passo 1 do simulador não prende sem dizer porquê (11-11-2026)", () => {
  it("sem serviço, falta o serviço", () => {
    expect(faltaNaFase1({})).toEqual(["o serviço"]);
  });

  it("a mudança avança só com o serviço — a tipologia vem depois", () => {
    expect(faltaNaFase1({ serviceType: "mudanca" })).toEqual([]);
  });

  it("móveis por peça: as peças chegam, sem descrição nem fotografia", () => {
    expect(faltaNaFase1({ serviceType: "recolha_moveis", movelMode: "item", movelItemsMedio: 2 })).toEqual([]);
    expect(faltaNaFase1({ serviceType: "recolha_moveis", movelMode: "item" })).toHaveLength(1);
  });

  it("manutenção e outro: sem descrição nem fotografia, diz o que falta", () => {
    expect(faltaNaFase1({ serviceType: "manutencao_casa" })).toEqual([FALTA_A_DESCRICAO]);
    expect(faltaNaFase1({ serviceType: "outro", description: "Pintar uma parede" })).toEqual([]);
    expect(faltaNaFase1({ serviceType: "outro", files: [{}] })).toEqual([]);
  });

  it("entulho e espaços dizem cada campo", () => {
    expect(faltaNaFase1({ serviceType: "recolha_entulho" })).toEqual(["como está o entulho", "a quantidade"]);
    expect(faltaNaFase1({ serviceType: "recolha_entulho", entulhoState: "ensacado", entulhoQuantidadeIncerta: true })).toEqual([]);
    expect(faltaNaFase1({ serviceType: "esvaziamento_garagem", volumeTier: "carrinha" })).toEqual(["o acesso"]);
  });

  it("a linha das peças vai para a descrição e sai sem levar o resto", () => {
    expect(linhaDasPecas(1, 2, 0)).toBe("Peças: 1 pequena, 2 médias.");
    const d = comLinhaDasPecas("Peças: 1 pequena.\nSofá no 3.º", linhaDasPecas(0, 0, 1));
    expect(d).toBe("Peças: 1 grande.\nSofá no 3.º");
    expect(comLinhaDasPecas(d, "")).toBe("Sofá no 3.º");
  });

  it("o simulador usa esta regra e mostra «Falta preencher» no passo 1", () => {
    const src = readFileSync(join(__dirname, "../app/simulador/SimulatorThreePhaseForm.tsx"), "utf8");
    expect(src).toContain("const faltaNaFase1 = calcularFaltaNaFase1(formData);");
    expect(src).toContain("Falta preencher: {faltaNaFase1.join");
    expect(src).toContain("descricaoPrecisa=");
    const campo = readFileSync(join(__dirname, "../app/simulador/components/CompactOrderDetails.tsx"), "utf8");
    expect(campo).toContain("descricaoPrecisa ?");
  });
});
