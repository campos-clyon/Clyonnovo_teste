import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PALAVRAS_DO_ESVAZIAMENTO,
  PERGUNTA_DO_ESVAZIAMENTO,
  divisoesDoTexto,
  pareceUmEsvaziamento,
} from "./parece-um-esvaziamento";

/*
 * d43 — 15-11-2026. O simulador pergunta «Parece um esvaziamento…» quando a
 * lista passa 8 peças, ou há 3+ divisões, ou o texto fala da casa toda, de
 * uma herança, de uma mudança, de arrendar, de um armazém, escritório ou loja.
 */
const RAIZ = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");

describe("d43 — «Parece um esvaziamento»", () => {
  it("a pergunta, palavra a palavra", () => {
    expect(PERGUNTA_DO_ESVAZIAMENTO).toBe(
      "Parece um esvaziamento — quer que os parceiros orcem o espaço todo, com tudo incluído?",
    );
    expect(PALAVRAS_DO_ESVAZIAMENTO).toEqual(["casa toda", "herança", "mudança", "arrendar", "armazém", "escritório", "loja"]);
  });

  it("pela lista: 8 peças não chega, 9 já pergunta", () => {
    expect(pareceUmEsvaziamento({ servico: "recolha_moveis", pecas: 8 })).toBeNull();
    expect(pareceUmEsvaziamento({ servico: "recolha_moveis", pecas: 9 })).toBe("esvaziamento_casa");
    expect(pareceUmEsvaziamento({ servico: "recolha_monos", pecas: 12 })).toBe("esvaziamento_casa");
  });

  it("pelas divisões: 3 ou mais", () => {
    expect(divisoesDoTexto("São 2 divisões")).toBe(2);
    expect(divisoesDoTexto("três quartos e 3 divisões")).toBe(3);
    expect(pareceUmEsvaziamento({ servico: "recolha_moveis", texto: "Móveis de 2 divisões" })).toBeNull();
    expect(pareceUmEsvaziamento({ servico: "recolha_moveis", texto: "Tudo de 3 divisões" })).toBe("esvaziamento_casa");
    expect(pareceUmEsvaziamento({ servico: "recolha_moveis", texto: "4 quartos cheios" })).toBe("esvaziamento_casa");
  });

  it("pelas palavras, sem acentos e com as formas da mesma palavra", () => {
    for (const t of ["Esvaziar a casa toda", "É uma herança", "heranca da avó", "Vou fazer mudança", "para arrendar", "fim do arrendamento"]) {
      expect(pareceUmEsvaziamento({ servico: "recolha_moveis", texto: t }), t).toBe("esvaziamento_casa");
    }
  });

  it("armazém, escritório ou loja passa ao tipo das empresas", () => {
    for (const t of ["Esvaziar um armazém", "armazens em Setúbal", "o escritório fecha", "Loja de roupa a fechar"]) {
      expect(pareceUmEsvaziamento({ servico: "recolha_monos", texto: t }), t).toBe("esvaziamento_empresa");
    }
  });

  it("não pergunta à toa: poucas peças sem as palavras, ou outros serviços", () => {
    expect(pareceUmEsvaziamento({ servico: "recolha_moveis", pecas: 2, texto: "Um sofá e uma cama" })).toBeNull();
    expect(pareceUmEsvaziamento({ servico: "esvaziamento_casa", texto: "herança", pecas: 30 })).toBeNull();
    expect(pareceUmEsvaziamento({ servico: "mudanca", texto: "mudança da casa toda" })).toBeNull();
    expect(pareceUmEsvaziamento({ servico: "recolha_entulho", texto: "obra na loja" })).toBeNull();
  });

  it("o simulador mostra-a no passo 1 e, com sim, muda o serviço", () => {
    const sim = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(sim).toContain("pareceUmEsvaziamento({ servico: formData.serviceType, pecas: pecasDaLista, texto: formData.description })");
    expect(sim).toContain('updateField("serviceType", esvaziamentoSugerido);');
    const cartao = ler("src/app/simulador/components/PareceUmEsvaziamento.tsx");
    expect(cartao).toContain("{PERGUNTA_DO_ESVAZIAMENTO}");
    expect(cartao).not.toMatch(/profissional/i);
  });
});
