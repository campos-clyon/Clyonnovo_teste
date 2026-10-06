import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerQuantidadeDeEntulho, SACOS_POR_BIG_BAG, sacosDeBigBags } from "./sacos-de-entulho";

/**
 * UM BIG BAG SÃO 38 SACOS — 06-10-2026, regra do dono.
 *
 * «Um big bag equivale a 38 sacos, ou seja 22 deveria ser 836.» O pedido #414
 * chegou com «22 bigbags» e ficou com 22 sacos.
 */

describe("a leitura do que o cliente escreveu", () => {
  it("«22 bigbags» são 836 sacos, e o que ele disse fica ao lado", () => {
    const l = lerQuantidadeDeEntulho("levar 22 bigbags com entulho");
    expect(l.sacos).toBe(836);
    expect(l.emMetrosCubicos).toBe(true); // = «não eram sacos», e o dito vai ao lado
    expect(l.dito).toBe("levar 22 bigbags com entulho");
  });

  it("aceita as formas habituais de escrever", () => {
    for (const t of ["22 big bags", "22 big-bags", "22 Big Bag", "22bigbag", "22 bags"]) {
      expect(lerQuantidadeDeEntulho(t).sacos, t).toBe(22 * SACOS_POR_BIG_BAG);
    }
  });

  it("sacos e metros cúbicos continuam como estavam", () => {
    expect(lerQuantidadeDeEntulho("30 sacos").sacos).toBe(30);
    expect(lerQuantidadeDeEntulho("4m3").sacos).toBe(160);
    expect(lerQuantidadeDeEntulho("22").sacos).toBe(22);
  });

  it("a regra é uma só", () => {
    expect(SACOS_POR_BIG_BAG).toBe(38);
    expect(sacosDeBigBags(22)).toBe(836);
  });
});

describe("nenhum ecrã faz a conta à mão", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  for (const f of [
    "src/app/simulador/SimulatorThreePhaseForm.tsx",
    "src/app/plataforma/pedir/FormularioDePedido.tsx",
    "src/components/admin/PedidoDetailModal.tsx",
  ]) {
    it(f, () => {
      const codigo = ler(f);
      expect(codigo).toContain("sacosDeBigBags(");
      expect(codigo).not.toMatch(/\*\s*42\b/);
    });
  }
});
