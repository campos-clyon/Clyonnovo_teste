import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerPedidoParaReferencia, referenciaDoPedido, referenciaDoSimuladorDoSite, valorDosMoveis } from "./preco-de-referencia";
import { ESVAZIAMENTO_POR_TIPOLOGIA, PRECOS, PRECO_POR_ITEM, RECOLHA_MINIMA_DOS_MOVEIS, precoDosSacos } from "./precos-publicos";
import {
  calculateFastEstimate,
  camposDoPedidoParaOMotor,
  classifyItem,
  entulhoPelaGrelha,
  pecasDoTexto,
  type FastEstimateInput,
} from "./pricing-helper";
import { camposDaCategoriaParaGravar } from "./pedido-por-categoria";
import { comIva } from "./quanto-custa";

/*
 * A DECISÃO d22 — 10-11-2026 (o CEO e o dono): o motor de preços segue a grelha
 * publicada. O mesmo pedido tinha três contas — o site, o motor do servidor e a
 * Mesa:
 *   1. o esvaziamento ignorava a tipologia (um T2, publicado a 320–420 €, saía a
 *      250 €, o mínimo de zona);
 *   2. os móveis descritos em texto não seguiam a tabela por peça, e os monos
 *      não seguiam a faixa publicada;
 *   3. o servidor gravava a estimativa que o browser mandava;
 *   4. 200 sacos davam 960 € e 201 davam 804 € — o preço descia.
 */

const r12 = (corpo: Record<string, unknown>) => referenciaDoPedido(lerPedidoParaReferencia(corpo)!);
const texto = (r: { linhas: { texto: string }[] }) => r.linhas.map((l) => l.texto).join(" ");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** O motor como a rota do pedido o chama: o pedido gravado, com os campos da categoria. */
async function motorDoPedido(order: Record<string, unknown>) {
  const gravado = { ...order, ...camposDaCategoriaParaGravar(order) };
  return calculateFastEstimate({
    serviceType: String(gravado.serviceType),
    description: (gravado.description as string | undefined) ?? "",
    floor: gravado.floor as string | undefined,
    hasElevator: gravado.hasElevator as string | undefined,
    parkingDistance: gravado.parkingDistance as string | undefined,
    tipologia: gravado.tipologia as string | undefined,
    distanceFromBase: { distanceKm: 12 },
    ...camposDoPedidoParaOMotor(gravado),
  } as FastEstimateInput);
}

describe("d22 (1) — o esvaziamento pela tipologia, igual nas três portas", () => {
  const T2 = ESVAZIAMENTO_POR_TIPOLOGIA.find((t) => t.chave === "T2")!;

  it("a fonte diz 320–420 € sem IVA para o T2", () => {
    expect([T2.minimo, T2.maximo]).toEqual([320, 420]);
  });

  it("a app (R12) e o site dizem 320 – 420 € + IVA, com o IVA ao lado", () => {
    const frase = "320 – 420 € + IVA (393,60 – 516,60 € com IVA).";
    expect(texto(r12({ servico: "esvaziamento_apartamento", tipologia: "T2" }))).toBe(frase);
    expect(texto(referenciaDoSimuladorDoSite({ serviceType: "esvaziamento_apartamento", tipologia: "T2" })!)).toBe(frase);
  });

  it("o motor (a Mesa) dá a mesma faixa, com o IVA ao lado, e o número fica nela", async () => {
    const e = await motorDoPedido({ serviceType: "esvaziamento_apartamento", tipologia: "T2" });
    expect([e.estimateMinWithoutVat, e.estimateMaxWithoutVat]).toEqual([320, 420]);
    expect([e.estimateMinWithVat, e.estimateMaxWithVat]).toEqual([comIva(320), comIva(420)]);
    expect([e.estimateMinWithVat, e.estimateMaxWithVat]).toEqual([393.6, 516.6]);
    expect(e.estimatedPriceWithoutVat).toBe(420);
    expect(e.estimatedPriceWithVat).toBe(516.6);
    expect(e.recommendedPriceWithoutVat).toBe(420);
    expect(e.pelaGrelha).toBe(true);
    // Era 250 € (o mínimo de zona), fora da faixa publicada.
    expect(e.estimatedPriceWithoutVat).not.toBe(250);
  }, 60_000);

  it("a tipologia escrita na descrição (WhatsApp, contactos) também conta", async () => {
    const e = await motorDoPedido({ serviceType: "esvaziamento_apartamento", description: "Esvaziar um T2 em Almada" });
    expect([e.estimateMinWithoutVat, e.estimateMaxWithoutVat]).toEqual([320, 420]);
  }, 60_000);

  it("pouca coisa é o início da faixa; o andar sem elevador, o topo — como na R12", async () => {
    const pouco = await motorDoPedido({ serviceType: "esvaziamento_apartamento", tipologia: "T2", recheio: "pouco" });
    expect(pouco.estimatedPriceWithoutVat).toBe(320);
    expect(texto(r12({ servico: "esvaziamento_apartamento", tipologia: "T2", recheio: "pouco" }))).toMatch(/^desde 320 € \+ IVA/);
    const semElevador = await motorDoPedido({ serviceType: "esvaziamento_apartamento", tipologia: "T2", floor: "3º", hasElevator: "no" });
    expect(semElevador.estimatedPriceWithoutVat).toBe(420);
    expect(semElevador.estimateMaxWithoutVat).toBe(420);
  }, 60_000);

  it("a moradia só tem o «desde 450 €»: o motor não inventa um tecto", async () => {
    const e = await motorDoPedido({ serviceType: "esvaziamento_casa", tipologia: "moradia" });
    expect([e.estimatedPriceWithoutVat, e.estimateMinWithoutVat, e.estimateMaxWithoutVat]).toEqual([450, 450, 450]);
  }, 60_000);
});

describe("d22 (2) — os móveis descritos em texto pela tabela das peças, e os monos pela faixa", () => {
  it("o tamanho segue os exemplos publicados no seletor das peças", () => {
    expect(classifyItem("micro-ondas")).toBe("pequeno");
    expect(classifyItem("forno")).toBe("pequeno");
    expect(classifyItem("mesinha de cabeceira")).toBe("pequeno");
    expect(classifyItem("fogão")).toBe("medio");
    expect(classifyItem("frigorífico bar")).toBe("medio");
    expect(classifyItem("cadeirão")).toBe("medio");
    expect(classifyItem("sofá")).toBe("grande");
    expect(classifyItem("armário")).toBe("grande");
    expect(classifyItem("frigorífico")).toBe("grande");
    expect(classifyItem("máquina de lavar")).toBe("grande");
    expect(classifyItem("cama de casal")).toBe("grande");
  });

  it("«2 sofás, 1 cadeira e um micro-ondas» = 2 × 50 + 30 + 15 = 145 € + IVA, o mesmo número da R12", async () => {
    const description = "2 sofás, 1 cadeira e um micro-ondas";
    expect(pecasDoTexto({ serviceType: "recolha_moveis", description })).toEqual({ pequeno: 1, medio: 1, grande: 2 });
    const e = await motorDoPedido({ serviceType: "recolha_moveis", description });
    const soma = 2 * PRECO_POR_ITEM.grande + PRECO_POR_ITEM.medio + PRECO_POR_ITEM.pequeno;
    expect(soma).toBe(145);
    expect(e.estimatedPriceWithoutVat).toBe(soma);
    expect(e.estimatedPriceWithVat).toBe(comIva(soma));
    expect(valorDosMoveis({ pequeno: 1, medio: 1, grande: 2 }, null)!.valor).toBe(soma);
    expect(e.pelaGrelha).toBe(true);
  }, 60_000);

  it("uma peça pequena fica na recolha mínima, e os andares somam depois dela", async () => {
    const uma = await motorDoPedido({ serviceType: "recolha_moveis", description: "um micro-ondas" });
    expect(uma.estimatedPriceWithoutVat).toBe(RECOLHA_MINIMA_DOS_MOVEIS);
    const terceiro = await motorDoPedido({ serviceType: "recolha_moveis", description: "um micro-ondas", floor: "3º", hasElevator: "no" });
    expect(terceiro.estimatedPriceWithoutVat).toBe(RECOLHA_MINIMA_DOS_MOVEIS + 3 * 15);
    const r = r12({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 1 }, floor: "3º", hasElevator: "no" });
    expect(r.conta).not.toBeNull();
    expect(texto(r)).toContain("85 € + IVA");
  }, 60_000);

  it("os monos ficam na faixa publicada (30 – 100 €), no topo — nunca o mínimo de 48,78 € por item", async () => {
    expect([PRECOS.recolha_monos.minimo, PRECOS.recolha_monos.maximo]).toEqual([30, 100]);
    const e = await motorDoPedido({ serviceType: "recolha_monos", description: "um mono" });
    expect([e.estimateMinWithoutVat, e.estimateMaxWithoutVat, e.estimatedPriceWithoutVat]).toEqual([30, 100, 100]);
    expect(texto(r12({ servico: "recolha_monos" }))).toBe("30 – 100 € + IVA (36,90 – 123 € com IVA).");
  }, 60_000);
});

describe("d22 (3) — o servidor recalcula sempre, e a grelha manda sobre o modelo", () => {
  it("a rota do pedido não lê a estimativa do browser e corre o motor para todos", () => {
    const rota = semComentarios(ler("src/app/api/simulador/pedido/route.ts"));
    expect(rota).toMatch(/const \{ order, chatHistory \} = await req\.json\(\)/);
    expect(rota).not.toMatch(/\bestimate\s*\?\?/);
    expect(rota).not.toMatch(/semDistancia/);
    expect(rota).toMatch(/const calculada = await calculateFastEstimate\(/);
  });

  it("a análise com o modelo fica com o número do motor sempre que ele vem da grelha", () => {
    const rota = semComentarios(ler("src/app/api/simulator/analyze/route.ts"));
    expect(rota).toMatch(/const daGrelha = fastEstimate\.pelaGrelha === true;/);
  });

  it("o entulho e os móveis por peça dizem que vêm da grelha", async () => {
    const entulho = await motorDoPedido({ serviceType: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50 });
    expect(entulho.pelaGrelha).toBe(true);
    const moveis = await motorDoPedido({ serviceType: "recolha_moveis", movelMode: "item", movelItemsGrande: 2 });
    expect(moveis.pelaGrelha).toBe(true);
  }, 60_000);
});

describe("d22 (4) — o preço do entulho nunca desce quando a quantidade sobe", () => {
  it("200 sacos 960 €, 201 sacos 964,80 € (era 804 €): o topo da faixa, dentro e acima da grelha", () => {
    expect(entulhoPelaGrelha("200")!.semIva).toBe(precoDosSacos(200).ate);
    expect(entulhoPelaGrelha("200")!.semIva).toBe(960);
    expect(entulhoPelaGrelha("201")!.proposta).toBe(true);
    expect(entulhoPelaGrelha("201")!.semIva).toBe(964.8);
  });

  it("de 1 a 400 sacos, cada saco a mais nunca baixa o preço", () => {
    let antes = 0;
    for (let n = 1; n <= 400; n++) {
      const g = entulhoPelaGrelha(String(n))!;
      expect(g.semIva).toBeGreaterThanOrEqual(antes);
      antes = g.semIva;
    }
  });

  it("e a granel também (5 m³ → 6 m³)", () => {
    expect(entulhoPelaGrelha("6 m3")!.semIva).toBeGreaterThanOrEqual(entulhoPelaGrelha("5 m3")!.semIva);
  });
});
