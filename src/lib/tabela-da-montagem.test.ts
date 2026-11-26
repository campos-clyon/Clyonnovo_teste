// relógio: datas explícitas — o saber do site e o prompt da Vitória levam a data (26-11-2026).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DESDE_DA_MONTAGEM,
  EUROS_DA_MONTAGEM,
  FIXAR_A_PAREDE_POR_MOVEL,
  HORA_DA_MONTAGEM,
  MINIMO_DA_MONTAGEM,
  POR_ANDAR_A_PE_NA_MONTAGEM,
  RETIRAR_AS_EMBALAGENS,
  TABELA_DA_MONTAGEM,
  andaresAPeQueContam,
  contaDaMontagem,
  extraDaDesmontagem,
  lerRespostasDaMontagem,
  precoDaPecaDaMontagem,
  precoNaOperacao,
} from "./tabela-da-montagem";
import { PRECOS, MENOR_PRECO_PUBLICADO } from "./precos-publicos";
import { FORA_DO_PLANO, SERVICOS_PUBLICOS, grupoDoServico, normalizarCategorias } from "./service-categories";
import { lerPedidoParaReferencia, referenciaDoPedido, precoDeReferencia, valorDoSimuladorDoSite } from "./preco-de-referencia";
import { perguntasDoServico } from "./simulador-por-categoria";
import { camposDaCategoriaParaGravar, linhasDaCategoria } from "./pedido-por-categoria";
import { CAMPOS_DO_PEDIDO_PARA_O_MOTOR, montagemPelaTabela } from "./pricing-helper";
import { oQueOSiteSabe, EUROS_DAS_FONTES } from "./o-que-o-site-sabe";
import { servicoDoTexto, servicoForaDoPlano, servicoPorPalavras } from "./whatsapp-recolha";
import { O_QUE_PODE_FAZER, naoFazemosEsseServico } from "./voz-da-vitoria";
import { foraDoPlanoPorExtenso, servicosPorExtenso, IDS_DA_LISTA } from "./servicos-da-vitoria";
import { conhecimentoDoSite } from "./vitoria-agente/prompt-da-vitoria";
import { faltaNaFase1 } from "./falta-na-fase-1";

/**
 * A MONTAGEM E DESMONTAGEM DE MÓVEIS VOLTA — 26-11-2026 (d132, o CEO e o dono).
 *
 * A tabela «desde» (sem IVA, com o IVA ao lado), as contas (a desmontagem a
 * metade, desmontar e montar a 75 % da soma, o mínimo do serviço, os extras),
 * o serviço de volta ao site, ao simulador e aos parceiros, a Vitória sem a
 * recusa — e o mesmo número em todo o lado.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const respostas = (c: Record<string, unknown>) => lerRespostasDaMontagem(c);

describe("a tabela aprovada", () => {
  it("tem as peças e os preços da decisão, sem IVA", () => {
    expect(TABELA_DA_MONTAGEM.map((l) => [l.id, l.preco])).toEqual([
      ["pequena", 15],
      ["media", 30],
      ["cama_casal", 40],
      ["roupeiro_2", 45],
      ["roupeiro_3", 65],
      ["roupeiro_4", 90],
      ["grande", 50],
      ["parede", 25],
    ]);
    expect(HORA_DA_MONTAGEM).toEqual({ 1: 30, 2: 55 });
    expect(MINIMO_DA_MONTAGEM).toBe(35);
    expect([POR_ANDAR_A_PE_NA_MONTAGEM, FIXAR_A_PAREDE_POR_MOVEL, RETIRAR_AS_EMBALAGENS]).toEqual([10, 10, 10]);
  });

  it("o «desde» diz o com IVA ao lado: 35 € + IVA (43,05 € com IVA)", () => {
    expect(DESDE_DA_MONTAGEM).toBe("desde 35 € + IVA (43,05 € com IVA)");
    expect(PRECOS.montagem_moveis).toEqual({ etiqueta: "desde 35 €", minimo: 35 });
    expect(precoDeReferencia("montagem_moveis")).toBe("desde 35 € + IVA (43,05 € com IVA)");
  });
});

describe("as contas", () => {
  it("desmontar é metade da montagem; desmontar e montar, 75 % da soma dos dois", () => {
    expect(precoNaOperacao(65, "montar")).toBe(65);
    expect(precoNaOperacao(65, "desmontar")).toBe(32.5);
    // 0,75 × (65 + 32,5) = 73,125 → 73,13
    expect(precoNaOperacao(65, "os_dois")).toBe(73.13);
    expect(precoDaPecaDaMontagem("cama_casal", "os_dois")).toBe(45);
    expect(precoDaPecaDaMontagem("pequena", "desmontar")).toBe(7.5);
  });

  it("nunca abaixo do mínimo do serviço (35 €)", () => {
    const c = contaDaMontagem(respostas({ operacaoDaMontagem: "montar", pecasDaMontagem: { pequena: 1 } }));
    expect(c?.antesDoMinimo).toBe(15);
    expect(c?.total).toBe(35);
    expect(c?.peloMinimo).toBe(true);
  });

  it("os extras: andar a pé a partir do 3.º, fixar à parede por móvel, retirar as embalagens", () => {
    expect(andaresAPeQueContam(2, true)).toBe(0);
    expect(andaresAPeQueContam(3, true)).toBe(1);
    expect(andaresAPeQueContam(4, true)).toBe(2);
    expect(andaresAPeQueContam(4, false)).toBe(0);
    const c = contaDaMontagem(
      respostas({ operacaoDaMontagem: "montar", pecasDaMontagem: { roupeiro_3: 1, media: 2 }, fixarAParede: 2, retirarEmbalagens: "sim" }),
      { andar: 4, semElevador: true },
    );
    // 65 + 2 × 30 = 125; + 2 andares × 10 + 2 × 10 + 10 = 175
    expect(c?.somaDasPecas).toBe(125);
    expect(c?.extras.map((e) => e.valor)).toEqual([20, 20, 10]);
    expect(c?.total).toBe(175);
  });

  it("sem operação ou sem peças, não há conta (vale o «desde»); a cozinha vai por orçamento", () => {
    expect(contaDaMontagem(respostas({ pecasDaMontagem: { pequena: 2 } }))).toBeNull();
    expect(contaDaMontagem(respostas({ operacaoDaMontagem: "montar" }))).toBeNull();
    expect(contaDaMontagem(respostas({ operacaoDaMontagem: "montar", pecasDaMontagem: { media: 2 }, cozinhaNaMontagem: "sim" }))?.cozinha).toBe(true);
  });

  it("o extra das recolhas (a metade) e da mudança (75 % da soma), sem mínimo", () => {
    expect(extraDaDesmontagem("recolha_moveis", { roupeiro_3: 1 })).toEqual({ operacao: "desmontar", valor: 32.5, quantas: 1 });
    expect(extraDaDesmontagem("mudanca", { roupeiro_3: 1, cama_casal: 1 })).toEqual({ operacao: "os_dois", valor: 118.13, quantas: 2 });
    expect(extraDaDesmontagem("recolha_entulho", { roupeiro_3: 1 })).toBeNull();
    expect(extraDaDesmontagem("mudanca", {})).toBeNull();
  });
});

describe("o mesmo número no simulador, na app (R12) e no motor", () => {
  const corpo = { servico: "montagem_moveis", operacaoDaMontagem: "montar", pecasDaMontagem: { roupeiro_3: 1, media: 2 }, fixarAParede: 2, retirarEmbalagens: true, floor: "4º+", hasElevator: "no", parkingDistance: "door" };

  it("a R12 dá 175 € + IVA (215,25 € com IVA), e o porquê peça a peça", () => {
    const r = referenciaDoPedido(lerPedidoParaReferencia(corpo)!);
    expect(r.linhas[0].texto).toBe("175 € + IVA (215,25 € com IVA).");
    expect(r.porque.join(" ")).toMatch(/Montar: 1 × Roupeiro de 3 portas × 65 € = 65 € \+ IVA/);
  });

  it("o simulador do site, com os mesmos campos, dá o mesmo", () => {
    expect(
      valorDoSimuladorDoSite({
        serviceType: "montagem_moveis",
        operacaoDaMontagem: "montar",
        pecasDaMontagem: { roupeiro_3: 1, media: 2 },
        fixarAParede: 2,
        retirarEmbalagens: true,
        floor: "4º+",
        hasElevator: "no",
        parkingDistance: "door",
      }),
    ).toBe(175);
  });

  it("o motor lê os mesmos campos e dá o mesmo", () => {
    for (const c of ["operacaoDaMontagem", "pecasDaMontagem", "fixarAParede", "retirarEmbalagens", "cozinhaNaMontagem", "desmontarPecas"]) {
      expect(CAMPOS_DO_PEDIDO_PARA_O_MOTOR as readonly string[]).toContain(c);
    }
    const m = montagemPelaTabela({ serviceType: "montagem_moveis", ...corpo } as never);
    expect(m?.valor).toBe(175);
    expect(montagemPelaTabela({ serviceType: "montagem_moveis" })?.valor).toBe(35);
  });

  it("a mudança e a recolha mostram o extra numa linha à parte", () => {
    const r = referenciaDoPedido(lerPedidoParaReferencia({ servico: "mudanca", tipologia: "T2", desmontarPecas: { roupeiro_3: 1 } })!);
    expect(r.linhas.find((l) => l.rotulo === "Desmontar e montar no destino")?.texto).toBe("73,13 € + IVA (89,95 € com IVA).");
    const m = referenciaDoPedido(
      lerPedidoParaReferencia({ servico: "recolha_moveis", movelModo: "item", itens: { grande: 1 }, desmontagem: "sim", desmontarPecas: { roupeiro_3: 1 } })!,
    );
    expect(m.linhas.find((l) => l.rotulo === "Desmontar antes de levar")?.texto).toBe("32,50 € + IVA (39,98 € com IVA).");
  });
});

describe("o serviço volta ao site, ao simulador e aos parceiros", () => {
  it("está na lista pública, fora do plano só fica a jardinagem", () => {
    expect([...FORA_DO_PLANO]).toEqual(["jardinagem"]);
    expect(SERVICOS_PUBLICOS.some((s) => s.id === "montagem_moveis")).toBe(true);
    expect(MENOR_PRECO_PUBLICADO).toBe(35);
  });

  it("tem um grupo para os parceiros, e quem já o tinha gravado passa a ele", () => {
    expect(grupoDoServico("montagem_moveis")).toBe("montagem_de_moveis");
    expect(normalizarCategorias(["montagem_moveis", "recolha_monos"])).toEqual(["recolhas", "montagem_de_moveis"]);
  });

  it("o simulador pergunta o que é para fazer, as peças da tabela, os extras, a cozinha e o acesso", () => {
    const ids = perguntasDoServico("montagem_moveis").map((p) => p.id);
    expect(ids.slice(0, 1)).toEqual(["operacaoDaMontagem"]);
    for (const l of TABELA_DA_MONTAGEM) expect(ids).toContain(`pecasDaMontagem.${l.id}`);
    for (const id of ["fixarAParede", "retirarEmbalagens", "cozinhaNaMontagem", "floor", "hasElevator", "parkingDistance"]) expect(ids).toContain(id);
    expect(ids).not.toContain("desmontagem");
  });

  it("nas recolhas e na mudança, as peças a desmontar pela tabela", () => {
    for (const s of ["recolha_moveis", "recolha_monos", "mudanca"]) {
      expect(perguntasDoServico(s).some((p) => p.id === "desmontarPecas.roupeiro_3"), s).toBe(true);
    }
    expect(perguntasDoServico("recolha_entulho").some((p) => p.id.startsWith("desmontarPecas."))).toBe(false);
  });

  it("o passo 1 do site pede o que é para fazer e as peças (ou uma descrição)", () => {
    expect(faltaNaFase1({ serviceType: "montagem_moveis" })).toHaveLength(2);
    expect(faltaNaFase1({ serviceType: "montagem_moveis", operacaoDaMontagem: "montar", pecasDaMontagem: { media: 1 } })).toEqual([]);
  });

  it("o pedido leva as linhas da montagem na descrição, para a Mesa e o parceiro", () => {
    const o = { serviceType: "montagem_moveis", operacaoDaMontagem: "os_dois", pecasDaMontagem: { cama_casal: 1 }, fixarAParede: 1, cozinhaNaMontagem: true };
    expect(camposDaCategoriaParaGravar(o)).toEqual({});
    expect(linhasDaCategoria(o)).toEqual([
      "Montagem: Desmontar e voltar a montar — 1 × Cama de casal.",
      "Extras da montagem: fixar à parede (anti-queda) 1 móvel.",
      "Cozinha: Os móveis de cozinha são só por orçamento, com fotografias ou uma visita.",
    ]);
    expect(linhasDaCategoria({ serviceType: "mudanca", desmontarPecas: { roupeiro_2: 2 } })).toEqual(["Desmontar e montar no destino: 2 × Roupeiro de 2 portas."]);
  });

  it("a página do serviço é indexável e está no sitemap", () => {
    const pagina = ler("src/app/servicos/[slug]/page.tsx");
    expect(pagina).toContain("TABELA_DA_MONTAGEM");
    expect(ler("src/app/sitemap.ts")).toContain("/servicos/montagem-moveis");
    expect(ler("src/components/Footer.tsx")).toContain("/servicos/montagem-moveis");
  });
});

describe("a Vitória aceita e estima a montagem", () => {
  it("já não recusa: a montagem dá o serviço do pedido", () => {
    expect(servicoForaDoPlano("Boa tarde. Fazem montagem de móveis? Comprei um roupeiro e uma cómoda.")).toBeNull();
    expect(servicoDoTexto("Preciso de montar uma cama e um roupeiro")).toBe("montagem_moveis");
    expect(servicoPorPalavras("Fazem montagem de cozinhas?")).toBe("montagem_moveis");
    expect(servicoDoTexto("Preciso de desmontar um roupeiro")).toBe("montagem_moveis");
  });

  it("quem quer levar alguma coisa continua a pedir uma recolha, e a mudança é mudança", () => {
    expect(servicoDoTexto("desmontar o roupeiro e levá-lo")).toBe("recolha_moveis");
    expect(servicoDoTexto("Mudança de um T2, com desmontagem e montagem dos móveis")).toBe("mudanca");
    expect(servicoDoTexto("Tenho um monte de tralha para levar")).not.toBe("montagem_moveis");
  });

  it("a lista dela, o que pode fazer e o que não faz", () => {
    expect(IDS_DA_LISTA).toContain("montagem_moveis");
    expect(O_QUE_PODE_FAZER).toContain("montagem de móveis");
    expect(servicosPorExtenso()).toContain("montagem e desmontagem de móveis");
    expect(foraDoPlanoPorExtenso()).toBe("jardinagem e limpeza de quintais");
    expect(naoFazemosEsseServico("jardinagem")).toContain("jardinagem");
    expect(ler("src/lib/voz-da-vitoria.ts")).not.toMatch(/montagem_moveis: "montagem de móveis"/);
  });

  it("o saber do site (d129) tem a tabela, com o IVA ao lado, e a guarda dos números aceita-a", () => {
    const saber = oQueOSiteSabe(new Date("2026-11-26T10:00:00Z"));
    expect(saber).toContain("MONTAGEM E DESMONTAGEM DE MÓVEIS");
    expect(saber).toContain("Roupeiro de 3 portas: 65 € + IVA (79,95 € com IVA)");
    expect(saber).toContain(DESDE_DA_MONTAGEM);
    const prompt = conhecimentoDoSite(new Date("2026-11-26T10:00:00Z"));
    expect(prompt).not.toMatch(/Não faz, de momento: montagem/);
    for (const n of EUROS_DA_MONTAGEM) expect(EUROS_DAS_FONTES, String(n)).toContain(n);
  });
});
