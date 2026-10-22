import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * O pedido de teste #483 (22-10-2026): no rés-do-chão o «Elevador» ficava
 * cinzento no resumo, o backoffice abria o estacionamento em «não perguntei»
 * e o endereço que o anúncio mostra, /recolha/lisboa, dava 404.
 */
const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");

describe("os erros do #483", () => {
  it("no rés-do-chão o elevador fica resolvido no resumo", () => {
    expect(ler("src/app/simulador/components/OrderSummaryCard.tsx")).toContain(
      'status={order.floor === "rés-do-chão" || order.hasElevator ? "filled" : "pending"}',
    );
  });

  it("o backoffice conhece os valores de estacionamento do simulador", () => {
    const f = ler("src/components/admin/RegistarPedido.tsx");
    for (const v of ["door", "under_20m", "over_30m", "unknown", "easy", "difficult"]) {
      expect(f).toContain(`<option value="${v}">`);
    }
    expect(f.match(/<OpcoesDeEstacionamento \/>/g)).toHaveLength(2);
  });

  it("/recolha/lisboa leva à página do anúncio", () => {
    expect(ler("next.config.ts")).toContain(
      '{ source: "/recolha/lisboa", destination: "/orcamento-recolha-lisboa", permanent: true },',
    );
  });
});
