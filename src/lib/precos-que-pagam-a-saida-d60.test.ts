import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ESVAZIAMENTO_POR_TIPOLOGIA,
  PRECOS,
  PRECO_DA_PRIMEIRA_GRANDE,
  PRECO_POR_ITEM,
  RECOLHA_MINIMA_DOS_MOVEIS,
  RECOLHA_POR_ANDAR_E_PECA_GRANDE,
  RECOLHA_POR_ANDAR_SEM_ELEVADOR,
  valorDasGrandes,
  valorDeUmAndarAPe,
} from "./precos-publicos";
import { PRECO_POR_HORA, PRECO_POR_HORA_DUAS_PESSOAS, RAIO_INCLUIDO_KM, deslocacao } from "./tabela-das-mudancas";
import { lerPedidoParaReferencia, referenciaDoPedido, valorDosMoveis } from "./preco-de-referencia";
import { calculateFastEstimate } from "./pricing-helper";
import { perguntasDoServico, TITULO_DAS_PECAS_NO_ELEVADOR } from "./simulador-por-categoria";
import { lerTipologiaDoEsvaziamento } from "./respostas-do-simulador";

/*
 * A DECISÃO d60 — 16-11-2026 (o CEO e o dono): preços que pagam a saída, sem IVA,
 * sempre com o com IVA ao lado. Os números vivem nas fontes; aqui confere-se a
 * regra e que o motor, a R12 e o simulador fazem a mesma conta.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const r12 = (corpo: Record<string, unknown>) => referenciaDoPedido(lerPedidoParaReferencia(corpo)!);
const texto = (r: { linhas: { texto: string }[] }) => r.linhas.map((l) => l.texto).join(" ");

describe("d60 — as peças", () => {
  it("a primeira grande a 65 €, as seguintes a 50 €; médias 30, pequenas 15; recolha mínima 60 €", () => {
    expect([PRECO_DA_PRIMEIRA_GRANDE, PRECO_POR_ITEM.grande, PRECO_POR_ITEM.medio, PRECO_POR_ITEM.pequeno]).toEqual([65, 50, 30, 15]);
    expect(RECOLHA_MINIMA_DOS_MOVEIS).toBe(60);
    expect([valorDasGrandes(0), valorDasGrandes(1), valorDasGrandes(3)]).toEqual([0, 65, 165]);
  });

  it("os monos com peças contadas pela mesma conta (d59)", () => {
    expect(texto(r12({ servico: "recolha_monos", itens: { grande: 2 } }))).toBe(texto(r12({ servico: "recolha_moveis", movelModo: "item", itens: { grande: 2 } })));
  });
});

describe("d60 — os andares", () => {
  it("sem elevador: 8 € por andar e por peça grande, nunca menos de 15 € por andar", () => {
    expect(RECOLHA_POR_ANDAR_E_PECA_GRANDE).toBe(8);
    expect(RECOLHA_POR_ANDAR_SEM_ELEVADOR).toBe(15);
    expect([valorDeUmAndarAPe(0), valorDeUmAndarAPe(1), valorDeUmAndarAPe(2), valorDeUmAndarAPe(3)]).toEqual([15, 15, 16, 24]);
    // 3 grandes no 2.º sem elevador: 165 + 2 × 24.
    expect(valorDosMoveis({ grande: 3 }, { floor: "2º", hasElevator: "no" })!.valor).toBe(213);
  });

  it("com elevador +5 € por andar; a peça grande que não cabe conta como escada", () => {
    expect(valorDosMoveis({ grande: 1 }, { floor: "3º", hasElevator: "yes" })!.valor).toBe(65 + 15);
    expect(valorDosMoveis({ grande: 1 }, { floor: "3º", hasElevator: "yes", pecasNoElevador: "sim" })!.valor).toBe(65 + 15);
    expect(valorDosMoveis({ grande: 1 }, { floor: "3º", hasElevator: "yes", pecasNoElevador: "nao" })!.valor).toBe(65 + 45);
    // Sem peças grandes, a resposta não muda nada.
    expect(valorDosMoveis({ medio: 2 }, { floor: "3º", hasElevator: "yes", pecasNoElevador: "nao" })!.valor).toBe(60 + 15);
    const r = r12({ servico: "recolha_moveis", movelModo: "item", itens: { grande: 1 }, floor: "3º", hasElevator: "yes", pecasNoElevador: "nao" });
    expect(texto(r)).toBe("110 € + IVA (135,30 € com IVA).");
    expect(r.porque).toContain("3.º andar, as peças grandes não cabem no elevador (pela escada): +45 € + IVA");
  });

  it("o motor faz a mesma conta, com a resposta que o pedido grava", async () => {
    const e = await calculateFastEstimate({ serviceType: "recolha_moveis", movelMode: "item", movelItemsGrande: 1, floor: "3º", hasElevator: "yes", pecasNoElevador: "nao" });
    expect(e.estimatedPriceWithoutVat).toBe(110);
  }, 60_000);

  it("a pergunta nova no simulador (R7) e no do site, só onde há elevador", () => {
    for (const s of ["recolha_moveis", "recolha_monos"]) {
      const p = perguntasDoServico(s).find((x) => x.id === "pecasNoElevador")!;
      expect(p.titulo).toBe(TITULO_DAS_PECAS_NO_ELEVADOR);
      expect(p.opcoes!.map((o) => o.id)).toEqual(["sim", "nao", "nao_sei"]);
      expect(p.quando?.hasElevator).toEqual(["yes", "small"]);
    }
    expect(perguntasDoServico("recolha_entulho").some((x) => x.id === "pecasNoElevador")).toBe(false);
    expect(ler("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain('id="sim-pecas-no-elevador"');
    expect(ler("src/lib/pricing-helper.ts")).toMatch(/"movelItemsGrande",\s*"pecasNoElevador",/);
  });
});

describe("d60 — o esvaziamento e as mudanças", () => {
  it("T2 400–600, T3 650–950, T4 900–1 300, moradia desde 900; o T0/T1 fica", () => {
    expect(ESVAZIAMENTO_POR_TIPOLOGIA.map((t) => [t.chave, t.minimo, t.maximo ?? null])).toEqual([
      ["T0/T1", 260, 350],
      ["T2", 400, 600],
      ["T3", 650, 950],
      ["T4", 900, 1300],
      ["moradia", 900, null],
    ]);
    expect(PRECOS.esvaziamento_apartamento.etiqueta).toBe("260 – 1 300 €");
    expect(lerTipologiaDoEsvaziamento("esvaziamento_apartamento", "T3/T4")).toBe("T3");
  });

  it("a referência das mudanças: 40 €/h com 2 pessoas, 55 €/h com 3, 15 km incluídos", () => {
    expect([PRECO_POR_HORA_DUAS_PESSOAS, PRECO_POR_HORA, RAIO_INCLUIDO_KM]).toEqual([40, 55, 15]);
    expect(deslocacao(15)).toBe(0);
    expect(deslocacao(20)).toBe(52);
  });
});
