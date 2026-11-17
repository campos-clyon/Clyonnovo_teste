import { describe, it, expect } from "vitest";
import {
  TEMPOS_DO_MOTOR,
  custoDoTrabalho,
  destinoDaDeposicao,
  foraDaGrelhaParaAMesa,
  parametrosDoMotor,
  pessoasDoTrabalho,
  portagemDaPerna,
  grelhaComACargaCheia,
  type BaseDoCalculo,
  type EntradaDoCusto,
  type Perna,
} from "./custo-do-trabalho";
import { pedidoParaOMotor, grelhaDaEstimativa } from "./custo-do-trabalho-do-pedido";
import { estimativaDaGrelha } from "./preco-de-referencia";
import { createSimulatorSettingsMap } from "./simulator-settings";
import { acordadoParaReceber, servicoMaisTaxa } from "./taxas-plataforma";

/*
 * O MOTOR DE CUSTOS (d61 fase a). Os testes fixam a FÓRMULA e as REGRAS, não os
 * números exactos — esses dependem das distâncias. Os casos da a.9 com pernas
 * escritas à mão, perto das reais.
 */

const TAXAS = { cliente: 0, profissional: 0.1 };
const P = parametrosDoMotor(createSimulatorSettingsMap([]), TAXAS);
const P_INICIAL = parametrosDoMotor({}, TAXAS);

const perna = (km: number, minutos: number | null = null): Perna => ({ km, minutos, origem: "estrada" });
const base = (concelho: string, ida: Perna, aDeposicao: Perna, volta: Perna, extra: Partial<BaseDoCalculo> = {}): BaseDoCalculo => ({
  id: 1,
  concelho,
  tamanhoDaCarrinha: "media",
  pernas: { ida, aDeposicao, volta },
  ...extra,
});
const entrada = (e: Partial<EntradaDoCusto>): EntradaDoCusto => ({
  servico: "recolha_moveis",
  acesso: { andar: 0, elevador: "sim", distanciaAPorta: "normal" },
  concelho: "lisboa",
  tipoDaBase: "candidatos",
  bases: [],
  grelha: null,
  ...e,
});
const precoPelaFormula = (total: number, margem = 0.25) =>
  Math.ceil(servicoMaisTaxa(acordadoParaReceber(total * (1 + margem), TAXAS), TAXAS) / 5) * 5;

describe("os parâmetros iniciais (a.3)", () => {
  it("as Configs dão os valores da especificação", () => {
    expect(P.consumoL100km).toBe(10);
    expect(P.desgastePorKm).toBe(0.29);
    expect(P.custoHoraEquipa).toEqual({ 1: 15, 2: 27, 3: 39 });
    expect(P.custoPorSaida).toBe(15);
    expect(P.margemParceiro).toBe(0.25);
    expect(P.velocidadeSemMedida).toBe(35);
    expect(P.enchimentoUtil).toBe(0.85);
    expect(P.tectoFator).toBe(1.3);
    expect(P.chaoFator).toBe(0.9);
    expect(P.cargaAdicionalFator).toBe(0.7);
    expect(P.deposicao).toMatchObject({ valorsul: 85.64, amarsul: 85, provisoria: 85 });
    expect(P.portagens).toEqual({ ponte25Abril: 4.85, vascoDaGama: 7.55 });
    expect(P_INICIAL.dieselPreco).toBe(2.135);
  });
});

describe("os casos da a.9", () => {
  it("1) sofá-cama de ferro, 3.º sem elevador, Almada, parceiro no Seixal: 2 pessoas, ~71 min no local, dentro da grelha", () => {
    const c = custoDoTrabalho(
      entrada({
        pecas: [{ tipo: "sofa_cama_ferro", tamanho: "grande", quantidade: 1, cabeNoElevador: "nao" }],
        acesso: { andar: 3, elevador: "nao", distanciaAPorta: "normal" },
        concelho: "almada",
        bases: [base("seixal", perna(10, 15), perna(8, 12), perna(12, 18))],
        grelha: { tipo: "valor", valor: 110 },
      }),
      P_INICIAL,
    );
    expect(c.pessoas).toBe(2);
    // 15 + 3 × 10 + 10 fixos + 15 de descarga + 1 por peça = 71 min.
    expect(Math.round(c.horas.local * 60)).toBe(71);
    expect(c.km.total).toBe(30);
    expect(c.portagens).toEqual([]);
    expect(c.custo.total).toBeGreaterThan(80);
    expect(c.custo.total).toBeLessThan(100);
    expect(c.precoMotor).toBe(precoPelaFormula(c.custo.total));
    expect(c.grelha).toEqual({ chao: 99, tecto: 143, valorGrelha: 110 });
    expect(c.foraDaFaixa).toBeNull();
  });

  it("2) um frigorífico, rés-do-chão, Lisboa, parceiro em Odivelas: REEE a 0 €, acima do tecto", () => {
    const c = custoDoTrabalho(
      entrada({
        pecas: [{ tipo: "frigorifico", tamanho: "grande", quantidade: 1 }],
        bases: [base("odivelas", perna(12, 20), perna(18, 25), perna(12, 18))],
        grelha: { tipo: "valor", valor: 65 },
      }),
      P_INICIAL,
    );
    expect(c.pessoas).toBe(2);
    expect(c.custo.deposicao).toBe(0);
    expect(c.km.total).toBe(42);
    expect(c.grelha.tecto).toBe(84.5);
    expect(c.foraDaFaixa).toBe("acima_do_tecto");
    // O cliente, em sombra, ficaria no tecto: o motor só grava.
    expect(c.precoAoCliente).toBe(84.5);
  });

  it("3) o mesmo frigorífico com o parceiro na margem sul: + a 25 de Abril, acima do tecto", () => {
    const c = custoDoTrabalho(
      entrada({
        pecas: [{ tipo: "frigorifico", tamanho: "grande", quantidade: 1 }],
        bases: [base("almada", perna(15, 25), perna(18, 25), perna(30, 30))],
        grelha: { tipo: "valor", valor: 65 },
      }),
      P_INICIAL,
    );
    expect(c.portagens).toEqual([{ nome: "Ponte 25 de Abril", valor: 4.85, perna: "base → cliente" }]);
    expect(c.custo.portagens).toBe(4.85);
    expect(c.foraDaFaixa).toBe("acima_do_tecto");
  });

  it("4) esvaziamento T2, 4.º sem elevador, Amadora (20 m³): 3 pessoas, 2 cargas, ~2,4 t, mediana de 3, acima do tecto", () => {
    const grande = (id: number, ida: number, volta: number): BaseDoCalculo => ({
      ...base("lisboa", perna(ida, ida * 1.5), perna(15, 20), perna(volta, volta * 1.5)),
      id,
      tamanhoDaCarrinha: "grande",
    });
    const c = custoDoTrabalho(
      entrada({
        servico: "esvaziamento_apartamento",
        tipologia: "T2",
        recheio: { m3De: 20, m3Ate: 20 },
        acesso: { andar: 4, elevador: "nao", distanciaAPorta: "normal" },
        concelho: "amadora",
        bases: [grande(1, 10, 20), grande(2, 25, 30), grande(3, 40, 45)],
        grelha: { tipo: "faixa", de: 400, ate: 600 },
      }),
      P_INICIAL,
    );
    expect(c.pessoas).toBe(3);
    expect(c.cargas).toBe(2);
    expect(c.pesoKg).toBe(2400);
    expect(c.custo.deposicao).toBeCloseTo(2.4 * 85.64, 1);
    expect(c.base.tipo).toBe("mediana3");
    const totais = c.base.custos.map((x) => x.total).sort((a, b) => a - b);
    expect(c.custo.total).toBe(totais[1]);
    expect(c.grelha).toMatchObject({ chao: 400, tecto: 600 });
    expect(c.foraDaFaixa).toBe("acima_do_tecto");
  });

  it("5) cinco peças grandes, 1.º com elevador, Lisboa: a diluição deixa o motor abaixo do chão", () => {
    const e = estimativaDaGrelha({ servico: "recolha_moveis", movelModo: "item", itens: { grande: 5 }, acesso: { floor: "1", hasElevator: "yes", parkingDistance: null } });
    const grelha = grelhaDaEstimativa(e);
    expect(grelha?.tipo).toBe("valor");
    const c = custoDoTrabalho(
      entrada({
        pecas: [{ tamanho: "grande", quantidade: 5, cabeNoElevador: "sim" }],
        acesso: { andar: 1, elevador: "sim", distanciaAPorta: "normal" },
        bases: [base("lisboa", perna(8, 15), perna(18, 25), perna(20, 30), { tamanhoDaCarrinha: "grande" })],
        grelha,
      }),
      P_INICIAL,
    );
    expect(c.cargas).toBe(1);
    expect(c.foraDaFaixa).toBe("abaixo_do_chao");
    expect(c.precoAoCliente).toBe(c.grelha.chao);
  });
});

describe("a fórmula (a.2)", () => {
  it("preço do motor = custo × (1 + margem) ÷ (1 − taxa), aos 5 € para cima; a taxa vem de taxas-plataforma.ts", () => {
    const e = entrada({ pecas: [{ tamanho: "media", quantidade: 2 }], bases: [base("lisboa", perna(10, 15), perna(10, 15), perna(10, 15))] });
    const c = custoDoTrabalho(e, P_INICIAL);
    expect(c.precoMotor % 5).toBe(0);
    expect(c.precoMotor).toBe(precoPelaFormula(c.custo.total));
    const comOutraTaxa = custoDoTrabalho(e, { ...P_INICIAL, taxas: { cliente: 0, profissional: 0.2 } });
    expect(comOutraTaxa.precoMotor).toBeGreaterThan(c.precoMotor);
    // Os degraus somam o total.
    const { km, portagens, maoDeObra, deposicao, saida, fixos, total } = c.custo;
    expect(Math.round((km + portagens + maoDeObra + deposicao + saida + fixos) * 100) / 100).toBe(total);
    expect(km).toBeCloseTo(30 * (2.135 * 0.1 + 0.29), 1);
  });

  it("com o parceiro escolhido, os custos do perfil dele mandam (km, hora, margem, fixos)", () => {
    const e = entrada({
      tipoDaBase: "parceiro",
      pecas: [{ tamanho: "grande", quantidade: 1 }],
      bases: [base("lisboa", perna(10, 15), perna(10, 15), perna(10, 15), { custos: { custoKm: 1, custoHoraPessoa: 20, margemPercent: 40, custosFixosPorTrabalho: 5 } })],
    });
    const c = custoDoTrabalho(e, P_INICIAL);
    expect(c.base.tipo).toBe("parceiro");
    expect(c.custo.combustivel).toBe(30);
    expect(c.custo.desgaste).toBe(0);
    expect(c.custo.maoDeObra).toBe(c.horas.total * 20 * c.pessoas);
    expect(c.custo.saida).toBe(20);
    expect(c.precoMotor).toBe(precoPelaFormula(c.custo.total, 0.4));
  });

  it("sem ninguém na zona, a base CLYON e a explicação diz porquê; horas no quarto de hora, mínimo 1 h", () => {
    const c = custoDoTrabalho(
      entrada({ tipoDaBase: "clyon", pecas: [{ tamanho: "pequena", quantidade: 1 }], bases: [{ ...base("seixal", perna(1, 2), perna(1, 2), perna(1, 2)), id: null }] }),
      P_INICIAL,
    );
    expect(c.base.tipo).toBe("clyon");
    expect(c.explicacao.join(" ")).toContain("sem parceiro na zona");
    expect(c.horas.total).toBe(1);
    expect((c.horas.total * 4) % 1).toBe(0);
  });

  it("sem medida da estrada, a condução sai dos km ÷ velocidade", () => {
    const c = custoDoTrabalho(
      entrada({ pecas: [{ tamanho: "pequena", quantidade: 1 }], bases: [base("lisboa", { km: 35, minutos: null, origem: "estimativa" }, perna(0, 0), perna(0, 0))] }),
      P_INICIAL,
    );
    expect(c.horas.conducao).toBe(1);
    expect(c.km.origem).toBe("estimativa");
  });
});

describe("a regra das pessoas (a.4)", () => {
  const r = (e: Partial<EntradaDoCusto>) => custoDoTrabalho(entrada({ bases: [base("lisboa", perna(5, 10), perna(5, 10), perna(5, 10))], ...e }), P_INICIAL).pessoas;
  it("1 pessoa: só pequenas e médias, até 8, sem escadas", () => {
    expect(r({ pecas: [{ tamanho: "pequena", quantidade: 3 }, { tamanho: "media", quantidade: 2 }] })).toBe(1);
  });
  it("2 pessoas: uma peça grande ou pesada, mais de 10 médias pelas escadas, ou um esvaziamento pequeno", () => {
    expect(r({ pecas: [{ tamanho: "grande", quantidade: 1 }] })).toBe(2);
    expect(r({ pecas: [{ tamanho: "media", quantidade: 1, pesoKg: 35 }] })).toBe(2);
    expect(r({ pecas: [{ tamanho: "media", quantidade: 11 }], acesso: { andar: 2, elevador: "nao", distanciaAPorta: "normal" } })).toBe(2);
    expect(r({ servico: "esvaziamento_garagem", tipologia: "carrinha" })).toBe(2);
  });
  it("3 pessoas: 100 kg ou mais com 2 andares de escada, 1,5 cargas, ou T3/T4/moradia", () => {
    expect(r({ pecas: [{ tipo: "frigorifico_americano", tamanho: "grande", quantidade: 1 }], acesso: { andar: 2, elevador: "nao", distanciaAPorta: "normal" } })).toBe(3);
    // A peça que não cabe no elevador conta as escadas mesmo havendo elevador.
    expect(r({ pecas: [{ tamanho: "grande", pesoKg: 110, quantidade: 1, cabeNoElevador: "nao" }], acesso: { andar: 3, elevador: "sim", distanciaAPorta: "normal" } })).toBe(3);
    expect(r({ pecas: [{ tamanho: "grande", pesoKg: 110, quantidade: 1, cabeNoElevador: "sim" }], acesso: { andar: 3, elevador: "sim", distanciaAPorta: "normal" } })).toBe(2);
    expect(r({ servico: "esvaziamento_casa", tipologia: "T3" })).toBe(3);
    expect(r({ recheio: { m3De: 16, m3Ate: 16 } })).toBe(3);
  });
  it("a regra pura dá o porquê", () => {
    const x = pessoasDoTrabalho({ servico: "esvaziamento_casa", tipologia: "moradia", acesso: { andar: 0, elevador: "sim", distanciaAPorta: "normal" } }, [], 0, 0.85);
    expect(x).toEqual({ pessoas: 3, porque: "esvaziamento moradia" });
  });
  it("a equipa do parceiro mais pequena do que a regra pede não baixa o preço", () => {
    const e = entrada({ pecas: [{ tamanho: "grande", quantidade: 1 }], bases: [base("lisboa", perna(5, 10), perna(5, 10), perna(5, 10), { pessoasNaEquipa: 1 })] });
    const c = custoDoTrabalho(e, P_INICIAL);
    expect(c.pessoas).toBe(2);
    expect(c.explicacao.join(" ")).toContain("Este trabalho pede 2 pessoas");
  });
});

describe("os tempos (a.4) numa constante única", () => {
  it("os minutos da especificação", () => {
    expect(TEMPOS_DO_MOTOR.porPeca).toEqual({ pequena: 3, media: 6, grande: 11, pesada: 15 });
    expect(TEMPOS_DO_MOTOR.escadasPorAndar).toEqual({ pequena: 3, media: 5, grande: 8, pesada: 10 });
    expect(TEMPOS_DO_MOTOR.fatorDaEquipa).toEqual({ 1: 1.6, 2: 1, 3: 0.75 });
    expect(TEMPOS_DO_MOTOR.desmontar.roupeiro_2_portas).toBe(25);
  });
});

describe("a diluição (a.7)", () => {
  const b = () => [base("lisboa", perna(10, 15), perna(10, 15), perna(10, 15), { tamanhoDaCarrinha: "grande" })];
  it("cada peça a mais só acrescenta os seus minutos e o seu peso: a saída e as pernas pagam-se uma vez", () => {
    const uma = custoDoTrabalho(entrada({ pecas: [{ tamanho: "grande", quantidade: 1 }], bases: b() }), P_INICIAL);
    const cinco = custoDoTrabalho(entrada({ pecas: [{ tamanho: "grande", quantidade: 5 }], bases: b() }), P_INICIAL);
    expect(cinco.custo.saida).toBe(uma.custo.saida);
    expect(cinco.custo.km).toBe(uma.custo.km);
    expect(cinco.custo.total).toBeLessThan(5 * uma.custo.total);
  });
  it("cada carga a mais acrescenta só a perna cliente ⇄ deposição, a descarga e a deposição", () => {
    const media = () => [base("lisboa", perna(10, 15), perna(10, 15), perna(10, 15))];
    const uma = custoDoTrabalho(entrada({ recheio: { m3De: 5, m3Ate: 5 }, bases: media() }), P_INICIAL);
    const duas = custoDoTrabalho(entrada({ recheio: { m3De: 9, m3Ate: 9 }, bases: media() }), P_INICIAL);
    expect(uma.cargas).toBe(1);
    expect(duas.cargas).toBe(2);
    expect(duas.km.deposicao).toBe(3 * uma.km.deposicao);
    expect(duas.km.ida).toBe(uma.km.ida);
    expect(duas.km.volta).toBe(uma.km.volta);
    expect(duas.custo.saida).toBe(uma.custo.saida);
  });
  it("na grelha, a carga cheia limita a soma ao preço de uma carga (e não limita enquanto ele for 0)", () => {
    const pecas = [{ tamanho: "grande" as const, quantidade: 8 }];
    const g = { tipo: "valor" as const, valor: 415 };
    expect(grelhaComACargaCheia(g, pecas, 6, 1, { precoDeUmaCarga: 0, cargaAdicionalFator: 0.7 })).toEqual({ grelha: g, cargaCheia: true });
    expect(grelhaComACargaCheia(g, pecas, 6, 1, { precoDeUmaCarga: 300, cargaAdicionalFator: 0.7 }).grelha).toEqual({ tipo: "valor", valor: 300 });
    expect(grelhaComACargaCheia(g, pecas, 6, 2, { precoDeUmaCarga: 200, cargaAdicionalFator: 0.7 }).grelha).toEqual({ tipo: "valor", valor: 340 });
    expect(grelhaComACargaCheia(g, [{ tamanho: "grande", quantidade: 3 }], 4, 1, { precoDeUmaCarga: 300, cargaAdicionalFator: 0.7 }).cargaCheia).toBe(false);
  });
});

describe("as portagens pela margem (a.5), sem traçado", () => {
  it("de sul para norte, a ponte do concelho de partida; de norte para sul, 0", () => {
    expect(portagemDaPerna("seixal", "lisboa", P, "x")?.nome).toBe("Ponte 25 de Abril");
    expect(portagemDaPerna("almada", "oeiras", P, "x")?.valor).toBe(4.85);
    expect(portagemDaPerna("barreiro", "lisboa", P, "x")).toEqual({ nome: "Ponte Vasco da Gama", valor: 7.55, perna: "x" });
    expect(portagemDaPerna("montijo", "loures", P, "x")?.nome).toBe("Ponte Vasco da Gama");
    expect(portagemDaPerna("lisboa", "almada", P, "x")).toBeNull();
    expect(portagemDaPerna("almada", "seixal", P, "x")).toBeNull();
    expect(portagemDaPerna(null, "lisboa", P, "x")).toBeNull();
  });
  it("a base na margem sul paga a ida uma vez, mesmo com duas cargas", () => {
    const c = custoDoTrabalho(
      entrada({ recheio: { m3De: 9, m3Ate: 9 }, bases: [base("seixal", perna(25, 30), perna(18, 25), perna(30, 35))] }),
      P_INICIAL,
    );
    expect(c.cargas).toBe(2);
    expect(c.portagens.map((x) => x.perna)).toEqual(["base → cliente"]);
  });
});

describe("a deposição (a.6)", () => {
  const b = () => [base("lisboa", perna(10, 15), perna(10, 15), perna(10, 15))];
  it("REEE a 0 € (frigorífico, máquina, fogão…); o resto paga pelo peso, à tarifa do concelho", () => {
    const reee = custoDoTrabalho(entrada({ pecas: [{ tipo: "frigorifico", tamanho: "grande", quantidade: 1 }, { tipo: "maquina", tamanho: "grande", quantidade: 1 }, { tipo: "fogao", tamanho: "media", quantidade: 1 }], bases: b() }), P_INICIAL);
    expect(reee.custo.deposicao).toBe(0);
    const sofa = custoDoTrabalho(entrada({ pecas: [{ tipo: "sofa", tamanho: "grande", quantidade: 1 }], bases: b() }), P_INICIAL);
    expect(sofa.custo.deposicao).toBeCloseTo((50 / 1000) * 85.64, 2);
  });
  it("o entulho fica a 0 € no motor", () => {
    const c = custoDoTrabalho(entrada({ servico: "recolha_entulho", sacos: [{ quantidade: 40, tipo: "entulho" }], bases: b() }), P_INICIAL);
    expect(c.custo.deposicao).toBe(0);
    expect(c.pesoKg).toBe(1000);
  });
  it("o destino por concelho; Cascais, Oeiras, Sintra e Mafra a confirmar", () => {
    expect(destinoDaDeposicao("lisboa").chave).toBe("valorsul");
    expect(destinoDaDeposicao("almada").chave).toBe("amarsul");
    expect(destinoDaDeposicao("setubal").chave).toBe("amarsul");
    expect(destinoDaDeposicao("sintra").aConfirmar).toBe(true);
    expect(destinoDaDeposicao(null).chave).toBe("valorsul");
  });
});

describe("a Mesa: «Fora da grelha» com o custo em degraus", () => {
  it("só fora da grelha, e os degraus somam o custo", () => {
    const c = custoDoTrabalho(
      entrada({ pecas: [{ tipo: "frigorifico", tamanho: "grande", quantidade: 1 }], bases: [base("odivelas", perna(12, 20), perna(18, 25), perna(12, 18))], grelha: { tipo: "valor", valor: 65 } }),
      P_INICIAL,
    );
    const f = foraDaGrelhaParaAMesa(JSON.parse(JSON.stringify(c)));
    expect(f?.sentido).toBe("acima_do_tecto");
    expect(f?.degraus.map((d) => d.rotulo.split(" (")[0])).toEqual(["Km", "Portagens", "Pessoas × horas", "Deposição", "Saída"]);
    expect(Math.round(f!.degraus.reduce((s, d) => s + d.valor, 0) * 100) / 100).toBe(c.custo.total);
    expect(foraDaGrelhaParaAMesa({ ...c, foraDaFaixa: null })).toBeNull();
    expect(foraDaGrelhaParaAMesa("lixo")).toBeNull();
  });
});

describe("do pedido gravado à entrada do motor", () => {
  it("lê as peças, o acesso, o concelho e a grelha do formulário do simulador", () => {
    const p = pedidoParaOMotor({
      serviceType: "recolha_moveis",
      floor: "3º",
      hasElevator: "no",
      parkingDistance: "door",
      city: "Almada",
      rawOrderJson: JSON.stringify({
        serviceType: "recolha_moveis",
        movelMode: "item",
        movelItemsGrande: 2,
        movelItemsMedio: 1,
        heavyItems: ["Frigorífico"],
        floor: "3º",
        hasElevator: "no",
        address: { lat: 38.68, lng: -9.16, city: "Almada", postalCode: "2800-100" },
      }),
    });
    expect(p).not.toBeNull();
    expect(p!.acesso).toEqual({ andar: 3, elevador: "nao", distanciaAPorta: "normal" });
    expect(p!.concelho).toBe("almada");
    expect(p!.ponto).toEqual({ lat: 38.68, lng: -9.16 });
    expect(p!.pecas).toEqual([
      expect.objectContaining({ tipo: "frigorifico", tamanho: "grande", quantidade: 1 }),
      expect.objectContaining({ tamanho: "grande", quantidade: 1 }),
      expect.objectContaining({ tamanho: "media", quantidade: 1 }),
    ]);
    expect(p!.grelha?.tipo).toBe("valor");
  });
  it("a mudança e a manutenção ficam fora do motor", () => {
    expect(pedidoParaOMotor({ serviceType: "mudanca", rawOrderJson: "{}" })).toBeNull();
    expect(pedidoParaOMotor({ serviceType: "manutencao_casa", rawOrderJson: "{}" })).toBeNull();
  });
});
