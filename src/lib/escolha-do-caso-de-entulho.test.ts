import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { referenciaDaLinha, PEDIR_ENTULHO } from "@/app/recolha-de-entulho/EscolhaDoCaso";
import { servicoDaLigacao } from "@/lib/servico-na-ligacao";

const PAGINA = readFileSync(join(process.cwd(), "src/app/recolha-de-entulho/page.tsx"), "utf8");
const COMPONENTE = readFileSync(
  join(process.cwd(), "src/app/recolha-de-entulho/EscolhaDoCaso.tsx"),
  "utf8",
);

describe("«Qual é o seu caso?» na página de entulho", () => {
  it("a faixa dos sacos sai como na grelha, com o IVA dito", () => {
    expect(
      referenciaDaLinha({ service: "s", priceFrom: "110 €", priceTo: "120 €", description: "" }),
    ).toBe("110 – 120 € + IVA");
  });

  it("uma linha sem tecto diz «desde»", () => {
    expect(referenciaDaLinha({ service: "s", priceFrom: "330 €", description: "" })).toBe(
      "desde 330 € + IVA",
    );
  });

  it("o que não é preço passa como está", () => {
    expect(
      referenciaDaLinha({ service: "s", priceFrom: "Orçamento personalizado", description: "" }),
    ).toBe("Orçamento personalizado");
  });

  it("recebe as MESMAS linhas da grelha — não tem números seus", () => {
    expect(PAGINA).toContain("<EscolhaDoCaso linhas={pricingRows} />");
    // Nenhum valor em euros escrito à mão no componente.
    const semComentarios = COMPONENTE.replace(/^\s*(\*|\/\/|\/\*).*$/gm, "");
    expect(semComentarios).not.toMatch(/\d+\s*€/);
  });

  it("o botão abre o simulador já em «Recolha de entulho»", () => {
    expect(servicoDaLigacao(PEDIR_ENTULHO.split("?")[1])).toBe("recolha_entulho");
  });
});
