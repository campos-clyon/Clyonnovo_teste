import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { taxaPeloValor, TAXAS_DO_TRABALHO_CLYON } from "./oferta-clyon";

/**
 * A TAXA DE UM TRABALHO CLYON VAI PELO VALOR — 19-10-2026.
 *
 * *«Vamos colocar as taxas com valores escalonados: abaixo de 200, 10 %;
 * abaixo de 600, 15 %; acima de 601, 20 %.»* Os limites são os que o dono
 * escolheu: 200 € e 600 € já são 15 %, e não há buraco entre 600 e 601.
 */

describe("o escalão de cada valor, sem IVA", () => {
  it.each([
    [50, 0.1],
    [199.99, 0.1],
    [200, 0.15],
    [350, 0.15],
    [600, 0.15],
    [600.01, 0.2],
    [1500, 0.2],
  ])("%s € → %s", (valor, taxa) => {
    expect(taxaPeloValor(valor)).toBe(taxa);
  });

  it("é sempre uma das três taxas que a rota aceita", () => {
    for (const v of [0, 199.99, 200, 600, 601, 10_000]) {
      expect(TAXAS_DO_TRABALHO_CLYON).toContain(taxaPeloValor(v));
    }
  });
});

describe("o ecrã escolhe a taxa do escalão, e deixa mudar à mão", () => {
  const ECRA = readFileSync(join(process.cwd(), "src/components/admin/ValorETaxaDoTrabalho.tsx"), "utf8");

  it("escrever o valor escolhe a taxa do escalão", () => {
    expect(ECRA).toContain("onChange={(e) => mudarValor(e.target.value)}");
    expect(ECRA).toContain("if (novo.ok) onTaxa(taxaPeloValor(novo.valor));");
  });

  it("sem taxa nenhuma, escolhe a do escalão; uma já gravada fica até o valor mudar", () => {
    expect(ECRA).toContain("if (taxa == null && doEscalao != null) onTaxa(doEscalao);");
  });

  it("as três taxas continuam a poder escolher-se, e diz quando a escolhida não é a do escalão", () => {
    expect(ECRA).toContain("onClick={() => onTaxa(t)}");
    expect(ECRA).toContain("Escolhida à mão: o escalão deste valor é");
  });
});
