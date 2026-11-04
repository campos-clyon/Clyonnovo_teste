import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MOVEIS_POR_PECA,
  ROTULO_DA_ESTIMATIVA,
  lerPedidoParaReferencia,
  precoDeReferencia,
  referenciaDoPedido,
  referenciaDoSimuladorDoSite,
} from "./preco-de-referencia";
import { ROTULO_DO_TOTAL_DE_REFERENCIA } from "./preco-em-tres-linhas";
import { ENTULHO_ATE_10_SACOS, ETIQUETA_DOS_MOVEIS, PRECOS, PRECO_POR_ITEM, PRECO_POR_SACO, maisIva } from "./precos-publicos";
import { calculateFastEstimate, camposDoPedidoParaOMotor } from "./pricing-helper";
import { camposDaCategoriaParaGravar } from "./pedido-por-categoria";
import { getAllCityServiceSlugs } from "./seo-data";
import { tituloDaCidade } from "./titulos-seo";
import { descricaoDaCidade } from "./descricoes-seo";

/*
 * O ENTULHO (d4) E OS MÓVEIS POR PEÇA (d6 v2) — 03-11-2026, as contas do dono.
 *
 * d4: o saco pequeno a 4,00–4,80 € + IVA; os andares por trabalho (+5 € com
 * elevador, +15 € sem; o estacionamento a mais de 30 m conta como um andar sem
 * elevador). d6 v2: pequena 15 €, média 30 €, grande 50 € + IVA, com os mesmos
 * andares; o «Preço de referência» sai do simulador, o bloco é a «Estimativa» e
 * o resumo diz «Total estimado». E o motor dá o mesmo número.
 *
 * Desde a d7 (04-11-2026, entulho-e-moveis-d7.test.ts): a recolha mínima de 40 €
 * + IVA nos móveis, e o granel ao preço dos sacos. Os casos daqui que mudaram
 * com ela dizem-no.
 */

const r12 = (corpo: Record<string, unknown>) => referenciaDoPedido(lerPedidoParaReferencia(corpo)!);
const texto = (r: ReturnType<typeof r12>) => r.linhas.map((l) => l.texto).join(" ");

/** O motor como a rota do pedido o chama (`/api/simulador/pedido`): o pedido gravado, com os campos da categoria. */
async function motorDoPedido(order: Record<string, unknown>) {
  const gravado = { ...order, ...camposDaCategoriaParaGravar(order) };
  return calculateFastEstimate({
    serviceType: String(gravado.serviceType),
    description: "",
    floor: gravado.floor as string | undefined,
    hasElevator: gravado.hasElevator as string | undefined,
    parkingDistance: gravado.parkingDistance as string | undefined,
    distanceFromBase: { distanceKm: 12 },
    ...camposDoPedidoParaOMotor(gravado),
  });
}

describe("d4 — o saco a 4,00–4,80 € e os andares por trabalho", () => {
  it("as fontes: 10 sacos 40–48 € + IVA (49,20–59,04 € com IVA)", () => {
    expect(PRECO_POR_SACO).toEqual({ minimo: 4, maximo: 4.8 });
    expect(ENTULHO_ATE_10_SACOS).toMatchObject({ minimo: 40, maximo: 48 });
    expect(precoDeReferencia("recolha_entulho")).toContain("10 sacos 40 – 48 € + IVA (49,20 – 59,04 € com IVA)");
  });

  it("o exemplo do dono: 50 sacos, 2.º andar com elevador pequeno, estacionamento até 20 m → 210–250 € + IVA", () => {
    const r = r12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50, floor: "2º", hasElevator: "small", parkingDistance: "under_20m" });
    expect(r.linhas).toEqual([{ rotulo: "Estimativa", texto: "210 – 250 € + IVA (258,30 – 307,50 € com IVA)." }]);
    expect(r.porque).toEqual(["50 sacos × 4,00–4,80 € = 200–240 € + IVA", "2.º andar com elevador: +10 € + IVA"]);
    expect(r.conta).toMatchObject({ servico: "210 – 250 €", total: "258,30 – 307,50 €" });
  });

  it("rés-do-chão: 10 sacos → 40–48 €", () => {
    const r = r12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 10, floor: "rés-do-chão", parkingDistance: "door" });
    expect(texto(r)).toBe("40 – 48 € + IVA (49,20 – 59,04 € com IVA).");
    expect(r.porque).toEqual(["10 sacos × 4,00–4,80 € = 40–48 € + IVA"]);
  });

  it("3.º andar sem elevador, 10 sacos → 85–93 €", () => {
    const r = r12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 10, floor: "3º", hasElevator: "no", parkingDistance: "door" });
    expect(texto(r)).toBe("85 – 93 € + IVA (104,55 – 114,39 € com IVA).");
    expect(r.porque).toEqual(["10 sacos × 4,00–4,80 € = 40–48 € + IVA", "3.º andar sem elevador: +45 € + IVA"]);
  });

  it("1 big bag no 1.º andar com elevador → 157–187,40 €", () => {
    const r = r12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "bigbag", quantidade: 1, floor: "1º", hasElevator: "yes", parkingDistance: "door" });
    expect(texto(r)).toBe("157 – 187,40 € + IVA (193,11 – 230,50 € com IVA).");
    expect(r.porque).toEqual(["1 big bag = 38 sacos × 4,00–4,80 € = 152–182,40 € + IVA", "1.º andar com elevador: +5 € + IVA"]);
  });

  it("o estacionamento a mais de 30 m conta como um andar sem elevador; até 10 sacos, o mínimo de 10", () => {
    const r = r12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 4, floor: "rés-do-chão", parkingDistance: "over_30m" });
    expect(texto(r)).toBe("55 – 63 € + IVA (67,65 – 77,49 € com IVA).");
    expect(r.porque).toEqual([
      "4 sacos: conta o mínimo de 10 sacos × 4,00–4,80 € = 40–48 € + IVA",
      "Estacionamento a mais de 30 metros, como mais um andar sem elevador: +15 € + IVA",
    ]);
  });

  // d7: o granel ao preço dos sacos — era «desde 150 €» (120 + 30).
  it("a granel, pelos sacos que faz (d7), com os andares por trabalho", () => {
    const r = r12({ servico: "recolha_entulho", entulho: "chao", entulhoVolume: "ate1", floor: "2º", hasElevator: "no", parkingDistance: "door" });
    expect(texto(r)).toBe("190 – 222 € + IVA (233,70 – 273,06 € com IVA).");
    expect(r.porque).toContain("2.º andar sem elevador: +30 € + IVA");
  });

  it("o simulador do site dá o mesmo que a app; no chão, «Enche uma carrinha» vai a granel", () => {
    const site = referenciaDoSimuladorDoSite({ serviceType: "recolha_entulho", entulhoState: "ensacado", entulhoQuantidade: "50", floor: "2º", hasElevator: "small", parkingDistance: "under_20m" })!;
    expect(texto(site)).toBe("210 – 250 € + IVA (258,30 – 307,50 € com IVA).");
    const noChao = referenciaDoSimuladorDoSite({ serviceType: "recolha_entulho", entulhoState: "chao", entulhoVolume: "carrinha", entulhoQuantidade: "40", floor: "rés-do-chão" })!;
    expect(texto(noChao)).toBe("160 – 192 € + IVA (196,80 – 236,16 € com IVA).");
  });
});

describe("d6 v2 — os móveis por peça, com os andares (e a recolha mínima desde a d7)", () => {
  it("as fontes: pequena 15 €, média 30 €, grande 50 € + IVA; recolha mínima 40 € + IVA (d7)", () => {
    expect(PRECO_POR_ITEM).toEqual({ pequeno: 15, medio: 30, grande: 50 });
    expect(maisIva(ETIQUETA_DOS_MOVEIS)).toBe("por peça: pequena 15 €, média 30 €, grande 50 € + IVA; recolha mínima 40 € + IVA");
    expect(MOVEIS_POR_PECA).toBe(
      "por peça: pequena 15 €, média 30 €, grande 50 € + IVA (18,45 / 36,90 / 61,50 € com IVA); recolha mínima 40 € + IVA (49,20 € com IVA)",
    );
    expect(precoDeReferencia("recolha_moveis")).toBe(MOVEIS_POR_PECA);
    expect(PRECOS.recolha_moveis).toMatchObject({ minimo: 40 });
  });

  it("o exemplo do dono: 2 grandes + 1 média, 2.º andar com elevador = 140 € + IVA (172,20 € com IVA)", () => {
    const r = r12({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 0, medio: 1, grande: 2 }, floor: "2º", hasElevator: "small", parkingDistance: "under_20m" });
    expect(r.linhas).toEqual([{ rotulo: "Estimativa", texto: "140 € + IVA (172,20 € com IVA)." }]);
    expect(r.porque).toEqual(["2 peças grandes × 50 € = 100 € + IVA", "1 peça média × 30 € = 30 € + IVA", "2.º andar com elevador: +10 € + IVA"]);
    expect(r.conta).toMatchObject({ servico: "140 €", total: "172,20 €" });
  });

  // d7: era 15 € + IVA, sem mínimo.
  it("1 peça pequena no rés-do-chão = a recolha mínima, 40 € + IVA (d7)", () => {
    const r = r12({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 1 }, floor: "rés-do-chão", parkingDistance: "door" });
    expect(texto(r)).toBe("40 € + IVA (49,20 € com IVA).");
    expect(r.porque).toEqual(["1 peça pequena (15 €): conta a recolha mínima de 40 € + IVA"]);
  });

  it("3 grandes, 4.º andar sem elevador = 150 + 60 = 210 € + IVA (258,30 € com IVA)", () => {
    const r = r12({ servico: "recolha_moveis", movelModo: "item", itens: { grande: 3 }, floor: "4º+", hasElevator: "no", parkingDistance: "door" });
    expect(texto(r)).toBe("210 € + IVA (258,30 € com IVA).");
    expect(r.porque).toEqual(["3 peças grandes × 50 € = 150 € + IVA", "4.º andar ou acima sem elevador: +60 € + IVA"]);
  });
});

describe("d6 v2 — a frase por peça nos títulos e nas descrições das cidades", () => {
  it("as 23 páginas de móveis levam o preço por peça no título e na descrição, dentro dos limites", () => {
    const paginas = getAllCityServiceSlugs().filter((p) => p.service.slug === "recolha-moveis");
    expect(paginas.length).toBeGreaterThan(20);
    for (const { service, city } of paginas) {
      const t = tituloDaCidade(service.name, city.name, service.slug, city.slug);
      // O «desde» é a recolha mínima desde a d7 (era «Desde 15 € + IVA»), e a descrição di-la.
      expect([`— 15–50 €/Peça + IVA`, `— Desde 40 € + IVA`].some((fim) => t.endsWith(fim)), t).toBe(true);
      expect(descricaoDaCidade(service.slug, service.name, city.name, city.slug), city.slug).toContain(
        "Por peça, 15 a 50 € + IVA (18,45 a 61,50 € com IVA), mínimo 40 € + IVA.",
      );
    }
    expect(tituloDaCidade("Recolha de Móveis", "Lisboa", "recolha-moveis", "lisboa")).toBe("Recolha de Móveis em Lisboa — 15–50 €/Peça + IVA");
  });
});

describe("d6 — o «Preço de referência» sai do simulador", () => {
  it("o bloco é a «Estimativa», uma linha só, sem a linha geral do serviço", () => {
    expect(ROTULO_DA_ESTIMATIVA).toBe("Estimativa");
    for (const corpo of [
      { servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 20 },
      { servico: "recolha_moveis", movelModo: "item", itens: { grande: 1 } },
      { servico: "recolha_monos" },
      { servico: "esvaziamento_apartamento", tipologia: "T2" },
    ]) {
      const r = r12(corpo);
      expect(r.linhas.map((l) => l.rotulo), JSON.stringify(corpo)).toEqual(["Estimativa"]);
      expect(texto(r)).not.toMatch(/10 sacos|\/m³/);
    }
  });

  it("sem nada escolhido não há a linha geral; os móveis por volume (o modo de sempre) dizem a proposta e a conta por peça", () => {
    expect(r12({ servico: "recolha_entulho" }).linhas).toEqual([]);
    const moveis = r12({ servico: "recolha_moveis" });
    expect(moveis.linhas).toEqual([{ rotulo: "Estimativa", texto: "Proposta com fotografias." }]);
    expect(moveis.porque).toEqual([
      "Por volume, o parceiro faz a proposta a partir das fotografias. Por peça: pequena 15 €, média 30 €, grande 50 € + IVA; recolha mínima 40 € + IVA.",
    ]);
  });

  it("o resumo diz «Total estimado»", () => {
    expect(ROTULO_DO_TOTAL_DE_REFERENCIA).toBe("Total estimado");
  });

  it("o simulador do site não escreve «Preço de referência»", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(ler("src/app/simulador/components/PrecoDeReferencia.tsx")).not.toMatch(/ROTULO_DA_REFERENCIA|Preço de referência:/);
  });
});

describe("o motor dá o mesmo número que a R12 (contrato, d6 v2)", () => {
  it("o entulho do dono: 210–250 € + IVA, 258,30–307,50 € com IVA", async () => {
    const order = { serviceType: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50, floor: "2º", hasElevator: "small", parkingDistance: "under_20m" };
    const e = await motorDoPedido(order);
    expect(e.status).toBe("estimated");
    expect([e.estimateMinWithoutVat, e.estimateMaxWithoutVat]).toEqual([210, 250]);
    expect([e.estimateMinWithVat, e.estimateMaxWithVat]).toEqual([258.3, 307.5]);
    const r = r12({ servico: "recolha_entulho", ...order });
    expect(texto(r)).toContain("210 – 250 €");
  }, 60_000);

  it("os móveis do dono: 140 € + IVA, 172,20 € com IVA — fixo, acima da recolha mínima, sem mínimo de zona", async () => {
    const order = { serviceType: "recolha_moveis", movelMode: "item", movelItemsPequeno: 0, movelItemsMedio: 1, movelItemsGrande: 2, floor: "2º", hasElevator: "small", parkingDistance: "under_20m" };
    const e = await motorDoPedido(order);
    expect(e.estimatedPriceWithoutVat).toBe(140);
    expect(e.estimatedPriceWithVat).toBe(172.2);
    expect(e.vatAmount).toBe(32.2);
    expect([e.estimateMinWithoutVat, e.estimateMaxWithoutVat]).toEqual([140, 140]);
    const r = r12({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 0, medio: 1, grande: 2 }, floor: "2º", hasElevator: "small", parkingDistance: "under_20m" });
    expect(texto(r)).toBe("140 € + IVA (172,20 € com IVA).");
  }, 60_000);

  // d7: era 15 € no motor.
  it("uma peça pequena no rés-do-chão: a recolha mínima, 40 €, no motor também (d7)", async () => {
    const e = await motorDoPedido({ serviceType: "recolha_moveis", movelMode: "item", movelItemsPequeno: 1, floor: "rés-do-chão", parkingDistance: "door" });
    expect(e.estimatedPriceWithoutVat).toBe(40);
  }, 60_000);

  it("o big bag e o granel: o motor lê o pedido gravado como a R12", async () => {
    const bigbag = { serviceType: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "bigbag", quantidade: 1, floor: "1º", hasElevator: "yes", parkingDistance: "door" };
    const e1 = await motorDoPedido(bigbag);
    expect([e1.estimateMinWithoutVat, e1.estimateMaxWithoutVat]).toEqual([157, 187.4]);
    const granel = { serviceType: "recolha_entulho", entulho: "chao", entulhoVolume: "ate1", floor: "2º", hasElevator: "no", parkingDistance: "door" };
    const e2 = await motorDoPedido(granel);
    // d7: o granel ao preço dos sacos (era «desde 150 €»).
    expect([e2.estimateMinWithoutVat, e2.estimateMaxWithoutVat]).toEqual([190, 222]);
  }, 60_000);
});
