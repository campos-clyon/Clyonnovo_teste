import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  correrFerramenta,
  estadoNovo,
  type DependenciasDasFerramentas,
  type PedidoParaOAgente,
} from "./vitoria-agente/ferramentas";

/**
 * A VITÓRIA CONTA AS FOTOGRAFIAS A CAMINHO — d98 (f), 23-11-2026.
 *
 * As fotografias que o cliente mandou pelo WhatsApp e ainda esperam pelo
 * pedido contavam 0 no `ler_pedido`, e no `o_que_falta` as fotografias
 * apareciam em falta — a quem as tinha acabado de mandar.
 */

const PEDIDO: PedidoParaOAgente = {
  id: 812,
  serviceType: "recolha_monos",
  status: "pendente",
  contactName: "Cliente Teste",
  address: "Rua de Exemplo 1",
  city: "Almada",
  postalCode: "2800-123",
  floor: "3",
  hasElevator: null,
  parkingDistance: null,
  description: "Um sofá e um colchão.",
  filesJson: "[]",
};

const deps = (over: Partial<DependenciasDasFerramentas> = {}): DependenciasDasFerramentas => ({
  telefone: "351912345678",
  agora: new Date("2026-11-23T12:00:00Z"),
  pedidosDoTelefone: async () => [812],
  lerPedido: async (id) => (id === 812 ? PEDIDO : null),
  lerConversa: async () => [],
  propostasDoPedido: async () => "",
  oQueOSiteSabe: () => "",
  ...over,
});

describe("d98 (f) — as fotografias a caminho contam", () => {
  it("ler_pedido soma as que estão à espera, com as duas partes ao lado", async () => {
    const r = await correrFerramenta("ler_pedido", { pedido: 812 }, deps({ fotografiasAEsperar: async () => 3 }), estadoNovo());
    expect(r.resultado).toMatchObject({ fotografias: 3, fotografiasNoPedido: 0, fotografiasAChegar: 3 });
  });

  it("sem nenhuma à espera, fica como estava", async () => {
    const r = await correrFerramenta("ler_pedido", { pedido: 812 }, deps({ fotografiasAEsperar: async () => 0 }), estadoNovo());
    expect(r.resultado).toMatchObject({ fotografias: 0 });
    expect(r.resultado).not.toHaveProperty("fotografiasAChegar");
  });

  it("o_que_falta não pede fotografias a quem as mandou", async () => {
    const sem = await correrFerramenta("o_que_falta", { pedido: 812 }, deps(), estadoNovo());
    const com = await correrFerramenta("o_que_falta", { pedido: 812 }, deps({ fotografiasAEsperar: async () => 2 }), estadoNovo());
    expect((sem.resultado as { falta: string[] }).falta).toContain("fotografias");
    expect((com.resultado as { falta: string[] }).falta).not.toContain("fotografias");
  });

  it("uma falha a contar não estraga a leitura", async () => {
    const r = await correrFerramenta(
      "ler_pedido",
      { pedido: 812 },
      deps({ fotografiasAEsperar: async () => { throw new Error("base em baixo"); } }),
      estadoNovo(),
    );
    expect(r.resultado).toMatchObject({ fotografias: 0 });
  });

  it("a Vitória de verdade lê as pendentes do número", () => {
    const naBase = readFileSync("src/lib/vitoria-agente/na-base.ts", "utf8");
    expect(naBase).toMatch(/fotografiasAEsperar: \(\) => db\.contarFotosPendentesWhatsApp\(telefone\)/);
  });
});
