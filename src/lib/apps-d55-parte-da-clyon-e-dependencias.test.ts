import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  faixaDoValorEmAtraso,
  partesDoValorEmAtraso,
  PARTE_DA_CLYON_COM_RESERVA as DA_APP,
  type NovoModeloDaCarteira,
} from "../../app-pro/src/lib/novo-modelo";
import { servicoDe } from "../../app-pro/src/lib/trabalhos";
import { PARTE_DA_CLYON_COM_RESERVA } from "./reserva";
import { SERVICE_CATEGORIES } from "./service-categories";

/**
 * d55 (CEO e dono, 16-11-2026) — a app Pro diz o que o painel diz:
 *   · com reserva, o valor em atraso é a «parte da CLYON (taxa da plataforma e
 *     reserva)» (Carteira.tsx); sem `comReserva` no corpo, a frase de hoje;
 *   · o esvaziamento de empresa com o nome da lista única (service-categories.ts).
 * d57 — as dependências da app Pro sobem por overrides (a de cliente espera pelo sim
 * do dono, num ramo à parte); o decode-uri-component não
 * (a 0.5.x é só ESM e o query-string do expo-router fá-lo com require()).
 */
const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const dia = (iso: string | null) => (iso ? "20/11/2026" : null);

function carteira(valores: NovoModeloDaCarteira["valores"]): NovoModeloDaCarteira {
  return { emVigor: true, valorEmAtraso: 0, valores, standBy: null, dadosParaReceber: null };
}
const valor = (extra: Partial<NovoModeloDaCarteira["valores"][number]> = {}): NovoModeloDaCarteira["valores"][number] => ({
  negociacaoId: 1,
  pedidoId: 500,
  total: 49.2,
  iva: 9.2,
  taxa: 40,
  nasceuEm: null,
  prazoAte: "2026-11-20T00:00:00.000Z",
  multibanco: null,
  ...extra,
});

describe("d55 — a parte da CLYON com reserva na app Pro", () => {
  it("usa a frase do site, sem cópia", () => {
    expect(DA_APP).toBe(PARTE_DA_CLYON_COM_RESERVA);
  });

  it("com reserva diz «Parte da CLYON (taxa da plataforma e reserva)»", () => {
    expect(partesDoValorEmAtraso(valor({ comReserva: true }), euros)).toBe(
      "Parte da CLYON (taxa da plataforma e reserva) 40,00 € + IVA 9,20 €",
    );
    expect(partesDoValorEmAtraso({ taxa: 40, iva: 0, comReserva: true }, euros)).toBe("Parte da CLYON (taxa da plataforma e reserva) 40,00 €");
  });

  it("sem o campo (o servidor ainda não o manda) ou a false, fica como hoje", () => {
    expect(partesDoValorEmAtraso(valor(), euros)).toBe("Taxa da plataforma 40,00 € + IVA 9,20 €");
    expect(partesDoValorEmAtraso(valor({ comReserva: false }), euros)).toBe("Taxa da plataforma 40,00 € + IVA 9,20 €");
  });

  it("a faixa do Início diz a parte da CLYON quando há reserva", () => {
    expect(faixaDoValorEmAtraso(carteira([valor({ comReserva: true })]), euros, dia)?.texto).toMatch(
      /^A parte da CLYON \(taxa da plataforma e reserva\) e o IVA dela de 1 trabalho\./,
    );
    expect(faixaDoValorEmAtraso(carteira([valor()]), euros, dia)?.texto).toMatch(/^A taxa da plataforma e o IVA dela de 1 trabalho\./);
  });
});

describe("d55 — o esvaziamento de empresa com nome na app Pro", () => {
  it("servicoDe dá o nome da lista única, não o identificador", () => {
    const nome = SERVICE_CATEGORIES.find((c) => c.id === "esvaziamento_empresa")?.label;
    expect(nome).toBeTruthy();
    expect(servicoDe({ serviceType: "esvaziamento_empresa" })).toBe(nome);
    expect(servicoDe({ serviceType: "esvaziamento_empresa" })).not.toBe("esvaziamento_empresa");
  });

  it("tem ícone na lista dos pedidos", () => {
    const inicio = readFileSync(join(process.cwd(), "app-pro/src/app/(app)/index.tsx"), "utf8");
    expect(inicio).toMatch(/^\s*esvaziamento_empresa: "storefront-outline",/m);
  });
});

describe("d57 — as dependências das apps sobem por overrides", () => {
  // A app de cliente entra quando o dono disser sim ao update: um package.json novo
  // em app-cliente/ na main pede nota nova, e com ela a Action publicaria sozinha.
  for (const app of ["app-pro"]) {
    it(`${app}: node-forge, zod, minimatch, glob e uuid no package.json`, () => {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), app, "package.json"), "utf8"));
      expect(pkg.overrides).toMatchObject({
        "node-forge": "^1.4.3",
        zod: "^4.6.6",
        minimatch: "^11.0.1",
        glob: "^14.0.2",
        uuid: "^11.1.1",
      });
    });

    it(`${app}: o decode-uri-component fica fora (a 0.5 é só ESM e partiria o query-string do expo-router)`, () => {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), app, "package.json"), "utf8"));
      expect(pkg.overrides["decode-uri-component"]).toBeUndefined();
    });
  }
});
