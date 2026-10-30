import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { legendaDosConfirmados } from "./fim-do-trabalho";
import { ROTULOS_DA_CARTEIRA } from "./rotulos-da-carteira";

/**
 * A LEGENDA DOS «CONFIRMADOS» NA LISTA DO PAINEL — 28-10-2026.
 *
 * Dizia «o valor está na sua carteira» a todos os confirmados. Num trabalho
 * por cobrar o valor ainda não está lá, e num pago em dinheiro está com o
 * profissional. A legenda segue a regra de `ondeEstaODinheiro` e os nomes da
 * carteira (`ROTULOS_DA_CARTEIRA`).
 */

const ONZE = { cliente: 0, profissional: 0.11 };
const base = { valorAcordado: 350, taxas: ONZE, criadaEm: "2026-10-10T10:00:00Z", fase: "confirmado" };

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

describe("a legenda dos confirmados", () => {
  it("só diz «disponível» quando o valor está mesmo disponível", () => {
    expect(legendaDosConfirmados([{ ...base, clientePagou: true }])).toBe(
      minuscula(ROTULOS_DA_CARTEIRA.disponivel.rotulo),
    );
    const porCobrar = legendaDosConfirmados([{ ...base, clientePagou: false }]);
    expect(porCobrar).toBe(minuscula(ROTULOS_DA_CARTEIRA.porCobrar.rotulo));
    expect(porCobrar).not.toMatch(/dispon[ií]vel|carteira/);
    const emDinheiro = legendaDosConfirmados([{ ...base, formaDePagamento: "dinheiro" }]);
    expect(emDinheiro).toBe(minuscula(ROTULOS_DA_CARTEIRA.recebidoEmMao.rotulo));
    expect(emDinheiro).not.toMatch(/dispon[ií]vel|carteira/);
  });

  it("com casos diferentes, conta cada um pelo nome da carteira", () => {
    expect(
      legendaDosConfirmados([
        { ...base, clientePagou: false },
        { ...base, clientePagou: true },
        { ...base, clientePagou: null },
        { ...base, formaDePagamento: "dinheiro" },
      ]),
    ).toBe("pode pedir já: 2 · o cliente ainda não pagou: 1 · recebido em mão: 1");
  });

  it("sem valor que se conte, não promete nada", () => {
    expect(legendaDosConfirmados([])).toBe("abra cada um para ver onde está o valor");
    expect(legendaDosConfirmados([{ ...base, valorAcordado: null }])).not.toMatch(/dispon[ií]vel|carteira/);
  });

  it("o painel usa a regra, e não a frase de antes", () => {
    const PAINEL = readFileSync(join(process.cwd(), "src/app/profissionais/painel/Trabalhos.tsx"), "utf8");
    expect(PAINEL).not.toContain("o valor está na sua carteira");
    expect(PAINEL).toMatch(/legendaDosConfirmados\(naLista\.filter\(\(x\) => chaveDoGrupo\(x\) === "confirmado"\)\)/);
  });
});
