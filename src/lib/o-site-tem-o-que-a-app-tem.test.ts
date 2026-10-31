import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { textoDoProblema } from "@/components/AjudaDoPedido";
import { pedirNoSimulador } from "./servico-na-ligacao";
import { SE_NAO_DISSER_NADA } from "./frases-do-pedido";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";

/** S21 — o que a app tinha e o site não (B1 «A MAIS NA APP»), 29-10-2026. */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("S21", () => {
  it("«Há um problema» e «Pedir outra vez» no link do pedido e na conta", () => {
    expect(textoDoProblema(12)).toBe("Pedido #12: há um problema.");
    expect(pedirNoSimulador("recolha_moveis")).toBe("/simulador?servico=recolha_moveis");
    expect(ler("src/app/pedido/[token]/VistaDoPedido.tsx")).toContain("<AjudaDoPedido pedidoId={pedido.id}");
    expect(ler("src/app/conta/components/OrderDetailModal.tsx")).toContain("<AjudaDoPedido pedidoId={order.id}");
  });

  it("o link mostra o dia combinado e o «feito sem fotografias», como a app", () => {
    const P = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(P).toContain("{acordada.estadoTexto}");
    // d8: o prazo de DIAS_ATE_LIBERTAR_SOZINHO, nunca escrito à mão.
    expect(P).toContain("Confirme que ficou feito. {SE_NAO_DISSER_NADA}");
    expect(SE_NAO_DISSER_NADA).toBe(`Se não disser nada, fica confirmado ${DIAS_ATE_LIBERTAR_SOZINHO} dias depois.`);
    expect(P).not.toMatch(/fica confirmado 7 dias/);
    expect(P).not.toContain("A CLYON confirma consigo antes de libertar");
  });
});
