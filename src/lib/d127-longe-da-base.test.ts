import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildReferenceEstimate,
  calculateFastEstimate,
  camposDoPedidoParaOMotor,
  foraDaZonaDaBase,
  kmDaBaseQueContam,
  textoDasRegrasParaOModelo,
} from "./pricing-helper";
import { camposDaCategoriaParaGravar } from "./pedido-por-categoria";
import { moradaDepoisDeEscrever } from "./morada-escrita";

/*
 * d127 — 25-11-2026 (o CEO e o dono).
 * (1) Uma recolha a mais de 70 km da base caía na referência interna com os km
 *     contados desde a base, sem tecto: duas peças a 400 km davam mais de 950 €
 *     sem IVA. O parceiro é local: longe da base, a tabela normal e sem deslocação.
 * (2) A morada escrita depois de uma escolha não substituía a escolhida: o
 *     pedido seguia com a morada antiga.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

async function motor(order: Record<string, unknown>, km: number | null) {
  const gravado = { ...order, ...camposDaCategoriaParaGravar(order) };
  return calculateFastEstimate({
    serviceType: String(gravado.serviceType),
    description: String(gravado.description ?? ""),
    floor: gravado.floor as string | undefined,
    hasElevator: gravado.hasElevator as string | undefined,
    parkingDistance: gravado.parkingDistance as string | undefined,
    ...(km != null ? { distanceFromBase: { distanceKm: km } } : {}),
    ...camposDoPedidoParaOMotor(gravado),
  } as Parameters<typeof calculateFastEstimate>[0]);
}

const pedidos: Array<[string, Record<string, unknown>]> = [
  ["monos, 2 peças", { serviceType: "recolha_monos", movelMode: "item", movelItemsMedio: 2, floor: "rés-do-chão", hasElevator: "yes", parkingDistance: "door" }],
  ["móveis, 1 média num 3.º sem elevador", { serviceType: "recolha_moveis", movelMode: "item", movelItemsMedio: 1, floor: "3º", hasElevator: "no", parkingDistance: "door" }],
  ["monos descritos em texto", { serviceType: "recolha_monos", description: "Um sofá e um colchão", floor: "1º", hasElevator: "yes", parkingDistance: "door" }],
  ["entulho, 10 sacos", { serviceType: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 10, floor: "rés-do-chão", parkingDistance: "door" }],
];

describe("d127 (1) — longe da base, a tabela normal e sem os km desde a base", () => {
  it("a regra: só acima do limite, e nunca nas mudanças", () => {
    expect(foraDaZonaDaBase("recolha_monos", 407.6)).toBe(true);
    expect(foraDaZonaDaBase("recolha_monos", 70)).toBe(false);
    expect(foraDaZonaDaBase("recolha_monos", null)).toBe(false);
    expect(foraDaZonaDaBase("mudanca", 407.6)).toBe(false);
    expect(kmDaBaseQueContam("recolha_monos", 407.6)).toBe(0);
    expect(kmDaBaseQueContam("recolha_monos", 30)).toBe(30);
  });

  it("a 400 km dá o mesmo que a tabela normal (o que dá na zona da base), e o mesmo sem distância", async () => {
    for (const [nome, order] of pedidos) {
      const longe = await motor(order, 407.6);
      const perto = await motor(order, 12);
      expect(longe.estimatedPriceWithoutVat, nome).toBe(perto.estimatedPriceWithoutVat);
      expect([longe.estimateMinWithoutVat, longe.estimateMaxWithoutVat], nome).toEqual([perto.estimateMinWithoutVat, perto.estimateMaxWithoutVat]);
      expect(longe.source, nome).toBe("local_fast_estimate");
      expect(longe.estimatedPriceWithoutVat!, nome).toBeLessThan(200);
    }
  });

  it("o caso do pedido: 2 peças de monos a 407,6 km já não dão 957,20 € sem IVA", async () => {
    const e = await motor(pedidos[0][1], 407.6);
    expect(e.estimatedPriceWithoutVat).toBe(60);
    expect(e.assumptions.join(" ")).toMatch(/parceiro local/);
  });

  it("na zona da base fica igual a antes: a fórmula ainda conta os km da base", async () => {
    const order = { serviceType: "outro", description: "Levar umas caixas", floor: "rés-do-chão", parkingDistance: "door" };
    const a60 = await motor(order, 60);
    expect(a60.assumptions.join(" ")).toMatch(/Combustível: 120 km/);
    expect(a60.source).toBe("local_fast_estimate");
    // E acima do limite, os km da base deixam de contar.
    const a400 = await motor(order, 400);
    expect(a400.assumptions.join(" ")).not.toMatch(/Combustível/);
    expect(a400.estimatedPriceWithoutVat!).toBeLessThanOrEqual(a60.estimatedPriceWithoutVat!);
  });

  it("a referência interna não soma os km desde a base acima do limite", () => {
    const longe = buildReferenceEstimate({ serviceType: "recolha_monos", distanceFromBase: { distanceKm: 407.6 } } as never);
    const perto = buildReferenceEstimate({ serviceType: "recolha_monos", distanceFromBase: { distanceKm: 30 } } as never);
    expect(longe.estimatedPriceWithoutVat!).toBeLessThan(perto.estimatedPriceWithoutVat!);
    expect(longe.estimatedPriceWithoutVat!).toBeLessThan(200);
  });

  it("as mudanças não mudam: a deslocação é o percurso, não a base", async () => {
    const order = { serviceType: "mudanca", tipologia: "t1", floor: "rés-do-chão", parkingDistance: "door" };
    const a = await motor(order, 12);
    const b = await motor(order, 407.6);
    expect(b.estimatedPriceWithoutVat).toBe(a.estimatedPriceWithoutVat);
  });

  it("o modelo e a análise dizem o mesmo: acima de 70 km, parceiro local e sem deslocação", () => {
    const regras = textoDasRegrasParaOModelo({} as never);
    expect(regras).toMatch(/parceiro local/);
    expect(regras).not.toMatch(/orçamento personalizado/);
    const prompt = ler("src/lib/prompt-do-orcamento.ts");
    expect(prompt).not.toMatch(/Se distância > 70 km → status "onsite_required"/);
    expect(prompt).toMatch(/parceiro local/);
    const rota = ler("src/app/api/simulator/analyze/route.ts");
    expect(rota).toContain("kmDaBaseQueContam(order.serviceType, orderKm)");
    expect(ler("src/lib/pricing-helper.ts")).not.toMatch(/ultrapassa a nossa área de cobertura padrão/);
  });
});

describe("d127 (2) — a morada escrita manda sobre a escolhida antes", () => {
  const escolhida = {
    address: { formattedAddress: "Rua A, 1, 4610-000 Outra Terra", city: "Outra Terra" },
    addressStatus: "selected",
    distanceFromBase: { distanceKm: 400 },
    distanceStatus: "calculated",
    city: "Outra Terra",
    floor: "1º",
  };

  it("escrever outra morada tira a guardada, a distância e a cidade dela", () => {
    const d = moradaDepoisDeEscrever(escolhida, "Rua B, 2, Pontinha");
    expect(d.address).toBeUndefined();
    expect(d.distanceFromBase).toBeUndefined();
    expect(d.distanceStatus).toBeUndefined();
    expect(d.city).toBeUndefined();
    expect(d.addressStatus).toBe("typing");
    expect(d.floor).toBe("1º");
  });

  it("o mesmo texto (ou só espaços a mais) não mexe em nada", () => {
    expect(moradaDepoisDeEscrever(escolhida, "  Rua A, 1,  4610-000 Outra Terra ")).toBe(escolhida);
    const semMorada: { floor: string; address?: undefined } = { floor: "1º" };
    expect(moradaDepoisDeEscrever(semMorada, "Rua B")).toEqual({ floor: "1º" });
  });

  it("os dois formulários passam o que se escreve por aqui", () => {
    for (const f of ["src/app/simulador/SimulatorThreePhaseForm.tsx", "src/app/plataforma/pedir/FormularioDePedido.tsx"]) {
      const s = ler(f);
      expect(s, f).toContain("setFormData((prev) => moradaDepoisDeEscrever(prev, texto))");
      expect(s, f).toContain("setAddressValue={escreverAMorada}");
    }
  });
});
