import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({ erro: null })) }));

import { POST as referencia } from "@/app/api/cliente/referencia/route";
import { GET as catalogo } from "@/app/api/cliente/catalogo/route";
import { SERVICOS_PUBLICOS } from "./service-categories";
import {
  ENTULHO_POR_VOLUME,
  RECOLHA_POR_ANDAR_COM_ELEVADOR,
  RECOLHA_POR_ANDAR_SEM_ELEVADOR,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  MANUTENCAO_POR_TIPO,
  PRECOS,
  celulaDaManutencao,
} from "./precos-publicos";
import { ANDARES_DO_ENTULHO_EM_FRASE, suplementoDosAndares } from "./quanto-custa";
import { GRELHA_DA_MANUTENCAO_PARA_O_MODELO, GRELHA_DO_ENTULHO_PARA_O_MODELO, calculateFastEstimate, entulhoPelaGrelha } from "./pricing-helper";
import { SACOS_POR_BIG_BAG, SACOS_POR_CARGA } from "./sacos-de-entulho";
import { SERVICOS_COM_DESMONTAGEM, perguntaAparece, perguntasDoServico, type PerguntaDoSimulador } from "./simulador-por-categoria";
import {
  SEM_AJUSTE,
  ajusteAprendido,
  dentroDaFaixa,
  grelhaDaManutencao,
  lerPedidoParaReferencia,
  linhaEscrita,
  referenciaDoPedido,
  referenciaDoSimuladorDoSite,
} from "./preco-de-referencia";
import { QUANTO_TRABALHO, TIPOS_DE_TRABALHO, lerEntulho, localidadeServida, razoesDoAcessoDificil, lerAcesso } from "./respostas-do-simulador";
import { camposDaCategoriaParaGravar, comAsLinhasDaCategoria } from "./pedido-por-categoria";
import { camposExtraDoPedido } from "./campos-extra-do-pedido";

/**
 * O SIMULADOR DE CADA CATEGORIA E A REFERÊNCIA QUE SE ADAPTA — 03-11-2026
 * (decisão d1, ordem do CEO com o sim do dono). Valores inventados; nenhum
 * dado de cliente.
 */

const ids = (servico: string) => perguntasDoServico(servico).map((p) => p.id);
const viaJson = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

/** A referência para um corpo da R12, depois de ir e vir em JSON (como a app a manda). */
function daR12(corpo: Record<string, unknown>) {
  const p = lerPedidoParaReferencia(viaJson(corpo));
  expect(p, JSON.stringify(corpo)).not.toBeNull();
  return referenciaDoPedido(p!);
}
// Desde a d6 (03-11-2026) a linha é a «Estimativa», e é a única.
const especifica = (r: ReturnType<typeof referenciaDoPedido>) => r.linhas.find((l) => l.rotulo === "Estimativa")?.texto ?? null;

const chamar = async (corpo: unknown) =>
  (
    await referencia(
      new NextRequest("https://clyon.pt/api/cliente/referencia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      }),
    )
  ).json();

describe("d1 — as perguntas de cada categoria", () => {
  it("cada serviço do simulador tem as suas perguntas, pela ordem", () => {
    expect(ids("recolha_moveis")).toEqual([
      "movelModo", "itens.pequeno", "itens.medio", "itens.grande", "volume", "quantidadeExacta", "desmontagem",
      "floor", "hasElevator", "parkingDistance",
    ]);
    expect(ids("recolha_monos")).toEqual(["volume", "quantidadeExacta", "desmontagem", "floor", "hasElevator", "parkingDistance"]);
    expect(ids("recolha_entulho")).toEqual([
      "entulho", "tipoDeSaco", "quantidade", "ensacados", "porEnsacar", "entulhoVolume", "floor", "hasElevator", "parkingDistance",
    ]);
    for (const s of ["esvaziamento_casa", "esvaziamento_apartamento"]) {
      expect(ids(s)).toEqual(["tipologia", "recheio", "desmontagem", "floor", "hasElevator", "parkingDistance"]);
    }
    expect(ids("esvaziamento_garagem")).toEqual(["volume", "acessoDoEspaco", "coisasDoEspaco", "parkingDistance"]);
    expect(ids("esvaziamento_cave")).toEqual(["volume", "acessoDoEspaco", "coisasDoEspaco", "parkingDistance"]);
    expect(ids("esvaziamento_sotao")).toEqual(["volume", "acessoDoEspaco", "floor", "hasElevator", "parkingDistance"]);
    expect(ids("mudanca")).toEqual([
      "tipologia", "desmontagem",
      "origem.floor", "origem.hasElevator", "origem.parkingDistance", "origem.difficultAccess", "origem.accessNotes",
      "destino.floor", "destino.hasElevator", "destino.parkingDistance", "destino.difficultAccess", "destino.accessNotes",
    ]);
    expect(ids("manutencao_casa")).toEqual(["tipoDeTrabalho", "quantoTrabalho", "materiais", "repeticao", "floor", "hasElevator", "parkingDistance"]);
    expect(ids("outro")).toEqual(["floor", "hasElevator", "parkingDistance"]);
    // Fora do plano, nada.
    expect(perguntasDoServico("montagem_moveis")).toEqual([]);
    expect(perguntasDoServico("jardinagem")).toEqual([]);
  });

  it("a desmontagem só na recolha de móveis e de monos, no esvaziamento de casa e de apartamento, e na mudança", () => {
    expect([...SERVICOS_COM_DESMONTAGEM].sort()).toEqual(
      ["recolha_moveis", "recolha_monos", "esvaziamento_casa", "esvaziamento_apartamento", "mudanca"].sort(),
    );
    for (const s of ["recolha_entulho", "manutencao_casa", "outro", "esvaziamento_garagem", "esvaziamento_sotao", "esvaziamento_cave"]) {
      expect(ids(s), s).not.toContain("desmontagem");
    }
  });

  it("todas as perguntas estão bem formadas: tipo, opções, e o «quando» só aponta para perguntas de antes", () => {
    for (const s of SERVICOS_PUBLICOS) {
      const lista = perguntasDoServico(s.id);
      expect(lista.length, s.id).toBeGreaterThan(0);
      expect(new Set(lista.map((p) => p.id)).size, `${s.id}: ids repetidos`).toBe(lista.length);
      lista.forEach((p, i) => {
        expect(["escolha", "numero", "texto"]).toContain(p.tipo);
        expect(["oque", "acesso"]).toContain(p.ecra);
        expect(p.titulo.trim().length, `${s.id}.${p.id}`).toBeGreaterThan(2);
        if (p.tipo === "escolha") expect(p.opcoes?.length, `${s.id}.${p.id}`).toBeGreaterThan(1);
        for (const [campo, aceites] of Object.entries(p.quando ?? {})) {
          const antes = lista.slice(0, i).find((x) => x.id === campo) as PerguntaDoSimulador | undefined;
          expect(antes, `${s.id}.${p.id} depende de ${campo}`).toBeDefined();
          for (const a of aceites) expect(antes!.opcoes?.map((o) => o.id), `${s.id}.${p.id}: ${campo}=${a}`).toContain(a);
        }
      });
    }
  });

  it("o entulho: como está → que sacos são → quantos; sem outra pergunta «em sacos»", () => {
    const p = Object.fromEntries(perguntasDoServico("recolha_entulho").map((x) => [x.id, x]));
    expect(p.entulho.titulo).toBe("Como está o entulho?");
    expect(p.entulho.opcoes!.map((o) => `${o.id}=${o.nome}`)).toEqual([
      "ensacado=Já está em sacos",
      "chao=Está no chão (a granel)",
      "misto=Uma parte em sacos e outra no chão",
      "unknown=Não sei",
    ]);
    expect(p.tipoDeSaco.titulo).toBe("Que sacos são?");
    expect(p.tipoDeSaco.quando).toEqual({ entulho: ["ensacado"] });
    expect(p.tipoDeSaco.opcoes!.map((o) => `${o.id}=${o.nome}`)).toEqual([
      "pequeno=Sacos pequenos (25 a 30 kg, como os do Leroy Merlin)",
      "bigbag=Big bags (cerca de 1 m³)",
    ]);
    // O big bag é só a medida do que ele já tem.
    expect(p.tipoDeSaco.opcoes![1].ajuda).toContain(`${SACOS_POR_BIG_BAG} sacos`);
    expect(p.tipoDeSaco.opcoes![1].ajuda).toContain("a CLYON não fornece nem aluga big bags nem contentores");
    expect(p.quantidade).toMatchObject({ titulo: "Quantos?", tipo: "numero", unidadePor: { campo: "tipoDeSaco", unidades: { pequeno: "sacos", bigbag: "big bags" } } });
    expect(p.ensacados.quando).toEqual({ entulho: ["misto"] });
    expect(p.porEnsacar.quando).toEqual({ entulho: ["misto"] });
    expect(p.entulhoVolume.titulo).toBe("Quanto ocupa?");
    expect(p.entulhoVolume.quando).toEqual({ entulho: ["chao"] });
    expect(p.entulhoVolume.opcoes!.map((o) => `${o.id}=${o.nome}${o.ajuda ? ` (${o.ajuda})` : ""}`)).toEqual([
      "ate1=Até 1 m³ (Casa de banho ou cozinha)",
      "ate3=Até 3 m³ (Obra de um T1/T2)",
      "ate5=Até 5 m³ (Demolições)",
      "mais=Mais de 5 m³ (Proposta com fotografias)",
      "incerto=Não sei",
    ]);
    // Os volumes saem da grelha publicada.
    expect(ENTULHO_POR_VOLUME.map((v) => `ate${v.m3}`)).toEqual(["ate1", "ate3", "ate5"]);
    // Uma pergunta por vez: com «Já está em sacos» e «Sacos pequenos», aparece «Quantos?», e mais nenhuma do entulho.
    const visiveis = perguntasDoServico("recolha_entulho").filter((x) => x.ecra === "oque" && perguntaAparece(x, { entulho: "ensacado", tipoDeSaco: "pequeno" }));
    expect(visiveis.map((x) => x.id)).toEqual(["entulho", "tipoDeSaco", "quantidade"]);
    const noChao = perguntasDoServico("recolha_entulho").filter((x) => x.ecra === "oque" && perguntaAparece(x, { entulho: "chao" }));
    expect(noChao.map((x) => x.id)).toEqual(["entulho", "entulhoVolume"]);
  });

  it("o esvaziamento de casa e de apartamento pergunta a tipologia da grelha publicada, com o IVA ao lado", () => {
    const casa = perguntasDoServico("esvaziamento_casa")[0];
    expect(casa.opcoes!.map((o) => o.id)).toEqual(ESVAZIAMENTO_POR_TIPOLOGIA.map((t) => t.chave));
    expect(casa.opcoes!.map((o) => o.nome)).toEqual(ESVAZIAMENTO_POR_TIPOLOGIA.map((t) => t.tipo));
    const apartamento = perguntasDoServico("esvaziamento_apartamento")[0];
    expect(apartamento.opcoes!.map((o) => o.id)).toEqual(["T0/T1", "T2", "T3/T4"]);
    for (const o of [...casa.opcoes!, ...apartamento.opcoes!]) expect(o.ajuda, o.id).toMatch(/\+ IVA \(.+ com IVA\)$/);
    expect(casa.opcoes![1].ajuda).toBe("320 – 420 € + IVA (393,60 – 516,60 € com IVA)");
    expect(perguntasDoServico("esvaziamento_casa")[1].opcoes!.map((o) => o.id)).toEqual(["pouco", "mobilada", "muito"]);
  });

  it("a manutenção: o tipo de trabalho, quanto e os materiais (e a repetição de sempre)", () => {
    const p = Object.fromEntries(perguntasDoServico("manutencao_casa").map((x) => [x.id, x]));
    expect(p.tipoDeTrabalho.opcoes!.map((o) => o.id)).toEqual(["canalizacao", "electricidade", "pintura", "carpintaria", "pequenas_reparacoes", "remodelacao", "outro"]);
    expect(p.quantoTrabalho.opcoes!.map((o) => o.id)).toEqual(["uma_pequena", "varias_pequenas", "uma_divisao", "remodelacao"]);
    expect(p.materiais.opcoes!.map((o) => o.id)).toEqual(["tenho", "parceiro", "nao_sei"]);
    expect(p.repeticao.opcoes!.map((o) => o.id)).toEqual(["pontual", "semanal", "quinzenal"]);
    // Montagem de móveis e jardinagem estão fora.
    expect(JSON.stringify(perguntasDoServico("manutencao_casa"))).not.toMatch(/montagem|jardin/i);
  });

  it("o acesso: os ids de sempre; a garagem e a cave sem o andar; a mudança em cada ponta", () => {
    const acesso = Object.fromEntries(perguntasDoServico("recolha_monos").filter((x) => x.ecra === "acesso").map((x) => [x.id, x]));
    expect(acesso.floor.opcoes!.map((o) => o.id)).toEqual(["rés-do-chão", "1º", "2º", "3º", "4º+"]);
    expect(acesso.hasElevator.opcoes!.map((o) => o.id)).toEqual(["yes", "small", "no", "unknown"]);
    expect(acesso.hasElevator.quando).toEqual({ floor: ["1º", "2º", "3º", "4º+"] });
    expect(acesso.parkingDistance.opcoes!.map((o) => o.id)).toEqual(["door", "under_20m", "over_30m", "difficult"]);
    expect(perguntasDoServico("mudanca").find((x) => x.id === "destino.hasElevator")!.quando).toEqual({ "destino.floor": ["1º", "2º", "3º", "4º+"] });
  });

  it("nenhum texto das perguntas fala como empresa que faz o trabalho, nem chama «profissional» ao parceiro", () => {
    const tudo = JSON.stringify(SERVICOS_PUBLICOS.map((s) => perguntasDoServico(s.id)));
    expect(tudo).not.toMatch(/profissional|\bvocê\b|levamos|nossa equipa|próprio dia/i);
    // Preços só com o IVA ao lado.
    for (const t of tudo.match(/[^"]*€[^"]*/g) ?? []) expect(t).toContain("com IVA");
  });
});

describe("d1 — a R7 serve as perguntas em cada serviço", () => {
  it("cada serviço do catálogo leva `perguntas`, e os campos antigos ficam", async () => {
    const r = await catalogo(new NextRequest("https://clyon.pt/api/cliente/catalogo"));
    const j = await r.json();
    for (const s of j.servicos) {
      expect(s.perguntas, s.id).toEqual(viaJson(perguntasDoServico(s.id)));
      for (const campo of ["id", "nome", "detalhes", "inclui", "precoReferencia"]) expect(s, `${s.id}.${campo}`).toHaveProperty(campo);
    }
    expect(j.entulho.map((o: { id: string }) => o.id)).toEqual(["ensacado", "chao", "misto", "unknown"]);
    expect(j.servicos.find((s: { id: string }) => s.id === "esvaziamento_garagem").espaco).toBeTruthy();
  });
});

describe("d1 — a referência do entulho pela quantidade (a calculadora da página)", () => {
  const entulho = (extra: Record<string, unknown>) => daR12({ servico: "recolha_entulho", ...extra });

  // d4 (03-11-2026): os sacos um a um, a 4,00–4,80 € + IVA; até 10, o mínimo de 10.
  it("5 e 10 sacos: 40 – 48 € + IVA", () => {
    for (const n of [5, 10]) {
      const r = entulho({ entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: n });
      expect(especifica(r)).toBe("40 – 48 € + IVA (49,20 – 59,04 € com IVA).");
      expect(r.conta).toEqual({ servico: "40 – 48 €", iva: "9,20 – 11,04 €", ivaRotulo: "IVA (23 %)", total: "49,20 – 59,04 €" });
    }
    expect(entulho({ entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 5 }).porque).toEqual(["5 sacos: conta o mínimo de 10 sacos × 4,00–4,80 € = 40–48 € + IVA"]);
    expect(entulho({ entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 10 }).porque).toEqual(["10 sacos × 4,00–4,80 € = 40–48 € + IVA"]);
  });

  it("50 sacos: 200 – 240 € + IVA, e só a estimativa (sem a linha geral)", () => {
    const r = entulho({ entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50 });
    expect(r.linhas.map(linhaEscrita)).toEqual(["Estimativa: 200 – 240 € + IVA (246 – 295,20 € com IVA)."]);
    expect(r.conta).toEqual({ servico: "200 – 240 €", iva: "46 – 55,20 €", ivaRotulo: "IVA (23 %)", total: "246 – 295,20 €" });
    expect(r.porque).toEqual(["50 sacos × 4,00–4,80 € = 200–240 € + IVA"]);
  });

  it("2 big bags = 76 sacos", () => {
    const r = entulho({ entulho: "ensacado", tipoDeSaco: "bigbag", quantidade: 2 });
    expect(2 * SACOS_POR_BIG_BAG).toBe(76);
    expect(especifica(r)).toBe("304 – 364,80 € + IVA (373,92 – 448,70 € com IVA).");
    expect(r.porque).toEqual(["2 big bags = 76 sacos × 4,00–4,80 € = 304–364,80 € + IVA"]);
  });

  it("2 m³ a granel cabem em «Até 3 m³»: a linha da grelha, desde 432 €; e o tempo de carga entra na proposta", () => {
    const r = entulho({ entulho: "chao", entulhoVolume: "ate3" });
    expect(especifica(r)).toBe("desde 432 € + IVA (531,36 € com IVA).");
    expect(r.porque).toEqual(["Até 3 m³ a granel: a linha da grelha do entulho solto.", "No chão, a granel: o tempo de carga entra na proposta."]);
  });

  it("6 m³ («Mais de 5 m³»): proposta com fotografias, sem número", () => {
    const r = entulho({ entulho: "chao", entulhoVolume: "mais" });
    expect(especifica(r)).toBe("Proposta com fotografias.");
    expect(r.conta).toBeNull();
    expect(r.porque[0]).toBe("Mais de 5 m³: o parceiro faz a proposta a partir das fotografias.");
    // E 240 sacos (6 m³) contados em sacos dão o mesmo.
    expect(especifica(entulho({ entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 240 }))).toBe("Proposta com fotografias.");
  });

  it("parte e parte: os sacos cheios e os por ensacar somam-se, um a um", () => {
    const r = entulho({ entulho: "misto", ensacados: 30, porEnsacar: 20 });
    expect(especifica(r)).toBe("200 – 240 € + IVA (246 – 295,20 € com IVA).");
    expect(r.porque).toEqual([
      "30 sacos cheios e cerca de 20 por ensacar = 50 sacos × 4,00–4,80 € = 200–240 € + IVA",
      "O que está por ensacar: o tempo de carga entra na proposta.",
    ]);
  });

  it("sem a quantidade, não há estimativa e diz-se porquê", () => {
    const r = entulho({ entulho: "unknown" });
    expect(r.linhas).toEqual([]);
    expect(r.conta).toBeNull();
    expect(r.porque).toEqual(["Sem a quantidade, a proposta sai das fotografias."]);
  });
});

describe("d1 — o acesso leva a referência ao topo da faixa, e diz porquê", () => {
  it("3.º andar sem elevador: o topo da faixa dos monos; os móveis por volume entram na proposta (d6)", () => {
    const r = daR12({ servico: "recolha_monos", volume: "carrinha", floor: "3º", hasElevator: "no", parkingDistance: "door" });
    expect(especifica(r)).toBe("100 € + IVA (123 € com IVA), o topo da faixa (30 – 100 € + IVA (36,90 – 123 € com IVA)), pelo acesso difícil.");
    expect(r.conta?.total).toBe("123 €");
    expect(r.porque).toEqual(["3.º andar sem elevador: o topo da faixa."]);
    const moveis = daR12({ servico: "recolha_moveis", movelModo: "carga", volume: "carrinha", floor: "3º", hasElevator: "no", parkingDistance: "door" });
    expect(especifica(moveis)).toBe("Proposta com fotografias.");
    expect(moveis.porque).toEqual([
      "Por volume, o parceiro faz a proposta a partir das fotografias. Por peça: pequena 15 €, média 30 €, grande 50 € + IVA.",
      "3.º andar sem elevador: o parceiro tem-no em conta na proposta.",
    ]);
  });

  it("«não sei» se há elevador, e o estacionamento longe, também", () => {
    const r = daR12({ servico: "recolha_monos", floor: "2º", hasElevator: "unknown", parkingDistance: "over_30m" });
    expect(especifica(r)).toContain("100 € + IVA (123 € com IVA), o topo da faixa");
    expect(r.porque).toEqual(["2.º andar, sem saber se há elevador: o topo da faixa.", "Estacionamento a mais de 30 metros: o topo da faixa."]);
    expect(razoesDoAcessoDificil(lerAcesso({ floor: "4º+", hasElevator: "no" }))).toEqual(["4.º andar ou acima sem elevador"]);
  });

  it("o acesso normal (elevador, à porta, rés-do-chão) não mexe", () => {
    for (const a of [{ floor: "3º", hasElevator: "yes" }, { floor: "3º", hasElevator: "small" }, { floor: "rés-do-chão" }, { parkingDistance: "under_20m" }]) {
      const r = daR12({ servico: "recolha_monos", ...a });
      expect(r.linhas, JSON.stringify(a)).toHaveLength(1);
      expect(r.porque).toEqual([]);
    }
  });

  it("onde é «desde» e não há regra publicada, o acesso não inventa um número: entra na proposta", () => {
    const r = daR12({ servico: "esvaziamento_casa", floor: "3º", hasElevator: "no" });
    // Sem a tipologia não há estimativa (d6: a linha geral saiu).
    expect(r.linhas).toHaveLength(0);
    expect(r.porque).toEqual(["3.º andar sem elevador: o parceiro tem-no em conta na proposta."]);
  });

  it("na mudança a tabela já conta os andares: o acesso não se conta duas vezes", () => {
    const pedido = { servico: "mudanca", tipologia: "T2", origem: { floor: "3º", hasElevator: "no" }, destino: { floor: "rés-do-chão" }, floor: "3º", hasElevator: "no", parkingDistance: "difficult" };
    const r = daR12(pedido);
    expect(r.linhas.map((l) => l.rotulo)).toEqual(["Estimativa"]);
    expect(r.porque).toEqual(["T2: cerca de 4 h da equipa de 3.", "3 andares a pé, sem elevador: a tabela conta cada um."]);
  });

  it("garagem, sótão e cave: o topo como antes, agora com o porquê", () => {
    const r = daR12({ servico: "esvaziamento_sotao", volume: "camiao_lixo", acessoDoEspaco: "alcapao", estacionamento: "door" });
    expect(especifica(r)).toBe("480 € + IVA (590,40 € com IVA), o topo da faixa (360 – 480 € + IVA (442,80 – 590,40 € com IVA)), pelo acesso difícil.");
    expect(r.porque).toEqual(["Alçapão com escada de abrir: o topo da faixa."]);
  });
});

describe("d4 — os andares no entulho, por trabalho: +5 € com elevador, +15 € sem", () => {
  const entulho = (extra: Record<string, unknown>) => daR12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", ...extra });

  it("o exemplo do dono, e 40 sacos (1 m³) num 3.º sem elevador, em sacos e a granel", () => {
    expect([RECOLHA_POR_ANDAR_COM_ELEVADOR, RECOLHA_POR_ANDAR_SEM_ELEVADOR]).toEqual([5, 15]);
    const dono = entulho({ quantidade: 50, floor: "2º", hasElevator: "small", parkingDistance: "under_20m" });
    expect(especifica(dono)).toBe("210 – 250 € + IVA (258,30 – 307,50 € com IVA).");
    expect(dono.porque).toEqual(["50 sacos × 4,00–4,80 € = 200–240 € + IVA", "2.º andar com elevador: +10 € + IVA"]);
    const sacos = entulho({ quantidade: 40, floor: "3º", hasElevator: "no" });
    expect(especifica(sacos)).toBe("205 – 237 € + IVA (252,15 – 291,51 € com IVA).");
    expect(sacos.porque).toEqual(["40 sacos × 4,00–4,80 € = 160–192 € + IVA", "3.º andar sem elevador: +45 € + IVA"]);
    // A granel continua pela grelha por m³: desde 120 + 45.
    const granel = daR12({ servico: "recolha_entulho", entulho: "chao", entulhoVolume: "ate1", floor: "3º", hasElevator: "no" });
    expect(especifica(granel)).toBe("desde 165 € + IVA (202,95 € com IVA).");
    expect(granel.conta?.servico).toBe("desde 165 €");
  });

  it("o estacionamento a mais de 30 m ou difícil conta como um andar sem elevador; os andares somam-se", () => {
    const longe = entulho({ quantidade: 50, parkingDistance: "difficult" });
    expect(especifica(longe)).toBe("215 – 255 € + IVA (264,45 – 313,65 € com IVA).");
    expect(longe.porque).toContain("Estacionamento difícil, como mais um andar sem elevador: +15 € + IVA");
    expect(suplementoDosAndares({ floor: "3º", hasElevator: "no", parkingDistance: "over_30m" })).toMatchObject({ andaresAPe: 3, estacionamentoLonge: true, valor: 60 });
    expect(suplementoDosAndares({ floor: "4º+", hasElevator: "yes" })).toMatchObject({ andaresComElevador: 4, valor: 20 });
  });

  it("no rés-do-chão nada; com «não sei» não se soma, e o parceiro confirma", () => {
    expect(suplementoDosAndares({ floor: "rés-do-chão" }).valor).toBe(0);
    expect(suplementoDosAndares({ floor: "rés-do-chão", hasElevator: "no" }).valor).toBe(0);
    const naoSei = entulho({ quantidade: 50, floor: "3º", hasElevator: "unknown" });
    expect(especifica(naoSei)).toBe("200 – 240 € + IVA (246 – 295,20 € com IVA).");
    expect(naoSei.porque).toContain("3.º andar, sem saber se há elevador: o parceiro confirma na proposta.");
  });

  it("sem número (mais de 5 m³), proposta, sem andares inventados; sem quantidade, os andares ficam ditos", () => {
    const grande = daR12({ servico: "recolha_entulho", entulho: "chao", entulhoVolume: "mais", floor: "3º", hasElevator: "no" });
    expect(especifica(grande)).toBe("Proposta com fotografias.");
    expect(grande.porque.join(" ")).not.toContain("+45");
    const semQuantidade = daR12({ servico: "recolha_entulho", entulho: "ensacado", floor: "3º", hasElevator: "no" });
    expect(semQuantidade.linhas).toEqual([]);
    expect(semQuantidade.porque).toContain("3.º andar sem elevador: +45 € + IVA");
  });

  it("uma só língua: o motor e o texto ao modelo somam o mesmo, e o estacionamento difícil não paga duas vezes", async () => {
    expect(entulhoPelaGrelha("40", { floor: "3º", hasElevator: "no" })).toMatchObject({ semIva: 237, minimo: 205, maximo: 237 });
    expect(entulhoPelaGrelha("50", { floor: "2º", hasElevator: "small" })).toMatchObject({ minimo: 210, maximo: 250 });
    expect(entulhoPelaGrelha("10", { floor: "2º", hasElevator: "no" })).toMatchObject({ minimo: 70, maximo: 78 });
    expect(entulhoPelaGrelha("4m3", { floor: "rés-do-chão" })).toMatchObject({ minimo: 576 });
    const e = await calculateFastEstimate({
      serviceType: "recolha_entulho",
      entulhoState: "ensacado",
      entulhoQuantidade: "40",
      floor: "3º",
      hasElevator: "no",
      parkingDistance: "difficult",
      distanceFromBase: { distanceKm: 15 },
    });
    // 160–192 + 15 × (3 andares + o estacionamento) = 220–252, sem a taxa fixa dos 15 €.
    expect([e.estimateMinWithoutVat, e.estimateMaxWithoutVat]).toEqual([220, 252]);
    expect(e.assumptions.join(" ")).not.toContain("Estacionamento difícil (taxa fixa)");
    expect(GRELHA_DO_ENTULHO_PARA_O_MODELO).toContain("Andares, por trabalho (não por m³): +5 € s/IVA por andar com elevador (também o pequeno), +15 € s/IVA por andar sem elevador");
    expect(GRELHA_DO_ENTULHO_PARA_O_MODELO).toContain("50 sacos num 2.º andar com elevador pequeno, estacionamento até 20 m → 200–240 + 10 = 210–250 € s/IVA");
    expect(GRELHA_DO_ENTULHO_PARA_O_MODELO).toContain("Sacos pequenos (de 25 a 30 kg): 4,00 a 4,80 € s/IVA por saco");
    // As páginas do entulho dizem a mesma regra, pela mesma frase.
    expect(ANDARES_DO_ENTULHO_EM_FRASE).toBe(
      "Cada andar soma 5 € + IVA (6,15 € com IVA) com elevador e 15 € + IVA (18,45 € com IVA) sem elevador, por trabalho; o estacionamento a mais de 30 metros ou difícil conta como mais um andar sem elevador, e no rés-do-chão não há.",
    );
    expect(ler("src/app/recolha-de-entulho/CalculadoraDeEntulho.tsx")).toContain("{ANDARES_DO_ENTULHO_EM_FRASE}");
    expect(ler("src/app/precos/recolha-de-entulho/page.tsx")).toContain("ANDARES_DO_ENTULHO_EM_FRASE,");
  }, 60_000);
});

describe("d1 — o esvaziamento pela tipologia, e a manutenção", () => {
  it("um T2: a linha da grelha; pouca coisa, o início; muito cheia, o topo", () => {
    expect(especifica(daR12({ servico: "esvaziamento_apartamento", tipologia: "T2" }))).toBe("320 – 420 € + IVA (393,60 – 516,60 € com IVA).");
    const pouco = daR12({ servico: "esvaziamento_apartamento", tipologia: "T2", recheio: "pouco" });
    expect(especifica(pouco)).toBe("desde 320 € + IVA (393,60 € com IVA), o início da faixa (320 – 420 € + IVA (393,60 – 516,60 € com IVA)), por haver pouca coisa.");
    expect(pouco.porque).toEqual(["Apartamento T2: a linha da grelha do esvaziamento.", "Pouca coisa: o início da faixa."]);
    const muito = daR12({ servico: "esvaziamento_casa", tipologia: "T2", recheio: "muito" });
    expect(especifica(muito)).toBe("420 € + IVA (516,60 € com IVA), o topo da faixa (320 – 420 € + IVA (393,60 – 516,60 € com IVA)), por estar muito cheia.");
    const moradia = daR12({ servico: "esvaziamento_casa", tipologia: "moradia" });
    expect(especifica(moradia)).toBe("desde 450 € + IVA (553,50 € com IVA).");
    // A moradia não é apartamento: sem a tipologia certa, não há estimativa (d6).
    expect(daR12({ servico: "esvaziamento_apartamento", tipologia: "moradia" }).linhas).toHaveLength(0);
  });

  it("a manutenção pela grelha por tipo (v2): a faixa, a nota dos materiais, e o acesso não mexe", () => {
    const r = daR12({ servico: "manutencao_casa", tipoDeTrabalho: "canalizacao", quantoTrabalho: "varias_pequenas", materiais: "parceiro", repeticao: "pontual", floor: "4º+", hasElevator: "no" });
    expect(r.linhas.map(linhaEscrita)).toEqual(["Estimativa: 130 – 200 € + IVA (159,90 – 246 € com IVA)."]);
    expect(r.conta).toEqual({ servico: "130 – 200 €", iva: "29,90 – 46 €", ivaRotulo: "IVA (23 %)", total: "159,90 – 246 €" });
    expect(r.porque).toEqual([
      "Canalização, várias reparações pequenas: a linha da grelha da manutenção.",
      "A faixa é só mão de obra; as peças vão à parte, pelo talão.",
    ]);
    // A pintura inclui a tinta (e os materiais dele não mudam o número: não há multiplicador).
    const pintura = daR12({ servico: "manutencao_casa", tipoDeTrabalho: "pintura", quantoTrabalho: "uma_divisao", materiais: "tenho" });
    expect(especifica(pintura)).toBe("230 – 350 € + IVA (282,90 – 430,50 € com IVA).");
    expect(pintura.porque).toContain("A faixa inclui a tinta; com material seu, o parceiro ajusta na proposta.");
    expect(especifica(daR12({ servico: "manutencao_casa", tipoDeTrabalho: "pintura", quantoTrabalho: "uma_divisao", materiais: "parceiro" }))).toBe(especifica(pintura));
    // «Conta como»: as pequenas reparações numa remodelação, e a remodelação pequena.
    const remodelar = daR12({ servico: "manutencao_casa", tipoDeTrabalho: "pequenas_reparacoes", quantoTrabalho: "remodelacao" });
    expect(especifica(remodelar)).toBe("desde 2 000 € + IVA (2 460 € com IVA) por divisão.");
    expect(remodelar.conta).toBeNull(); // o «por divisão» não cabe em três linhas
    expect(remodelar.porque).toContain("O valor inclui os materiais; com material seu, o parceiro ajusta na proposta.");
    expect(especifica(daR12({ servico: "manutencao_casa", tipoDeTrabalho: "remodelacao", quantoTrabalho: "uma_pequena" }))).toBe("57 – 75 € + IVA (70,11 – 92,25 € com IVA).");
    // Sem fontes, proposta com fotografias; «Outro trabalho» fica no «desde 57 €».
    expect(especifica(daR12({ servico: "manutencao_casa", tipoDeTrabalho: "electricidade", quantoTrabalho: "uma_divisao" }))).toBe("Proposta com fotografias.");
    const outro = daR12({ servico: "manutencao_casa", tipoDeTrabalho: "outro", quantoTrabalho: "uma_divisao" });
    expect(outro.linhas.map(linhaEscrita)).toEqual(["Estimativa: desde 57 € + IVA (70,11 € com IVA)."]);
    // Sem as duas respostas, só o «desde» do serviço.
    expect(grelhaDaManutencao({ tipoDeTrabalho: "pintura", quantoTrabalho: null, materiais: null, repeticao: null })).toBeNull();
    expect(daR12({ servico: "manutencao_casa", tipoDeTrabalho: "pintura" }).linhas).toHaveLength(0);
  });

  it("a grelha da manutenção é a aprovada, célula a célula, e os ids são os das perguntas", () => {
    const escrita = (t: string, q: string) => {
      const c = celulaDaManutencao(t, q)!.celula;
      return c.tipo === "faixa" ? `${c.de}–${c.ate}` : c.tipo === "desde" ? `desde ${c.de}${c.porDivisao ? "/divisão" : ""}` : "proposta";
    };
    const Q = ["uma_pequena", "varias_pequenas", "uma_divisao", "remodelacao"];
    expect(Object.fromEntries(Object.keys(MANUTENCAO_POR_TIPO).map((t) => [t, Q.map((q) => escrita(t, q)).join(" | ")]))).toEqual({
      canalizacao: "57–100 | 130–200 | 250–550 | proposta",
      electricidade: "57–75 | 110–160 | proposta | proposta",
      pintura: "80–130 | 160–240 | 230–350 | proposta",
      carpintaria: "57–90 | 120–180 | proposta | proposta",
      pequenas_reparacoes: "57–75 | 90–140 | proposta | desde 2000/divisão",
      remodelacao: "57–75 | 90–140 | proposta | desde 2000/divisão",
      outro: "desde 57 | desde 57 | desde 57 | desde 57",
    });
    expect(Object.keys(MANUTENCAO_POR_TIPO)).toEqual(TIPOS_DE_TRABALHO.map((t) => t.id));
    for (const t of Object.keys(MANUTENCAO_POR_TIPO)) expect(Object.keys(MANUTENCAO_POR_TIPO[t]), t).toEqual(QUANTO_TRABALHO.map((q) => q.id));
    // O «desde 57 €» publicado é o mínimo da grelha.
    expect(PRECOS.manutencao_casa).toEqual({ etiqueta: "desde 57 €", minimo: 57 });
    const numeros = Object.values(MANUTENCAO_POR_TIPO).flatMap((l) => Object.values(l)).flatMap((c) => (c.tipo === "faixa" ? [c.de, c.ate] : c.tipo === "desde" ? [c.de] : []));
    expect(Math.min(...numeros)).toBe(PRECOS.manutencao_casa.minimo);
    // O modelo lê a mesma grelha (pricing-helper e o orçamento do simulador).
    expect(GRELHA_DA_MANUTENCAO_PARA_O_MODELO).toContain("Canalização: uma reparação pequena 57–100 € | várias reparações pequenas 130–200 € | uma divisão inteira 250–550 €");
    expect(GRELHA_DA_MANUTENCAO_PARA_O_MODELO).toContain("Sem multiplicador de materiais.");
    expect(ler("src/lib/pricing-helper.ts").match(/\$\{GRELHA_DA_MANUTENCAO_PARA_O_MODELO\}/g)).toHaveLength(2);
    expect(ler("src/lib/prompt-do-orcamento.ts")).toContain("${GRELHA_DA_MANUTENCAO_PARA_O_MODELO}");
  });
});

describe("d1 — as regras que não se quebram", () => {
  const CASOS: Record<string, unknown>[] = [
    { servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "bigbag", quantidade: 3, floor: "1º", hasElevator: "no", localidade: "Évora" },
    { servico: "recolha_entulho", entulho: "misto", ensacados: 4, porEnsacar: 3, parkingDistance: "over_30m" },
    { servico: "recolha_moveis", movelModo: "item", itens: { pequeno: 1, grande: 2 }, floor: "2º", hasElevator: "unknown" },
    { servico: "esvaziamento_casa", tipologia: "T3/T4", recheio: "muito", floor: "3º", hasElevator: "no" },
    { servico: "mudanca", tipologia: "T3", desmontagem: "sim", kmPercurso: 120, origem: { floor: "2º", hasElevator: "no" } },
    { servico: "manutencao_casa", tipoDeTrabalho: "remodelacao", quantoTrabalho: "remodelacao", materiais: "tenho", repeticao: "semanal" },
    { servico: "outro", floor: "3º", hasElevator: "no", localidade: "Almada" },
  ];

  it("cada euro leva o IVA: nas linhas o com IVA ao lado; no porquê, a conta acaba em «+ IVA» (d4, d6)", () => {
    for (const c of CASOS) {
      const r = daR12(c);
      for (const t of r.linhas.map((l) => l.texto)) if (t.includes("€")) expect(t, JSON.stringify(c)).toMatch(/\+ IVA \([^)]*com IVA\)/);
      for (const t of r.porque) if (t.includes("€")) expect(t, JSON.stringify(c)).toMatch(/€ \+ IVA(\.|$| \([^)]*com IVA\))/);
    }
  });

  it("a localidade: só se diz que fora das zonas a proposta depende da zona — sem suplemento", () => {
    expect(localidadeServida("Almada")).toBe(true);
    expect(localidadeServida("Fernão Ferro")).toBe(true);
    expect(localidadeServida("Alcochete")).toBe(true);
    expect(localidadeServida("Évora")).toBe(false);
    expect(localidadeServida("")).toBeNull();
    const fora = daR12({ servico: "recolha_monos", localidade: "Évora" });
    expect(fora.porque).toEqual(["Évora: a proposta depende da zona (os parceiros trabalham em Lisboa, Margem Sul e Setúbal)."]);
    expect(fora.linhas).toEqual(daR12({ servico: "recolha_monos" }).linhas);
    expect(daR12({ servico: "recolha_monos", localidade: "Seixal" }).porque).toEqual([]);
  });

  it("o ajuste aprendido é neutro hoje, e só pode mexer dentro da faixa publicada", () => {
    expect(ajusteAprendido("recolha_moveis", { servico: "recolha_moveis" })).toBe(SEM_AJUSTE);
    expect(SEM_AJUSTE).toEqual({ fator: 1, porque: null });
    expect(dentroDaFaixa(40, 120, 1)).toEqual({ de: 40, ate: 120 });
    expect(dentroDaFaixa(40, 120, 1.5)).toEqual({ de: 60, ate: 120 });
    expect(dentroDaFaixa(40, 120, 0.5)).toEqual({ de: 40, ate: 60 });
    expect(dentroDaFaixa(40, 50, 9)).toEqual({ de: 50, ate: 50 });
    // A conta passa pelo ponto único.
    expect(ler("src/lib/preco-de-referencia.ts")).toMatch(/const ajuste = ajusteAprendido\(p\.servico, p\);/);
  });

  it("o motor (/api/simulator/analyze) continua fora da referência", () => {
    const fontes = ["src/lib/preco-de-referencia.ts", "src/lib/respostas-do-simulador.ts", "src/lib/simulador-por-categoria.ts", "src/app/api/cliente/referencia/route.ts"];
    for (const f of fontes) expect(ler(f), f).not.toMatch(/from\s+"[^"]*(pricing-helper|simulator\/analyze)/);
  });
});

describe("d1 — o corpo antigo da R12 e a R12 nova", () => {
  it("a app de hoje (entulho: { estado, modo, sacos }) passa a ver a referência mudar", async () => {
    const j = await chamar({ servico: "recolha_entulho", entulho: { estado: "ensacado", modo: "sacos", sacos: 50 }, desmontagem: false });
    expect(j.ok).toBe(true);
    expect(j.linhas.map(linhaEscrita)).toEqual(["Estimativa: 200 – 240 € + IVA (246 – 295,20 € com IVA)."]);
    expect(j.conta.total).toBe("246 – 295,20 €");
    expect(j.porque).toEqual(["50 sacos × 4,00–4,80 € = 200–240 € + IVA"]);
    // A carga antiga no chão é entulho solto: a granel, pela grelha por m³ (d4).
    const carga = await chamar({ servico: "recolha_entulho", entulho: { estado: "chao", modo: "volume", volume: "camiao_caixa" } });
    expect(SACOS_POR_CARGA.camiao_caixa).toBe(120);
    expect(carga.porque[0]).toBe("Enche a caixa de um camião, a granel ≈ 3 m³: a linha da grelha do entulho solto.");
    // Sem nada do entulho, não há estimativa.
    const nada = await chamar({ servico: "recolha_entulho", entulho: { estado: undefined, modo: undefined } });
    expect(nada.linhas).toHaveLength(0);
    expect(nada.conta).toBeNull();
  });

  it("os casos do dono pela rota: entulho de 50 sacos e manutenção", async () => {
    const e = await chamar({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50 });
    expect(e).toEqual({ ok: true, ...daR12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50 }) });
    const m = await chamar({ servico: "manutencao_casa", tipoDeTrabalho: "pintura", quantoTrabalho: "uma_divisao", materiais: "nao_sei" });
    expect(m.linhas.map(linhaEscrita)).toEqual(["Estimativa: 230 – 350 € + IVA (282,90 – 430,50 € com IVA)."]);
    expect(Object.keys(m).sort()).toEqual(["conta", "linhas", "nota", "ok", "porque"]);
  });

  it("valores estragados não partem nada", () => {
    const r = daR12({ servico: "recolha_entulho", entulho: "<x>", tipoDeSaco: "contentor", quantidade: -4, entulhoVolume: "ate99", floor: { x: 1 } });
    expect(r.linhas).toHaveLength(0);
    expect(lerEntulho({ quantidade: "50 sacos", tipoDeSaco: "pequeno" })?.medida).toEqual({ tipo: "sacos", sacos: 50 });
  });
});

describe("d1 — o site mostra a mesma conta (a orquestra)", () => {
  it("para o mesmo pedido, o simulador do site e a R12 nova dão as mesmas linhas e o mesmo porquê", () => {
    const pares: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [
        { serviceType: "recolha_entulho", entulhoState: "ensacado", entulhoQuantidade: "50", floor: "3º", hasElevator: "no", parkingDistance: "door" },
        { servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50, floor: "3º", hasElevator: "no", parkingDistance: "door" },
      ],
      [
        { serviceType: "recolha_entulho", entulhoState: "misto", entulhoQuantidadeEnsacados: "30", entulhoQuantidadePorEnsacar: "20", entulhoQuantidade: "50" },
        { servico: "recolha_entulho", entulho: "misto", ensacados: 30, porEnsacar: 20 },
      ],
      [
        { serviceType: "recolha_monos", floor: "2º", hasElevator: "unknown", parkingDistance: "over_30m", address: { city: "Évora" } },
        { servico: "recolha_monos", floor: "2º", hasElevator: "unknown", parkingDistance: "over_30m", localidade: "Évora" },
      ],
      [
        { serviceType: "esvaziamento_garagem", volumeTier: "carrinha", acessoDoEspaco: "parque_com_horario", floor: "rés-do-chão", parkingDistance: "door" },
        { servico: "esvaziamento_garagem", volume: "carrinha", acessoDoEspaco: "parque_com_horario", parkingDistance: "door" },
      ],
    ];
    for (const [site, app] of pares) {
      expect(referenciaDoSimuladorDoSite(site as never), JSON.stringify(site)).toEqual(daR12(app));
    }
  });

  it("o simulador do site lê a referência pelo formulário inteiro, nas duas fases", () => {
    const SIM = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(SIM.match(/<PrecoDeReferencia servico=\{formData\.serviceType\} formulario=\{formData\} \/>/g)).toHaveLength(2);
    expect(SIM).toContain("String(SACOS_POR_CARGA[vol]");
    expect(SIM).not.toMatch(/carrinha: 40, camiao_caixa: 120/);
    expect(ler("src/app/simulador/components/PrecoDeReferencia.tsx")).toContain("referenciaDoSimuladorDoSite(");
  });
});

describe("d1 — o pedido guarda os campos novos", () => {
  const base = { receiver: { name: "Teste", phone: "912345678" }, description: "Restos de obra" };

  it("big bags e m³ viram sacos pelas regras da casa, e quem faz o trabalho vê como ele o disse", () => {
    const bb = { ...base, serviceType: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "bigbag", quantidade: 2 };
    expect(camposDaCategoriaParaGravar(bb)).toEqual({
      entulhoState: "ensacado",
      entulhoQuantidade: "76",
      entulhoQuantidadeDita: "2 big bags",
      entulhoQuantidadeBigBags: "2",
    });
    expect(comAsLinhasDaCategoria(bb.description, bb)).toBe("Quantidade de entulho: 2 big bags (≈ 76 sacos de 25 a 30 kg).\nRestos de obra");
    const granel = { ...base, serviceType: "recolha_entulho", entulho: "chao", entulhoVolume: "ate3" };
    expect(camposDaCategoriaParaGravar(granel)).toEqual({ entulhoState: "chao", entulhoQuantidade: "120", entulhoQuantidadeDita: "até 3 m³, a granel" });
    expect(comAsLinhasDaCategoria("", granel)).toBe("Quantidade de entulho: no chão, a granel, até 3 m³ (≈ 120 sacos).");
    const acima = { ...base, serviceType: "recolha_entulho", entulho: "chao", entulhoVolume: "mais" };
    expect(camposDaCategoriaParaGravar(acima)).toEqual({ entulhoState: "chao", entulhoQuantidadeDita: "mais de 5 m³, a granel" });
    const misto = { ...base, serviceType: "recolha_entulho", entulho: "misto", ensacados: 30, porEnsacar: 20 };
    expect(camposDaCategoriaParaGravar(misto)).toEqual({
      entulhoState: "misto",
      entulhoQuantidade: "50",
      entulhoQuantidadeEnsacados: "30",
      entulhoQuantidadePorEnsacar: "20",
    });
  });

  it("o pedido de sempre (o simulador do site, a app de hoje) fica como vinha", () => {
    const doSite = { ...base, serviceType: "recolha_entulho", entulhoState: "chao", entulhoQuantidade: "40", entulhoVolume: "carrinha", needsDismantling: "no" };
    expect(camposDaCategoriaParaGravar(doSite)).toEqual({});
    expect(comAsLinhasDaCategoria(doSite.description, doSite)).toBe("Restos de obra");
    // A app de hoje, por volume, mandava a carga sem número: passa a ter os sacos da mesma regra do site.
    const daApp = { ...base, serviceType: "recolha_entulho", entulhoState: "chao", entulhoVolume: "camiao_caixa" };
    expect(camposDaCategoriaParaGravar(daApp)).toEqual({ entulhoQuantidade: "120", entulhoQuantidadeDita: "enche a caixa de um camião" });
    expect(comAsLinhasDaCategoria(daApp.description, daApp)).toBe("Restos de obra");
  });

  it("a tipologia do esvaziamento, a manutenção, a desmontagem e a repetição", () => {
    const esv = { ...base, serviceType: "esvaziamento_apartamento", tipologia: "T2", recheio: "muito", desmontagem: true };
    expect(camposDaCategoriaParaGravar(esv)).toEqual({ needsDismantling: "simple" });
    expect(comAsLinhasDaCategoria(esv.description, esv)).toBe("Tipologia: Apartamento T2.\nRecheio: muito cheia (arrecadações, coisas acumuladas).\nRestos de obra");
    const man = { ...base, serviceType: "manutencao_casa", tipoDeTrabalho: "pintura", quantoTrabalho: "uma_divisao", materiais: "tenho", repeticao: "quinzenal" };
    expect(camposDaCategoriaParaGravar(man)).toEqual({ recurrenceFrequency: "quinzenal" });
    const comLinhas = comAsLinhasDaCategoria(man.description, man);
    expect(comLinhas).toBe("Trabalho: Pintura, uma divisão inteira.\nMateriais: o cliente já tem os materiais.\nRestos de obra");
    // Não se repete uma linha que a app já tenha escrito.
    expect(comAsLinhasDaCategoria(comLinhas, man)).toBe(comLinhas);
    // A Mesa mostra-os como campos.
    expect(camposExtraDoPedido(man).map((c) => `${c.rotulo}: ${c.valor}`)).toEqual(
      expect.arrayContaining(["Tipo de trabalho: Pintura", "Quanto trabalho: Uma divisão inteira", "Materiais: Já tenho os materiais"]),
    );
    expect(camposExtraDoPedido({ serviceType: "recolha_entulho", entulhoQuantidadeBigBags: "2", entulhoQuantidadeDita: "2 big bags" }).map((c) => c.rotulo)).toEqual([
      "Big bags (medida do cliente)",
      "Entulho, como o disse",
    ]);
  });

  it("o route aplica-os logo à entrada, antes do motor e de gravar o formulário", () => {
    const ROTA = ler("src/app/api/simulador/pedido/route.ts");
    const aplica = ROTA.indexOf("Object.assign(order, camposDaCategoriaParaGravar(order));");
    expect(aplica).toBeGreaterThan(-1);
    expect(ROTA.indexOf("order.description = comAsLinhasDaCategoria(order.description, order)")).toBeGreaterThan(aplica);
    expect(aplica).toBeLessThan(ROTA.indexOf("calculateFastEstimate({"));
    expect(aplica).toBeLessThan(ROTA.indexOf("rawOrderJson: JSON.stringify(order)"));
  });
});
