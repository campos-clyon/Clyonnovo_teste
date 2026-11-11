import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { avisosDoNossoLado } from "./avisos-a-equipa";
import { doNossoLado, semRespostaDoNossoLado, type PedidoParaOLado } from "./do-nosso-lado";
import { DEIXAR_A_CLYON_ESCOLHER, PRAZO_DA_LISTA_MS, TEXTOS_DA_LISTA } from "./lista-de-parceiros-da-mudanca";

/**
 * A LISTA DAS MUDANÇAS NÃO PRENDE O PEDIDO — 11-11-2026.
 *
 * 1. O cliente pode «Deixar a CLYON escolher por mim» (o caminho de sempre).
 * 2. A lista tem 8 s para chegar; depois segue sem ela.
 * 3. Se o prazo do escolhido passa sem resposta, a Mesa mostra «parceiro não
 *    respondeu» e a equipa é avisada (o mecanismo da d23: 08h–21h em Lisboa).
 */

const AGORA = new Date("2026-11-11T15:00:00Z");
const ha = (h: number) => new Date(AGORA.getTime() - h * 3_600_000).toISOString();
const daqui = (h: number) => new Date(AGORA.getTime() + h * 3_600_000).toISOString();

const pedido = (negociacoes: PedidoParaOLado["negociacoes"], status = "em_negociacao"): PedidoParaOLado => ({
  id: 610,
  status,
  origem: "simulador",
  contactEmail: null,
  negociacoes,
});
const escolhida = (o: Partial<PedidoParaOLado["negociacoes"][number]> = {}) => ({
  estado: "aberta",
  propostasJson: "[]",
  escolhidoPeloCliente: 1,
  prazoRespostaEm: ha(1),
  ...o,
});

describe("o parceiro escolhido que não respondeu", () => {
  it("prazo passado, sem proposta: aparece na Mesa como «parceiro não respondeu»", () => {
    const l = semRespostaDoNossoLado([pedido([escolhida()])], AGORA);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ tipo: "sem_resposta", pedidoId: 610, esperaS: 3600 });
    expect(l[0].oQue).toContain("parceiro não respondeu");
    const g = doNossoLado({ conversas: null, pedidos: [pedido([escolhida()])], trabalhosClyon: [], agora: AGORA });
    expect(g.find((x) => x.tipo === "sem_resposta")?.linhas).toHaveLength(1);
  });

  it("não aparece antes do prazo, nem se um dos escolhidos respondeu, nem num pedido fechado", () => {
    expect(semRespostaDoNossoLado([pedido([escolhida({ prazoRespostaEm: daqui(1) })])], AGORA)).toEqual([]);
    const comProposta = escolhida({ propostasJson: JSON.stringify([{ por: "profissional", estado: "pendente" }]) });
    expect(semRespostaDoNossoLado([pedido([escolhida(), comProposta])], AGORA)).toEqual([]);
    expect(semRespostaDoNossoLado([pedido([escolhida({ estado: "aguarda_contratacao" })])], AGORA)).toEqual([]);
    expect(semRespostaDoNossoLado([pedido([escolhida()], "cancelado")], AGORA)).toEqual([]);
    // Uma negociação que não foi escolhida pelo cliente não conta.
    expect(semRespostaDoNossoLado([pedido([escolhida({ escolhidoPeloCliente: 0 })])], AGORA)).toEqual([]);
  });

  it("avisa a equipa logo que o prazo passa (sem as 2 h do «Do nosso lado»)", () => {
    const linhas = semRespostaDoNossoLado([pedido([escolhida({ prazoRespostaEm: ha(0.1) })])], AGORA);
    const avisos = avisosDoNossoLado(linhas, AGORA);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ seccao: "mesa", pedidoId: 610, titulo: "Parceiro não respondeu" });
    expect(avisos[0].chave).toBe("nosso_lado:sem_resposta:p610");
  });
});

describe("a lista das mudanças tem saída", () => {
  it("o botão e o prazo vivem na lista, e a rota leva o texto", () => {
    expect(DEIXAR_A_CLYON_ESCOLHER).toBe("Deixar a CLYON escolher por mim");
    expect(TEXTOS_DA_LISTA.deixarEscolher).toBe(DEIXAR_A_CLYON_ESCOLHER);
    expect(PRAZO_DA_LISTA_MS).toBe(8000);
  });

  it("o simulador mostra o botão (caminho de sempre) e corta a lista aos 8 s", () => {
    const src = readFileSync(join(process.cwd(), "src/app/simulador/components/ParceirosDaMudanca.tsx"), "utf8");
    expect(src).toContain("signal: prazo.signal");
    expect(src).toContain("setTimeout(() => prazo.abort(), PRAZO_DA_LISTA_MS)");
    expect(src).toMatch(/onClick=\{onSemLista\}[\s\S]{0,300}deixarEscolher \?\? DEIXAR_A_CLYON_ESCOLHER/);
  });
});

describe("o «desde» das mudanças conta só parceiros reais", () => {
  it("marcar uma conta de teste lê o preço público outra vez, sem esperar a hora da cache", () => {
    const rota = readFileSync(join(process.cwd(), "src/app/api/admin/profissionais/[id]/route.ts"), "utf8");
    expect(rota).toContain('revalidateTag("preco-publico-das-mudancas")');
    const ler = readFileSync(join(process.cwd(), "src/lib/ler-preco-publico-das-mudancas.ts"), "utf8");
    expect(ler).toContain('tags: ["preco-publico-das-mudancas"]');
  });
});
