import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AVISO_DA_LIMPEZA,
  ditosDestaRecolha,
  perguntaDo,
  recolhaNova,
  responderComCompreensao,
  responderNaRecolha,
  textoDoSeguimento,
  SALTO_DA_PERGUNTA,
  type DadosDaRecolha,
  type EstadoDaRecolha,
  type PassoDaRecolha,
} from "./whatsapp-recolha";
import { passoDaPergunta } from "./reler-a-conversa";
import {
  oQueFazerComARecolha,
  podeSeguir,
  SEGUIMENTOS_POR_CONVERSA,
  SEGUIMENTOS_POR_PERGUNTA,
  MINUTOS_PARA_SEGUIR,
} from "./recolhas-paradas";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";

/**
 * A CONVERSA DA GARAGEM NO -3 — 13-11-2026 (decisão d25, versão 2 de 14-11).
 *
 * Um cliente pediu o esvaziamento de uma garagem em Odivelas, com tudo na
 * primeira mensagem: os móveis, a cama, a limpeza com a lavagem do pavimento
 * e «o valor total, já com IVA». Pelo caminho:
 *   · pediu o valor com IVA e mesmo assim perguntaram-lhe a fatura;
 *   · disse «Pode ser sem fatura!» e o resumo pôs «Fatura: sim»;
 *   · «É uma garagem» ficou «Andar: r/c», e «garagem no -3» ficou «Andar: 3»;
 *   · pediu a limpeza do pavimento e ninguém lhe disse que ficava no pedido;
 *   · corrigiu o piso («AndR -3») e recebeu outra pergunta — deixou de
 *     responder.
 *
 * *«Antes de cada pergunta, a Vitória relê a conversa inteira e não pergunta
 * o que já está respondido.»* — o dono, 14-11-2026.
 *
 * As frases são as dele; o nome («Silvério») e a rua são INVENTADOS
 * (repositório público), a localidade fica. O dia é 13-11-2026 às 15h de
 * Lisboa.
 */

const AGORA = new Date("2026-11-13T15:00:00Z");

const PRIMEIRA =
  "Boa tarde. Gostaria de pedir um orçamento para o esvaziamento e limpeza completa de uma garagem em Odivelas. A garagem tem bastante material acumulado, incluindo móveis antigos, uma cama e vários objetos. O serviço pretendido inclui a retirada de todos os objetos, o carregamento, transporte e encaminhamento adequado dos resíduos, e a limpeza profunda da garagem, incluindo lavagem do pavimento. Gostaria de saber o valor total, já com IVA, e a disponibilidade. Obrigado.";
const NOME = "Silvério Teste";
const MORADA = "Rua das Gaivotas Mansas 12, 2675-000 Odivelas. É uma garagem";

type Troca = { cliente: string; vitoria: string; registar: boolean; estado: EstadoDaRecolha };

/** A conversa pelas regras (o caminho de quando o modelo não responde), relida a cada mensagem. */
function conversar(falas: string[], inicio: EstadoDaRecolha = recolhaNova()): Troca[] {
  let e = inicio;
  const ditos: string[] = [];
  const trocas: Troca[] = [];
  for (const f of falas) {
    const r = responderNaRecolha(e, f, AGORA, true, false, { ditosAntes: ditos.slice() });
    ditos.push(f);
    e = r.estado;
    trocas.push({ cliente: f, vitoria: r.resposta, registar: r.registar === true, estado: r.estado });
  }
  return trocas;
}

/** As perguntas do pedido que a Vitória fez, pela ordem (o resumo não conta). */
function perguntasFeitas(trocas: Troca[]): PassoDaRecolha[] {
  return trocas
    .map((t) => (t.vitoria ? passoDaPergunta(t.vitoria) : null))
    .filter((p): p is PassoDaRecolha => p != null && p !== "confirmar");
}

describe("a garagem no -3, repetida — o que ele disse não se pergunta", () => {
  let trocas: Troca[];
  beforeAll(() => {
    // Ele responde ao que se lhe pergunta, com as palavras dele; o «sem fatura» vem ao ver o resumo.
    trocas = conversar([
      PRIMEIRA,
      NOME,
      MORADA,
      "Isso é uma garagem no -3. Tudo o resto está ok",
      "Sim tem elevador no prédio",
      "Consegue se houver lugar, senão fica em segunda fila",
      "Início de dezembro, não tenho pressa",
      "Pode ser sem fatura!",
      "AndR -3",
      "Sim",
    ]);
  });

  it("zero perguntas repetidas, e a da fatura nunca se faz (ele pediu o valor com IVA)", () => {
    const feitas = perguntasFeitas(trocas);
    expect(feitas.length).toBeGreaterThan(3);
    expect(new Set(feitas).size).toBe(feitas.length);
    expect(feitas).not.toContain("fatura");
    for (const t of trocas) expect(t.vitoria).not.toMatch(/deseja fatura|NIF na fatura/i);
  });

  it("a limpeza com a lavagem fica no pedido, e diz-se-lhe uma vez que fica registada", () => {
    expect(trocas[0].vitoria).toContain("com limpeza e lavagem do pavimento");
    expect(trocas[0].vitoria).toContain(AVISO_DA_LIMPEZA);
    expect(trocas.filter((t) => t.vitoria.includes(AVISO_DA_LIMPEZA))).toHaveLength(1);
    const final = trocas[trocas.length - 1].estado.dados;
    expect(final.limpeza).toEqual({ lavagem: true });
    expect((final.notas ?? []).some((n) => /limpeza do espaço/.test(n) && /lavagem do pavimento/.test(n))).toBe(true);
  });

  it("«É uma garagem» pergunta o piso — não é r/c —, e «-3» fica -3", () => {
    expect(trocas[2].vitoria).toMatch(/em que piso fica a garagem/i);
    expect(trocas[2].estado.dados.floor).toBeUndefined();
    expect(trocas[3].estado.dados.floor).toBe("-3");
  });

  it("«Pode ser sem fatura!» no resumo fica «Fatura: não» — corrige, e não se toma por um sim", () => {
    // O primeiro resumo traz o «já com IVA» da primeira mensagem.
    expect(trocas[6].vitoria).toContain("Fatura: com NIF");
    const t = trocas[7];
    expect(t.registar).toBe(false);
    expect(t.vitoria.startsWith("Corrigido: fatura sem NIF.")).toBe(true);
    expect(t.estado.dados.precisaFatura).toBe(false);
    for (const depois of trocas.slice(7).filter((x) => x.vitoria.includes("Confirme, por favor"))) {
      expect(depois.vitoria).toContain("Fatura: sem NIF");
      expect(depois.vitoria).not.toContain("Fatura: com NIF");
    }
    for (const r of trocas.filter((x) => x.vitoria.includes("Confirme, por favor"))) {
      expect(r.vitoria).toContain("Andar: piso -3");
      expect(r.vitoria).toContain("Limpeza: sim, com lavagem do pavimento");
    }
  });

  it("«Pode ser sem fatura!» a meio, à pergunta do piso, fica dito — e o piso volta por outras palavras", () => {
    const t = conversar([PRIMEIRA, NOME, MORADA, "Pode ser sem fatura!"])[3];
    expect(t.estado.dados.precisaFatura).toBe(false);
    expect(t.vitoria).toContain("fica anotado: fatura sem NIF");
    expect(t.vitoria).not.toMatch(/não percebi|não apanhei/i);
    expect(passoDaPergunta(t.vitoria)).toBe("andar");
  });

  it("«segunda fila» é a carrinha, e a data é a que ele deu", () => {
    const final = trocas[trocas.length - 1].estado.dados;
    expect(final.quandoTexto).toBe("Início de dezembro, não tenho pressa");
    expect(final.dataDesejada ?? null).toBeNull();
  });

  it("«AndR -3» confirma-se com o resumo — «Corrigido: piso -3.» —, sem outra pergunta", () => {
    const t = trocas[8];
    expect(t.vitoria.startsWith("Corrigido: piso -3.")).toBe(true);
    expect(t.vitoria).toContain("Confirme, por favor");
    expect(t.registar).toBe(false);
    expect(t.estado.passo).toBe("confirmar");
    expect(trocas[9].registar).toBe(true);
  });
});

describe("a correcção no resumo errado de 13-11 — confirma-se com o resumo", () => {
  /** O resumo que ele recebeu: «Andar: r/c» e «Fatura: sim». */
  const errado: DadosDaRecolha = {
    serviceType: "esvaziamento_garagem",
    contactName: NOME,
    address: "Rua das Gaivotas Mansas 12",
    postalCode: "2675-000",
    city: "Odivelas",
    floor: "0",
    parkingDistance: "near",
    quandoTexto: "Início de dezembro, não tenho pressa",
    description: "esvaziamento e limpeza completa de uma garagem",
    precisaFatura: true,
  };
  const noResumo: EstadoDaRecolha = { passo: "confirmar", dados: errado };

  it("«garagem no -3. Tudo o resto está ok» → «Corrigido: piso -3.», o resumo, e só o elevador no fim", () => {
    const r = responderNaRecolha(noResumo, "Isso é uma garagem no -3. Tudo o resto está ok", AGORA, true, false);
    expect(r.registar).not.toBe(true);
    expect(r.resposta.startsWith("Corrigido: piso -3.")).toBe(true);
    expect(r.resposta).toContain("Fica assim:");
    expect(r.resposta).toContain("Andar: piso -3");
    expect(r.resposta).toMatch(/Só me falta uma coisa: .*elevador/);
    expect(passoDaPergunta(r.resposta)).toBe("elevador");
    expect(r.estado.passo).toBe("elevador");
    const depois = responderNaRecolha(r.estado, "Sim tem elevador no prédio", AGORA, true, false);
    expect(depois.resposta).toContain("Confirme, por favor");
    expect(depois.resposta).toContain("Andar: piso -3 · elevador: sim");
  });

  it("«Pode ser sem fatura!» no resumo corrige — não regista", () => {
    const r = responderNaRecolha(noResumo, "Pode ser sem fatura!", AGORA, true, false);
    expect(r.registar).not.toBe(true);
    expect(r.resposta.startsWith("Corrigido: fatura sem NIF.")).toBe(true);
    expect(r.resposta).toContain("Fatura: sem NIF");
  });

  it("pelo modelo também: o «3» sem sinal e a intenção de confirmar não passam por cima das palavras dele", () => {
    const r = responderComCompreensao(
      noResumo,
      { intencao: "confirmar", campos: { andar: "3" } },
      AGORA,
      { texto: "Isso é uma garagem no -3. Tudo o resto está ok", jaCumprimentou: true },
    );
    expect(r.registar).not.toBe(true);
    expect(r.resposta.startsWith("Corrigido: piso -3.")).toBe(true);
    expect(r.estado.dados.floor).toBe("-3");
    const f = responderComCompreensao(noResumo, { intencao: "confirmar", campos: { fatura: "sim" } }, AGORA, {
      texto: "Pode ser sem fatura!",
      jaCumprimentou: true,
    });
    expect(f.registar).not.toBe(true);
    expect(f.estado.dados.precisaFatura).toBe(false);
    expect(f.resposta).toContain("Fatura: sem NIF");
    const g = responderComCompreensao(
      { passo: "confirmar", dados: { ...errado, floor: "-3", hasElevator: "yes" } },
      { intencao: "informar", campos: { andar: "3" } },
      AGORA,
      { texto: "AndR -3", jaCumprimentou: true },
    );
    expect(g.resposta.startsWith("Corrigido: piso -3.")).toBe(true);
    expect(g.resposta).toContain("Confirme, por favor");
    expect(g.estado.dados.floor).toBe("-3");
  });

  it("pelo modelo, relida a conversa: o «já com IVA» da primeira mensagem dispensa a pergunta da fatura", () => {
    const naData: EstadoDaRecolha = { passo: "quando", dados: { ...errado, floor: "-3", hasElevator: "yes", precisaFatura: undefined, quandoTexto: undefined } };
    const r = responderComCompreensao(naData, { intencao: "informar", campos: { quando: "Início de dezembro, não tenho pressa" } }, AGORA, {
      texto: "Início de dezembro, não tenho pressa",
      jaCumprimentou: true,
      ditosAntes: [PRIMEIRA, NOME, MORADA],
    });
    expect(r.resposta).not.toMatch(/deseja fatura|NIF na fatura/i);
    expect(r.resposta).toContain("Confirme, por favor");
    expect(r.resposta).toContain("Fatura: com NIF");
    expect(r.estado.dados.limpeza).toEqual({ lavagem: true });
  });
});

describe("reler a conversa — só a desta recolha", () => {
  it("o que ele escreveu antes, por ordem, sem a mensagem de agora e sem o pedido de antes", () => {
    const fio = [
      { direccao: "in", texto: "sem fatura, obrigado" },
      { direccao: "out", texto: "O seu pedido #812 está registado. Obrigada!" },
      { direccao: "in", texto: PRIMEIRA },
      { direccao: "out", texto: "Com quem tenho o gosto de falar?" },
      { direccao: "in", texto: NOME },
      { direccao: "out", texto: "Qual é a morada, por favor?" },
      { direccao: "in", texto: MORADA },
    ];
    expect(ditosDestaRecolha(fio, MORADA)).toEqual([PRIMEIRA, NOME]);
    expect(ditosDestaRecolha([], "x")).toEqual([]);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * A MENSAGEM GENTIL A QUEM FICOU CALADO — d25 v2.
 * ────────────────────────────────────────────────────────────────────────── */
describe("a mensagem gentil aos 10 minutos de silêncio", () => {
  const MIN = 60;
  // 15h de Lisboa num dia de Novembro (UTC+0) — hora de falar.
  const TARDE = new Date("2026-11-13T15:00:00Z");
  const naMorada: EstadoDaRecolha = { passo: "morada", dados: { serviceType: "esvaziamento_garagem", contactName: NOME } };
  const pergunta = (texto: string, segundos: number) => ({ direccao: "out", texto, haSegundos: segundos });
  const ligado = { ligado: true, agora: TARDE };

  it("aos 10 minutos, com o interruptor ligado, sai a mensagem gentil — antes do salto", () => {
    expect(MINUTOS_PARA_SEGUIR).toBe(10);
    expect(oQueFazerComARecolha(naMorada, pergunta("Qual é a morada?", 10 * MIN), SALTO_DA_PERGUNTA, ligado)).toBe("seguir");
    expect(oQueFazerComARecolha(naMorada, pergunta("Qual é a morada?", 9 * MIN), SALTO_DA_PERGUNTA, ligado)).toBe("nada");
  });

  it("interruptor desligado (ou sem ele): é como era — salta-se a pergunta", () => {
    expect(oQueFazerComARecolha(naMorada, pergunta("Qual é a morada?", 10 * MIN), SALTO_DA_PERGUNTA, { ligado: false, agora: TARDE })).toBe("saltar");
    expect(oQueFazerComARecolha(naMorada, pergunta("Qual é a morada?", 10 * MIN), SALTO_DA_PERGUNTA)).toBe("saltar");
    expect(podeSeguir(naMorada, pergunta("Qual é a morada?", 10 * MIN), { ligado: false, agora: TARDE })).toBe(false);
  });

  it("no máximo 1 por pergunta e 2 por conversa — depois volta o salto", () => {
    expect(SEGUIMENTOS_POR_PERGUNTA).toBe(1);
    expect(SEGUIMENTOS_POR_CONVERSA).toBe(2);
    const jaNaMorada: EstadoDaRecolha = { ...naMorada, dados: { ...naMorada.dados, seguimentos: ["morada"] } };
    expect(podeSeguir(jaNaMorada, pergunta("Qual é a morada?", 12 * MIN), ligado)).toBe(false);
    expect(oQueFazerComARecolha(jaNaMorada, pergunta(textoDoSeguimento("morada", jaNaMorada.dados), 10 * MIN), SALTO_DA_PERGUNTA, ligado)).toBe("saltar");
    const umaJa: EstadoDaRecolha = { passo: "andar", dados: { ...naMorada.dados, seguimentos: ["morada"] } };
    expect(podeSeguir(umaJa, pergunta("E em que andar é?", 10 * MIN), ligado)).toBe(true);
    const duasJa: EstadoDaRecolha = { passo: "elevador", dados: { ...naMorada.dados, seguimentos: ["morada", "andar"] } };
    expect(podeSeguir(duasJa, pergunta("Há elevador?", 10 * MIN), ligado)).toBe(false);
  });

  it("nunca entre as 20h e as 9h de Lisboa — pela hora de Lisboa, e não pela do servidor", () => {
    const s = (iso: string) => ({ ligado: true, agora: new Date(iso) });
    const p = pergunta("Qual é a morada?", 10 * MIN);
    // Inverno (Lisboa = UTC): 19h59 fala, 20h00 não, 8h59 não, 9h00 fala.
    expect(podeSeguir(naMorada, p, s("2026-11-13T19:59:00Z"))).toBe(true);
    expect(podeSeguir(naMorada, p, s("2026-11-13T20:00:00Z"))).toBe(false);
    expect(podeSeguir(naMorada, p, s("2026-11-14T08:59:00Z"))).toBe(false);
    expect(podeSeguir(naMorada, p, s("2026-11-14T09:00:00Z"))).toBe(true);
    // Verão (Lisboa = UTC+1): 19h30 UTC já são 20h30 em Lisboa; 08h30 UTC são 9h30.
    expect(podeSeguir(naMorada, p, s("2026-07-10T19:30:00Z"))).toBe(false);
    expect(podeSeguir(naMorada, p, s("2026-07-10T08:30:00Z"))).toBe(true);
  });

  it("de noite espera-se pelas 9h: nem a mensagem gentil, nem o salto no lugar dela", () => {
    const noite = { ligado: true, agora: new Date("2026-11-13T23:10:00Z") };
    expect(oQueFazerComARecolha(naMorada, pergunta("Qual é a morada?", 20 * MIN), SALTO_DA_PERGUNTA, noite)).toBe("nada");
    // Já com as duas usadas, de noite também não salta.
    const duas: EstadoDaRecolha = { passo: "elevador", dados: { ...naMorada.dados, seguimentos: ["morada", "andar"] } };
    expect(oQueFazerComARecolha(duas, pergunta("Há elevador?", 20 * MIN), SALTO_DA_PERGUNTA, noite)).toBe("nada");
    // A pergunta das 19h50 leva a mensagem gentil às 9h do dia seguinte (13h10 depois).
    const nove = { ligado: true, agora: new Date("2026-11-14T09:00:00Z") };
    expect(oQueFazerComARecolha(naMorada, pergunta("Qual é a morada?", 13 * 3600 + 10 * MIN), SALTO_DA_PERGUNTA, nove)).toBe("seguir");
    // Desligado, é como era: o salto não olha para a hora.
    expect(oQueFazerComARecolha(naMorada, pergunta("Qual é a morada?", 20 * MIN), SALTO_DA_PERGUNTA, { ligado: false, agora: noite.agora })).toBe("saltar");
  });

  it("nunca numa conversa entregue a uma pessoa, nem com o pedido registado, nem por cima da equipa", () => {
    const p = pergunta("Qual é a morada?", 15 * MIN);
    expect(podeSeguir(naMorada, p, { ...ligado, entregueAUmaPessoa: true })).toBe(false);
    expect(podeSeguir(naMorada, p, { ...ligado, pedidoRegistado: true })).toBe(false);
    expect(podeSeguir(naMorada, pergunta(`${MARCA_DE_MAO} já lhe ligo`, 15 * MIN), ligado)).toBe(false);
    expect(podeSeguir(naMorada, { direccao: "in", texto: "um momento", haSegundos: 15 * MIN }, ligado)).toBe(false);
    // Nem no serviço, nem no resumo (que tem o seu registo aos 30 minutos), nem numa conversa de há 15 horas.
    expect(podeSeguir({ passo: "servico", dados: {} }, p, ligado)).toBe(false);
    expect(podeSeguir({ passo: "confirmar", dados: naMorada.dados }, p, ligado)).toBe(false);
    expect(podeSeguir(naMorada, pergunta("Qual é a morada?", 15 * 3600), ligado)).toBe(false);
  });

  it("a mesma pergunta por outras palavras, que a releitura reconhece como a mesma", () => {
    const passos: PassoDaRecolha[] = ["nome", "morada", "codigoPostal", "andar", "elevador", "estacionamento", "quando", "descricao", "fatura", "entulhoQuantidade"];
    const d: DadosDaRecolha = { serviceType: "esvaziamento_garagem", contactName: NOME };
    for (const passo of passos) {
      const texto = textoDoSeguimento(passo, d);
      expect(texto.startsWith("Continuo por aqui, sem pressa.")).toBe(true);
      expect(texto, passo).not.toBe(perguntaDo(passo, d, false));
      expect(texto, passo).not.toMatch(/não percebi|não apanhei/i);
      expect(passoDaPergunta(texto), passo).toBe(passo);
    }
    expect(textoDoSeguimento("andar", { ...d, espaco: "garagem" })).toMatch(/em que piso/i);
  });

  it("o interruptor nasce desligado, e as Configs mostram-no com o mesmo nome", () => {
    const base = readFileSync(join(__dirname, "seguimento-da-vitoria-na-base.ts"), "utf8");
    const nome = base.match(/NOME_DO_INTERRUPTOR_DO_SEGUIMENTO = "([^"]+)"/)?.[1];
    expect(nome).toBeTruthy();
    expect(base).toMatch(/const desligado: InterruptorDoSeguimento = \{ ligado: false/);
    const ecra = readFileSync(join(__dirname, "..", "components", "admin", "InterruptorDoSeguimentoDaVitoria.tsx"), "utf8");
    expect(ecra).toContain(`const NOME = "${nome}"`);
    const configs = readFileSync(join(__dirname, "..", "components", "admin", "LegacyAdminClient.tsx"), "utf8");
    expect(configs).toMatch(/<InterruptorDoSeguimentoDaVitoria \/>/);
    const passagem = readFileSync(join(__dirname, "recolhas-paradas.ts"), "utf8");
    expect(passagem).toMatch(/seguimentoDaVitoriaLigado\(\)\.catch\(\(\) => false\)/);
  });

  it("sem linha na base, ou com a base a falhar, o interruptor lê-se desligado", () => {
    const base = readFileSync(join(__dirname, "seguimento-da-vitoria-na-base.ts"), "utf8");
    expect(base).toMatch(/if \(!l\) return desligado;/);
    expect(base).toMatch(/catch \(e\) \{[\s\S]{0,200}return desligado;/);
  });
});
