import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CUSTO_KM_POR_OMISSAO,
  ESTACIONAMENTO_DIFICIL_EXTRA,
  FULL_LOAD_ITEM_THRESHOLD,
  TEMPO_DO_MOTOR,
  calculateFastEstimate,
  custoDaDeslocacao,
  estimateLaborHours,
  mensagemDaEstimativa,
  pontoDosMonos,
  textoDasRegrasParaOModelo,
} from "./pricing-helper";
import { createSimulatorSettingsMap } from "./simulator-settings";
import { lerPedidoParaReferencia, referenciaDoPedido, valorDaReferencia } from "./preco-de-referencia";
import { PRECOS } from "./precos-publicos";
import { contagemDasFalhas, motivoDaFalha } from "./falhas-da-ia";
import { buildAnalysisPrompt } from "./prompt-do-orcamento";

/*
 * A DECISÃO d59 — 16-11-2026 (o CEO e o dono): arrumar o motor actual.
 *   1. o simulador já não espera pela IA nem pela internet no envio;
 *   2. as falhas da IA contam-se, e o Início mostra-as;
 *   3. o texto que a IA lê diz o que o motor faz (lido das mesmas constantes);
 *   4. a mensagem das grelhas não fala de equipa nem de horas;
 *   5. estimateMin/Max documentados;
 *   6. os monos com peças contadas pela tabela das peças; sem elas, o meio da faixa.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const r12 = (corpo: Record<string, unknown>) => referenciaDoPedido(lerPedidoParaReferencia(corpo)!);
const texto = (r: { linhas: { texto: string }[] }) => r.linhas.map((l) => l.texto).join(" ");

describe("d59 (1) — o envio do simulador não espera pela IA", () => {
  it("o simulador não chama a análise com IA nem manda a estimativa", () => {
    const S = semComentarios(ler("src/app/simulador/SimulatorThreePhaseForm.tsx"));
    expect(S).not.toContain("/api/simulator/analyze");
    expect(S).toContain("body: JSON.stringify({ order: orderPayload })");
    expect(S).toContain("trackSimulatorEstimate(");
  });

  it("a rota da análise já não vai à internet por pedido", () => {
    const rota = semComentarios(ler("src/app/api/simulator/analyze/route.ts"));
    expect(rota).not.toMatch(/getExternalMarketEstimate|googleSearchRetrieval|needsExternalSearch/);
  });
});

describe("d59 (2) — as falhas da IA contam-se", () => {
  it("o motivo sai da fonte da análise", () => {
    expect(motivoDaFalha({ analysisSource: "timeout_fallback" })).toBe("timeout");
    expect(motivoDaFalha({ analysisSource: "local_fast_estimate" })).toBe("erro");
    expect(motivoDaFalha({ semChave: true })).toBe("sem_chave");
    expect(motivoDaFalha({ respostaInvalida: true })).toBe("resposta_invalida");
    expect(motivoDaFalha({ analysisSource: "clyon_pricing" })).toBeNull();
  });

  it("a contagem soma por motivo e ignora o que não conhece", () => {
    const c = contagemDasFalhas([
      { motivo: "timeout", n: "3" },
      { motivo: "erro", n: 2 },
      { motivo: "outra", n: 9 },
    ]);
    expect(c).toMatchObject({ timeout: 3, erro: 2, sem_chave: 0, resposta_invalida: 0, total: 5 });
  });

  it("a rota grava cada falha e o Início mostra-as", () => {
    const rota = semComentarios(ler("src/app/api/simulator/analyze/route.ts"));
    expect(rota).toContain('contarAFalha("sem_chave"');
    expect(rota).toContain("contarAFalha(motivoDaFalha({ analysisSource: baseSource })");
    expect(rota).toContain('contarAFalha("resposta_invalida"');
    expect(ler("src/components/admin/AdminInicioPanel.tsx")).toContain("<FalhasDaIa />");
    const api = ler("src/app/api/admin/resumo/falhas-da-ia/route.ts");
    expect(api).toContain("requireAdmin(req)");
    // Só contagens: nada de nome, telefone ou email.
    expect(api).not.toMatch(/\b(phone|email|name)\b/);
  });
});

describe("d59 (3) — o texto que a IA lê é o que o motor faz", () => {
  const t = textoDasRegrasParaOModelo(createSimulatorSettingsMap([]));

  it("a carga completa é a do motor, e os itens soltos vão até ela", () => {
    expect(t).toContain(`CARGA COMPLETA (${FULL_LOAD_ITEM_THRESHOLD} ou mais itens`);
    expect(t).toContain(`ITENS SOLTOS (1 a ${FULL_LOAD_ITEM_THRESHOLD - 1} itens`);
    expect(t).not.toMatch(/≥\s*6 itens|1 a 7 itens = por item/);
  });

  it("a desmontagem conta em horas, e não em euros", () => {
    expect(t).not.toMatch(/Desmontagem (simples|complexa): \+\d+ €/);
    expect(t).toContain(`Desmontagem: +${Math.round(TEMPO_DO_MOTOR.desmontagem * 60)} min`);
  });

  it("os minutos e as horas são os do motor, e o motor conta com eles", () => {
    expect(t).toContain(`${Math.round(TEMPO_DO_MOTOR.primeiroItem * 60)} min a primeira peça e ${Math.round(TEMPO_DO_MOTOR.itemSeguinte * 60)} min cada uma das seguintes`);
    expect(t).toContain(`Base: ${String(TEMPO_DO_MOTOR.cargaCompleta).replace(".", ",")} h`);
    expect(t).toContain(`+${ESTACIONAMENTO_DIFICIL_EXTRA} €`);
    // 3 peças soltas no rés-do-chão: a primeira e duas seguintes, arredondado à meia hora (nunca abaixo do mínimo).
    const tres = TEMPO_DO_MOTOR.primeiroItem + 2 * TEMPO_DO_MOTOR.itemSeguinte;
    expect(estimateLaborHours({ serviceType: "recolha_moveis", description: "um sofá, uma mesa e um frigorífico" })).toBe(
      Math.max(TEMPO_DO_MOTOR.minimo, Math.round(tres * 2) / 2),
    );
    expect(estimateLaborHours({ serviceType: "esvaziamento_casa" })).toBe(TEMPO_DO_MOTOR.cargaCompleta);
  });

  it("o km da deslocação é o do motor (0,50 €), não 2 €", () => {
    expect(t).toContain(`${CUSTO_KM_POR_OMISSAO.toFixed(2)} €/km`);
    expect(custoDaDeslocacao(20)).toBe(20 * 2 * CUSTO_KM_POR_OMISSAO);
    const rota = ler("src/app/api/simulator/analyze/route.ts");
    expect(rota).not.toContain("km × 2 €");
    expect(rota).not.toMatch(/Math\.round\((orderKm|km|dKm) \* 2 \* 100\)/);
  });

  it("e o aviso ao modelo diz o limite das peças pela mesma constante", () => {
    const p = buildAnalysisPrompt("(dados)", t, false);
    expect(p).toContain(`ITENS SOLTOS (1–${FULL_LOAD_ITEM_THRESHOLD - 1} itens`);
    expect(p).toContain(`CARGA COMPLETA (≥${FULL_LOAD_ITEM_THRESHOLD} itens)`);
  });
});

describe("d59 (4) — a mensagem das grelhas não fala de equipa nem de horas", () => {
  it("pela grelha, só o valor; pela fórmula, a equipa", () => {
    expect(mensagemDaEstimativa(true, 50, 61.5, 3, 1)).not.toMatch(/equipa|pessoas|\dh\b/);
    expect(mensagemDaEstimativa(false, 200, 246, 3, 4)).toContain("equipa de 3 pessoas");
  });

  it("uma peça pela tabela não diz «equipa de 3 pessoas»", async () => {
    const e = await calculateFastEstimate({ serviceType: "recolha_moveis", movelMode: "item", movelItemsGrande: 1 });
    expect(e.customerMessage).not.toMatch(/equipa de \d pessoas/);
  }, 60_000);
});

describe("d59 (5) — estimateMin e estimateMax ditos no código", () => {
  it("a rota do pedido diz que são o mesmo valor sem e com IVA", () => {
    const rota = ler("src/app/api/simulador/pedido/route.ts");
    expect(rota).toMatch(/estimateMin e estimateMax NÃO são uma faixa/);
  });
});

describe("d59 (6) — os monos pela tabela das peças, ou no meio da faixa", () => {
  it("um sofá custa o mesmo na recolha de móveis e na de monos (motor)", async () => {
    const moveis = await calculateFastEstimate({ serviceType: "recolha_moveis", description: "um sofá" });
    const monos = await calculateFastEstimate({ serviceType: "recolha_monos", description: "um sofá" });
    expect(monos.estimatedPriceWithoutVat).toBe(moveis.estimatedPriceWithoutVat);
    expect(monos.pelaGrelha).toBe(true);
  }, 60_000);

  it("e na R12, com as peças contadas", () => {
    const moveis = r12({ servico: "recolha_moveis", movelModo: "item", itens: { grande: 1 } });
    const monos = r12({ servico: "recolha_monos", itens: { grande: 1 } });
    expect(texto(monos)).toBe(texto(moveis));
    expect(valorDaReferencia(lerPedidoParaReferencia({ servico: "recolha_monos", itens: { grande: 1 } })!)).toBe(
      valorDaReferencia(lerPedidoParaReferencia({ servico: "recolha_moveis", movelModo: "item", itens: { grande: 1 } })!),
    );
  });

  it("sem peças, a faixa publicada fica e o ponto do motor é o meio (o topo com acesso difícil)", async () => {
    const { minimo, maximo } = PRECOS.recolha_monos as { minimo: number; maximo: number };
    expect(pontoDosMonos(minimo, maximo, false).valor).toBe(Math.round((minimo + maximo) / 2));
    expect(pontoDosMonos(minimo, maximo, true).valor).toBe(maximo);
    const e = await calculateFastEstimate({ serviceType: "recolha_monos", description: "uns monos" });
    expect(e.estimatedPriceWithoutVat).toBe(Math.round((minimo + maximo) / 2));
    expect([e.estimateMinWithoutVat, e.estimateMaxWithoutVat]).toEqual([minimo, maximo]);
  }, 60_000);
});
