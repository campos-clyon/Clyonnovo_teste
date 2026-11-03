import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({ erro: null })) }));

import { POST as referencia } from "@/app/api/cliente/referencia/route";
import { GET as catalogo } from "@/app/api/cliente/catalogo/route";
import { SERVICOS_PUBLICOS } from "./service-categories";
import { ENTULHO_POR_VOLUME, ESVAZIAMENTO_POR_TIPOLOGIA } from "./precos-publicos";
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
import { lerEntulho, localidadeServida, razoesDoAcessoDificil, lerAcesso } from "./respostas-do-simulador";
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
const especifica = (r: ReturnType<typeof referenciaDoPedido>) => r.linhas.find((l) => l.rotulo === "Para o que escolheu")?.texto ?? null;

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

  it("5 e 10 sacos: 40 – 50 € + IVA", () => {
    for (const n of [5, 10]) {
      const r = entulho({ entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: n });
      expect(especifica(r)).toBe("40 – 50 € + IVA (49,20 – 61,50 € com IVA).");
      expect(r.conta).toEqual({ servico: "40 – 50 €", iva: "9,20 – 11,50 €", ivaRotulo: "IVA (23 %)", total: "49,20 – 61,50 €" });
      expect(r.porque).toContain(`${n} sacos: até 10 sacos é a primeira linha da grelha.`);
    }
  });

  it("50 sacos ≈ 1,25 m³: desde 180 € + IVA (221,40 € com IVA)", () => {
    const r = entulho({ entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50 });
    expect(r.linhas.map(linhaEscrita)).toEqual([
      "Preço de referência: 10 sacos 40 – 50 € + IVA (49,20 – 61,50 € com IVA); desde 120 €/m³ + IVA (147,60 €/m³ com IVA)",
      "Para o que escolheu: desde 180 € + IVA (221,40 € com IVA).",
    ]);
    expect(r.conta).toEqual({ servico: "desde 180 €", iva: "desde 41,40 €", ivaRotulo: "IVA (23 %)", total: "desde 221,40 €" });
    expect(r.porque).toEqual(["50 sacos ≈ 1,25 m³."]);
  });

  it("2 big bags = 76 sacos ≈ 1,9 m³", () => {
    const r = entulho({ entulho: "ensacado", tipoDeSaco: "bigbag", quantidade: 2 });
    expect(2 * SACOS_POR_BIG_BAG).toBe(76);
    expect(especifica(r)).toBe("desde 274 € + IVA (337,02 € com IVA).");
    expect(r.porque).toEqual(["2 big bags ≈ 76 sacos (38 por big bag) ≈ 1,9 m³."]);
  });

  it("2 m³ a granel cabem em «Até 3 m³»: a linha da grelha, desde 432 €; e o tempo de carga entra na proposta", () => {
    const r = entulho({ entulho: "chao", entulhoVolume: "ate3" });
    expect(especifica(r)).toBe("desde 432 € + IVA (531,36 € com IVA).");
    expect(r.porque).toEqual(["Até 3 m³ a granel ≈ 120 sacos.", "No chão, a granel: o tempo de carga entra na proposta."]);
  });

  it("6 m³ («Mais de 5 m³»): proposta com fotografias, sem número", () => {
    const r = entulho({ entulho: "chao", entulhoVolume: "mais" });
    expect(especifica(r)).toBe("Proposta com fotografias.");
    expect(r.conta).toBeNull();
    expect(r.porque[0]).toBe("Mais de 5 m³: o parceiro faz a proposta a partir das fotografias.");
    // E 240 sacos (6 m³) contados em sacos dão o mesmo.
    expect(especifica(entulho({ entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 240 }))).toBe("Proposta com fotografias.");
  });

  it("parte e parte: os sacos cheios e os por ensacar somam-se", () => {
    const r = entulho({ entulho: "misto", ensacados: 30, porEnsacar: 20 });
    expect(especifica(r)).toBe("desde 180 € + IVA (221,40 € com IVA).");
    expect(r.porque).toEqual(["30 sacos cheios e cerca de 20 por ensacar ≈ 50 sacos ≈ 1,25 m³.", "O que está por ensacar: o tempo de carga entra na proposta."]);
  });

  it("sem a quantidade, fica a grelha e diz-se porquê", () => {
    const r = entulho({ entulho: "unknown" });
    expect(r.linhas).toHaveLength(1);
    expect(r.conta).toBeNull();
    expect(r.porque).toEqual(["Sem a quantidade, fica a grelha; o parceiro confirma-a pelas fotografias."]);
  });
});

describe("d1 — o acesso leva a referência ao topo da faixa, e diz porquê", () => {
  it("3.º andar sem elevador: o topo da faixa dos móveis", () => {
    const r = daR12({ servico: "recolha_moveis", movelModo: "carga", volume: "carrinha", floor: "3º", hasElevator: "no", parkingDistance: "door" });
    expect(especifica(r)).toBe("120 € + IVA (147,60 € com IVA), o topo da faixa (40 – 120 € + IVA (49,20 – 147,60 € com IVA)), pelo acesso difícil.");
    expect(r.conta?.total).toBe("147,60 €");
    expect(r.porque).toEqual(["3.º andar sem elevador: o topo da faixa."]);
  });

  it("«não sei» se há elevador, e o estacionamento longe, também", () => {
    const r = daR12({ servico: "recolha_monos", floor: "2º", hasElevator: "unknown", parkingDistance: "over_30m" });
    expect(especifica(r)).toContain("100 € + IVA (123 € com IVA), o topo da faixa");
    expect(r.porque).toEqual(["2.º andar, sem saber se há elevador: o topo da faixa.", "Estacionamento a mais de 30 metros: o topo da faixa."]);
    expect(razoesDoAcessoDificil(lerAcesso({ floor: "4º+", hasElevator: "no" }))).toEqual(["4.º andar ou acima sem elevador"]);
  });

  it("o acesso normal (elevador, à porta, rés-do-chão) não mexe", () => {
    for (const a of [{ floor: "3º", hasElevator: "yes" }, { floor: "3º", hasElevator: "small" }, { floor: "rés-do-chão" }, { parkingDistance: "under_20m" }]) {
      const r = daR12({ servico: "recolha_moveis", ...a });
      expect(r.linhas, JSON.stringify(a)).toHaveLength(1);
      expect(r.porque).toEqual([]);
    }
  });

  it("10 sacos no 2.º sem elevador: 50 € + IVA, o topo dos 40 – 50 €", () => {
    const r = daR12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 10, floor: "2º", hasElevator: "no" });
    expect(especifica(r)).toBe("50 € + IVA (61,50 € com IVA), o topo da faixa (40 – 50 € + IVA (49,20 – 61,50 € com IVA)), pelo acesso difícil.");
    expect(r.porque).toContain("2.º andar sem elevador: o topo da faixa.");
  });

  it("onde é «desde», o acesso não inventa um número: entra na proposta", () => {
    const r = daR12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50, parkingDistance: "difficult" });
    expect(especifica(r)).toBe("desde 180 € + IVA (221,40 € com IVA).");
    expect(r.porque).toContain("Estacionamento difícil: o parceiro tem-no em conta na proposta.");
  });

  it("na mudança a tabela já conta os andares: o acesso não se conta duas vezes", () => {
    const pedido = { servico: "mudanca", tipologia: "T2", origem: { floor: "3º", hasElevator: "no" }, destino: { floor: "rés-do-chão" }, floor: "3º", hasElevator: "no", parkingDistance: "difficult" };
    const r = daR12(pedido);
    expect(r.linhas.map((l) => l.rotulo)).toEqual(["Preço de referência", "Estimativa para a sua mudança"]);
    expect(r.porque).toEqual(["T2: cerca de 4 h da equipa de 3.", "3 andares a pé, sem elevador: a tabela conta cada um."]);
  });

  it("garagem, sótão e cave: o topo como antes, agora com o porquê", () => {
    const r = daR12({ servico: "esvaziamento_sotao", volume: "camiao_lixo", acessoDoEspaco: "alcapao", estacionamento: "door" });
    expect(especifica(r)).toBe("480 € + IVA (590,40 € com IVA), o topo da faixa (360 – 480 € + IVA (442,80 – 590,40 € com IVA)), pelo acesso difícil.");
    expect(r.porque).toEqual(["Alçapão com escada de abrir: o topo da faixa."]);
  });
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
    // A moradia não é apartamento.
    expect(daR12({ servico: "esvaziamento_apartamento", tipologia: "moradia" }).linhas).toHaveLength(1);
  });

  it("a manutenção fica «desde 57 € + IVA» até haver a grelha por tipo, e diz porquê", () => {
    const r = daR12({ servico: "manutencao_casa", tipoDeTrabalho: "canalizacao", quantoTrabalho: "varias_pequenas", materiais: "parceiro", repeticao: "pontual", floor: "4º+", hasElevator: "no" });
    expect(r.linhas.map(linhaEscrita)).toEqual(["Preço de referência: desde 57 € + IVA (70,11 € com IVA)"]);
    expect(r.conta?.total).toBe("desde 70,11 €");
    expect(r.porque).toEqual([
      "Canalização, várias reparações pequenas: a proposta sai da descrição e das fotografias.",
      "Os materiais pelo parceiro: entram na proposta.",
    ]);
    expect(grelhaDaManutencao({ tipoDeTrabalho: "pintura", quantoTrabalho: "uma_divisao", materiais: null, repeticao: null })).toBeNull();
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

  it("o porquê nunca tem euros, e cada linha com € leva o com IVA", () => {
    for (const c of CASOS) {
      const r = daR12(c);
      for (const p of r.porque) expect(p, JSON.stringify(c)).not.toContain("€");
      for (const l of r.linhas) if (l.texto.includes("€")) expect(l.texto, JSON.stringify(c)).toContain("com IVA");
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
    expect(j.linhas.map(linhaEscrita)).toContain("Para o que escolheu: desde 180 € + IVA (221,40 € com IVA).");
    expect(j.conta.total).toBe("desde 221,40 €");
    expect(j.porque).toEqual(["50 sacos ≈ 1,25 m³."]);
    // A carga antiga conta pela mesma regra do site.
    const carga = await chamar({ servico: "recolha_entulho", entulho: { estado: "chao", modo: "volume", volume: "camiao_caixa" } });
    expect(carga.porque[0]).toBe(`Enche a caixa de um camião ≈ ${SACOS_POR_CARGA.camiao_caixa} sacos ≈ 3 m³.`);
    // Sem nada do entulho, como antes.
    const nada = await chamar({ servico: "recolha_entulho", entulho: { estado: undefined, modo: undefined } });
    expect(nada.linhas).toHaveLength(1);
    expect(nada.conta).toBeNull();
  });

  it("os casos do dono pela rota: entulho de 50 sacos e manutenção", async () => {
    const e = await chamar({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50 });
    expect(e).toEqual({ ok: true, ...daR12({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 50 }) });
    const m = await chamar({ servico: "manutencao_casa", tipoDeTrabalho: "pintura", quantoTrabalho: "uma_divisao", materiais: "nao_sei" });
    expect(m.linhas.map(linhaEscrita)).toEqual(["Preço de referência: desde 57 € + IVA (70,11 € com IVA)"]);
    expect(Object.keys(m).sort()).toEqual(["conta", "linhas", "nota", "ok", "porque"]);
  });

  it("valores estragados não partem nada", () => {
    const r = daR12({ servico: "recolha_entulho", entulho: "<x>", tipoDeSaco: "contentor", quantidade: -4, entulhoVolume: "ate99", floor: { x: 1 } });
    expect(r.linhas).toHaveLength(1);
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
