import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  A_DESLOCACAO_NO_PRECO,
  DESDE_UMA_PECA,
  ENTULHO_NA_FAQ,
  MOVEIS_POR_PECA,
  MOVEIS_POR_PECA_COM_OS_ANDARES,
  lerPedidoParaReferencia,
  precoDaPecaComOIva,
  referenciaDoPedido,
  referenciaDoSimuladorDoSite,
} from "./preco-de-referencia";
import {
  ENTULHO_POR_VOLUME,
  ETIQUETA_DOS_MOVEIS,
  PECAS_DE_REFERENCIA,
  PRECOS,
  RECOLHA_MINIMA_DOS_MOVEIS,
  faixaDoVolume,
  maisIva,
} from "./precos-publicos";
import { calculateFastEstimate, camposDoPedidoParaOMotor } from "./pricing-helper";
import { camposDaCategoriaParaGravar } from "./pedido-por-categoria";
import { linhasDoEntulho, linhasDosMonosEMoveis } from "./quanto-custa";
import { ITENS_A_MAIS_PARA_O_CLIENTE, acrescimoPorItens, avisoDosItens } from "./itens-a-mais";
import { oQueOSiteSabe } from "./o-que-o-site-sabe";
import { PERGUNTAS_FREQUENTES } from "./perguntas-frequentes";
import { tituloDaCidade } from "./titulos-seo";

/*
 * A DECISÃO d7 — 04-11-2026, as três escolhas do dono:
 *
 *   1. móveis: recolha mínima de 40 € + IVA (49,20 € com IVA); a soma das peças
 *      nunca fica abaixo dela, e os andares e o estacionamento somam-se depois;
 *   2. o entulho a granel ao mesmo preço que os sacos: 1 m³ = 40 sacos ×
 *      4,00–4,80 € = 160–192 € + IVA; o mínimo de 10 sacos fica, e acima de 5 m³
 *      continua a proposta com fotografias;
 *   3. os exemplos por peça seguem a tabela (sofá, cama e armário grande são
 *      peças grandes, a mesa com cadeiras uma média), e os itens a mais também
 *      (sem tamanho, a peça média).
 */

const r12 = (corpo: Record<string, unknown>) => referenciaDoPedido(lerPedidoParaReferencia(corpo)!);
const texto = (r: ReturnType<typeof r12>) => r.linhas.map((l) => l.texto).join(" ");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

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

describe("d7 (1) — a recolha mínima dos móveis, 40 € + IVA", () => {
  it("a fonte, e a frase pública com o com IVA ao lado", () => {
    expect(RECOLHA_MINIMA_DOS_MOVEIS).toBe(40);
    expect(PRECOS.recolha_moveis.minimo).toBe(40);
    expect(maisIva(ETIQUETA_DOS_MOVEIS)).toBe("por peça: pequena 15 €, média 30 €, grande 50 € + IVA; recolha mínima 40 € + IVA");
    expect(MOVEIS_POR_PECA).toBe(
      "por peça: pequena 15 €, média 30 €, grande 50 € + IVA (18,45 / 36,90 / 61,50 € com IVA); recolha mínima 40 € + IVA (49,20 € com IVA)",
    );
    expect(MOVEIS_POR_PECA_COM_OS_ANDARES).toContain("; e, depois do mínimo, mais 5 € + IVA por andar com elevador");
    // «recolha mínima», nunca «deslocação» (a linha da Vendas).
    expect(MOVEIS_POR_PECA_COM_OS_ANDARES).not.toMatch(/desloca/);
  });

  it("1 peça pequena no rés-do-chão = 40 € + IVA (49,20 € com IVA), e o porquê diz a recolha mínima", () => {
    const r = r12({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 1 }, floor: "rés-do-chão", parkingDistance: "door" });
    expect(r.linhas).toEqual([{ rotulo: "Estimativa", texto: "40 € + IVA (49,20 € com IVA)." }]);
    expect(r.porque).toEqual(["1 peça pequena (15 €): conta a recolha mínima de 40 € + IVA"]);
    expect(r.conta).toMatchObject({ servico: "40 €", total: "49,20 €" });
  });

  it("1 peça média no 3.º andar sem elevador = 40 + 45 = 85 € + IVA: os andares depois do mínimo", () => {
    const r = r12({ servico: "recolha_moveis", movelModo: "item", itens: { medio: 1 }, floor: "3º", hasElevator: "no", parkingDistance: "door" });
    expect(texto(r)).toBe("85 € + IVA (104,55 € com IVA).");
    expect(r.porque).toEqual(["1 peça média (30 €): conta a recolha mínima de 40 € + IVA", "3.º andar sem elevador: +45 € + IVA"]);
  });

  it("2 grandes + 1 média no 2.º andar com elevador = 140 € + IVA (não muda)", () => {
    const r = r12({ servico: "recolha_moveis", movelModo: "item", itens: { medio: 1, grande: 2 }, floor: "2º", hasElevator: "small", parkingDistance: "under_20m" });
    expect(texto(r)).toBe("140 € + IVA (172,20 € com IVA).");
    expect(r.porque).toEqual(["2 peças grandes × 50 € = 100 € + IVA", "1 peça média × 30 € = 30 € + IVA", "2.º andar com elevador: +10 € + IVA"]);
  });

  it("o estacionamento longe também se soma depois do mínimo; 2 pequenas contam a mínima; 1 pequena + 1 média já não", () => {
    expect(texto(r12({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 1 }, parkingDistance: "over_30m" }))).toBe("55 € + IVA (67,65 € com IVA).");
    expect(r12({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 2 } }).porque).toEqual([
      "2 peças pequenas (30 €): conta a recolha mínima de 40 € + IVA",
    ]);
    expect(texto(r12({ servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 1, medio: 1 } }))).toBe("45 € + IVA (55,35 € com IVA).");
  });

  it("o simulador do site dá o mesmo que a R12", () => {
    const site = referenciaDoSimuladorDoSite({ serviceType: "recolha_moveis", movelMode: "item", movelItemsMedio: 1, floor: "3º", hasElevator: "no", parkingDistance: "door" })!;
    expect(texto(site)).toBe("85 € + IVA (104,55 € com IVA).");
  });

  it("o motor dá o mesmo número que a R12 nos três exemplos do dono (contrato)", async () => {
    const casos: Array<[Record<string, unknown>, Record<string, unknown>, number]> = [
      [{ movelItemsPequeno: 1, floor: "rés-do-chão", parkingDistance: "door" }, { itens: { pequeno: 1 }, floor: "rés-do-chão", parkingDistance: "door" }, 40],
      [{ movelItemsMedio: 1, floor: "3º", hasElevator: "no", parkingDistance: "door" }, { itens: { medio: 1 }, floor: "3º", hasElevator: "no", parkingDistance: "door" }, 85],
      [
        { movelItemsMedio: 1, movelItemsGrande: 2, floor: "2º", hasElevator: "small", parkingDistance: "under_20m" },
        { itens: { medio: 1, grande: 2 }, floor: "2º", hasElevator: "small", parkingDistance: "under_20m" },
        140,
      ],
    ];
    for (const [doMotor, daR12, valor] of casos) {
      const e = await motorDoPedido({ serviceType: "recolha_moveis", movelMode: "item", ...doMotor });
      expect(e.estimatedPriceWithoutVat, String(valor)).toBe(valor);
      expect([e.estimateMinWithoutVat, e.estimateMaxWithoutVat], String(valor)).toEqual([valor, valor]);
      const r = r12({ servico: "recolha_moveis", movelModo: "item", ...daR12 });
      expect(r.conta?.servico, String(valor)).toBe(`${valor} €`);
    }
  }, 60_000);

  it("a FAQ responde com a recolha mínima: «desde uma única peça» e «a deslocação já está no preço»", () => {
    expect(DESDE_UMA_PECA).toBe(
      "Recolhem desde uma única peça. Cada peça conta pela tabela (pequena 15 €, média 30 €, grande 50 € + IVA) e cada recolha tem um mínimo de 40 € + IVA (49,20 € com IVA), que já inclui ir a sua casa, carregar e levar ao destino certo.",
    );
    expect(A_DESLOCACAO_NO_PRECO).toBe(
      "Nos móveis por peça e no entulho em sacos, a deslocação já está no preço: a recolha mínima é de 40 € + IVA (49,20 € com IVA) nos móveis, e de 10 sacos, 40 – 48 € + IVA (49,20 – 59,04 € com IVA), no entulho. Nos outros serviços, entra na proposta de cada parceiro.",
    );
    const respostas = PERGUNTAS_FREQUENTES.flatMap((c) => c.questions).map((q) => q.a);
    expect(respostas).toContain(DESDE_UMA_PECA);
    expect(respostas).toContain(A_DESLOCACAO_NO_PRECO);
    expect(respostas.join(" ")).not.toMatch(/Não há mínimo/);
  });

  it("o «desde» dos títulos e da página dos anúncios passa a 40 € + IVA", () => {
    expect(tituloDaCidade("Recolha de Móveis", "Monte Abraão", "recolha-moveis", "monte-abraao")).toBe("Recolha de Móveis em Monte Abraão — Desde 40 € + IVA");
    const anuncios = ler("src/app/orcamento-recolha-lisboa/LandingClient.tsx");
    expect(anuncios).toContain('{ tipo: "desde", de: PRECOS.recolha_moveis.minimo ?? 40 }');
  });
});

describe("d7 (2) — o entulho a granel ao mesmo preço que os sacos", () => {
  it("a grelha por m³ segue os sacos: 1 m³ = 40 sacos = 160–192 € + IVA", () => {
    expect(ENTULHO_POR_VOLUME).toEqual([
      { m3: 1, sacos: 40, de: 160, ate: 192 },
      { m3: 3, sacos: 120, de: 480, ate: 576 },
      { m3: 5, sacos: 200, de: 800, ate: 960 },
    ]);
    expect(faixaDoVolume(1)).toEqual({ de: 160, ate: 192 });
    expect(PRECOS.recolha_entulho).toMatchObject({ etiqueta: "160 – 192 €/m³", minimo: 160, maximo: 192, unidade: "m³" });
    expect(linhasDoEntulho()[1]).toMatchObject({ oQue: "1 m³ (≈ 40 sacos, ou a granel)", valor: { tipo: "faixa", de: 160, ate: 192 } });
  });

  it("R12: «1 m³ a granel» = «40 sacos ensacados», a mesma estimativa e a mesma conta", () => {
    const granel = r12({ servico: "recolha_entulho", entulho: "chao", entulhoVolume: "ate1", floor: "rés-do-chão", parkingDistance: "door" });
    const sacos = r12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 40, floor: "rés-do-chão", parkingDistance: "door" });
    expect(texto(granel)).toBe("160 – 192 € + IVA (196,80 – 236,16 € com IVA).");
    expect(texto(granel)).toBe(texto(sacos));
    expect(granel.conta).toEqual(sacos.conta);
    expect(granel.porque[0]).toBe("Até 1 m³ a granel ≈ 40 sacos × 4,00–4,80 € = 160–192 € + IVA");
  });

  it("o simulador do site: «No chão» + «Enche uma carrinha» é 1 m³ a granel, 160–192 € + IVA", () => {
    const site = referenciaDoSimuladorDoSite({ serviceType: "recolha_entulho", entulhoState: "chao", entulhoVolume: "carrinha", floor: "rés-do-chão" })!;
    expect(texto(site)).toBe("160 – 192 € + IVA (196,80 – 236,16 € com IVA).");
    expect(site.porque[0]).toBe("Enche uma carrinha, a granel ≈ 40 sacos × 4,00–4,80 € = 160–192 € + IVA");
  });

  it("o mínimo de 10 sacos fica, e acima de 5 m³ continua a proposta com fotografias", () => {
    expect(texto(r12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 3 }))).toBe("40 – 48 € + IVA (49,20 – 59,04 € com IVA).");
    expect(texto(r12({ servico: "recolha_entulho", entulho: "chao", entulhoVolume: "mais" }))).toBe("Proposta com fotografias.");
  });

  it("o motor: «1 m³ a granel» = «40 sacos ensacados» (contrato com a R12)", async () => {
    const granel = await motorDoPedido({ serviceType: "recolha_entulho", entulho: "chao", entulhoVolume: "ate1", floor: "rés-do-chão", parkingDistance: "door" });
    const sacos = await motorDoPedido({ serviceType: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 40, floor: "rés-do-chão", parkingDistance: "door" });
    expect([granel.estimateMinWithoutVat, granel.estimateMaxWithoutVat]).toEqual([160, 192]);
    expect([sacos.estimateMinWithoutVat, sacos.estimateMaxWithoutVat]).toEqual([160, 192]);
    expect(granel.estimatedPriceWithoutVat).toBe(sacos.estimatedPriceWithoutVat);
    expect([granel.estimateMinWithVat, granel.estimateMaxWithVat]).toEqual([196.8, 236.16]);
  }, 60_000);

  it("a FAQ de /recolha-de-entulho: o saco, o mínimo de 10, o granel ao mesmo preço e os andares", () => {
    expect(ENTULHO_NA_FAQ).toBe(
      "Cada saco de 25 a 30 kg conta 4,00 a 4,80 € + IVA (4,92 a 5,90 € com IVA), com um mínimo de 10 sacos por recolha: 40 a 48 € + IVA (49,20 a 59,04 € com IVA). Solto, a granel, conta-se pelo mesmo preço dos sacos. Os andares somam por recolha: +5 € + IVA por andar com elevador, +15 € + IVA sem elevador.",
    );
    expect(ler("src/app/recolha-de-entulho/page.tsx")).toContain("${ENTULHO_NA_FAQ}");
  });

  it("/precos/recolha-de-entulho já não diz «desde 120 €»", () => {
    const f = ler("src/app/precos/recolha-de-entulho/page.tsx").replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
    expect(f).not.toMatch(/desde \$\{euros\(ENTULHO_POR_M3\)\}|Desde \$\{euros\(ENTULHO_POR_M3\)\}/);
    expect(f).toContain("${UM_METRO}");
  });
});

describe("d7 (3) — os exemplos por peça e os itens a mais seguem a tabela", () => {
  it("o sofá, a cama e o armário grande são peças grandes (50 €); a mesa com cadeiras uma média (30 €)", () => {
    expect(PECAS_DE_REFERENCIA.map((p) => `${p.peca}: ${precoDaPecaComOIva(p)}`)).toEqual([
      "Sofá de 2 a 3 lugares: peça grande, 50 € + IVA (61,50 € com IVA)",
      "Cama de casal com estrado: peça grande, 50 € + IVA (61,50 € com IVA)",
      "Armário grande: peça grande, 50 € + IVA (61,50 € com IVA)",
      "Mesa com cadeiras: peça média, 30 € + IVA (36,90 € com IVA)",
    ]);
    const tabela = linhasDosMonosEMoveis().filter((l) => PECAS_DE_REFERENCIA.some((p) => p.peca === l.oQue));
    expect(tabela.map((l) => l.valor)).toEqual([50, 50, 50, 30].map((valor) => ({ tipo: "exacto", valor })));
  });

  it("a Vitória diz o mesmo: o sofá a 50 €, a recolha mínima e o granel ao preço dos sacos", () => {
    const v = oQueOSiteSabe();
    expect(v).toContain("Sofá de 2 a 3 lugares: peça grande, 50 € sem IVA (61,50 € com IVA).");
    expect(v).toContain("recolha mínima 40 € sem IVA (49,20 € com IVA)");
    expect(v).toContain("Entulho, 1 m³ (≈ 40 sacos, ensacado ou a granel): 160 – 192 € sem IVA (196,80 – 236,16 € com IVA).");
    expect(v).not.toMatch(/40 – 70 €|144 €|desde 120 €/);
  });

  it("os itens a mais contam pela tabela das peças; sem tamanho, a peça média (30 €)", () => {
    expect(acrescimoPorItens(1)).toBe(30);
    expect(acrescimoPorItens(1, "pequeno")).toBe(15);
    expect(acrescimoPorItens(1, "grande")).toBe(50);
    expect(ITENS_A_MAIS_PARA_O_CLIENTE).toBe(
      "cada item a mais conta pela tabela das peças: pequena 15 €, média 30 €, grande 50 € + IVA (18,45 / 36,90 / 61,50 € com IVA)",
    );
    expect(avisoDosItens("total", "cliente")).not.toContain("32 €");
    expect(avisoDosItens("total", "profissional")).not.toContain("32 €");
  });
});
