import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CORTE_DO_MODELO,
  DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO,
  IBAN_E_MBWAY_OBRIGATORIOS_ATE,
  IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO,
  NOVO_MODELO_DESDE,
  NOVO_MODELO_DESDE_POR_EXTENSO,
  REGIME_DE_IVA_OBRIGATORIO,
  TRABALHOS_CLYON_NO_MODELO_ANTIGO,
  eDoNovoModelo,
  novoModeloEmVigor,
} from "./novo-modelo";
import { agoraDoModelo } from "./relogio-do-modelo";
import { contaDoPagamentoDirecto, contaDoValorAcordado, emCentimos } from "./pagamento-directo";
import { perfilFiscalDoParceiro } from "./perfil-fiscal";
import { dadosImpedemAceitar, dadosParaPagarAoParceiro, estadoDosDadosParaReceber } from "./dados-para-receber";
import { PAGAR_O_VALOR_EM_ATRASO, explicacaoDoStandBy, standByDe } from "./valor-em-atraso";
import { comoPagarDisponiveis, lerComoPagar } from "./pagar-ao-parceiro";

const HOJE = new Date("2026-11-12T15:00:00Z");
const DIA_15 = new Date("2026-11-15T10:00:00Z");
const DIA_23 = new Date("2026-11-23T00:00:01Z");
const ANTES = "2026-11-10T12:00:00Z";
const DEPOIS = "2026-11-16T12:00:00Z";

const dezPorCento = { cliente: 0, profissional: 0.1 };

function conta(servico: number, taxas: { cliente: number; profissional: number }, regime: "normal" | "isento", material = 0) {
  const r = contaDoPagamentoDirecto({ servicoCent: emCentimos(servico), materialCent: emCentimos(material), taxas, regime });
  if (!r.ok) throw new Error(r.erro);
  return r.conta;
}

describe("a data e os interruptores (d10)", () => {
  it("15/11 às 00h de Lisboa (UTC em Novembro), e o extenso bate", () => {
    expect(NOVO_MODELO_DESDE.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    const dia = NOVO_MODELO_DESDE.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "long", year: "numeric" });
    expect(dia.replace(/ de /g, " ")).toBe(NOVO_MODELO_DESDE_POR_EXTENSO.replace(/ de /g, " "));
    const fim = IBAN_E_MBWAY_OBRIGATORIOS_ATE.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "long", year: "numeric" });
    expect(fim.replace(/ de /g, " ")).toBe(IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO.replace(/ de /g, " "));
    expect(DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO).toBe(4);
  });

  it("as três perguntas, com a resposta do CEO", () => {
    expect(CORTE_DO_MODELO).toBe("ja_pago_a_clyon");
    expect(TRABALHOS_CLYON_NO_MODELO_ANTIGO).toBe(true);
    expect(REGIME_DE_IVA_OBRIGATORIO).toBe(true);
  });

  it("antes da data, nada é do modelo novo; a meia-noite de Lisboa já é", () => {
    expect(novoModeloEmVigor(HOJE)).toBe(false);
    expect(novoModeloEmVigor(new Date("2026-11-14T23:59:59Z"))).toBe(false);
    expect(novoModeloEmVigor(new Date("2026-11-15T00:00:00Z"))).toBe(true);
    expect(eDoNovoModelo({}, HOJE)).toBe(false);
    expect(eDoNovoModelo({}, DIA_15)).toBe(true);
  });

  it("a data simulada nunca vale em produção", () => {
    const antes = { ...process.env };
    try {
      process.env.NOVO_MODELO_DATA_SIMULADA = "2026-11-15T10:00:00Z";
      process.env.VERCEL_ENV = "preview";
      expect(agoraDoModelo().toISOString()).toBe("2026-11-15T10:00:00.000Z");
      process.env.VERCEL_ENV = "production";
      expect(Math.abs(agoraDoModelo().getTime() - Date.now())).toBeLessThan(5000);
    } finally {
      process.env = antes;
    }
  });

  it("o corte: caução já paga, Trabalho CLYON e trabalho fechado antes ficam no antigo", () => {
    expect(eDoNovoModelo({ clientePagouEm: ANTES }, DIA_15)).toBe(false);
    expect(eDoNovoModelo({ ofertaClyon: "valor_fixo" }, DIA_15)).toBe(false);
    expect(eDoNovoModelo({ fechadoEm: ANTES }, DIA_15)).toBe(false);
    // Contratado antes, sem nada pago, por fechar: entra no novo (pergunta 1, resposta do CEO).
    expect(eDoNovoModelo({ contratadaEm: ANTES }, DIA_15)).toBe(true);
    expect(eDoNovoModelo({ contratadaEm: DEPOIS, fechadoEm: DEPOIS }, DIA_15)).toBe(true);
  });

  it("a fonte diz a data uma vez só", () => {
    const fonte = readFileSync(join(process.cwd(), "src/lib/novo-modelo.ts"), "utf8");
    expect(fonte.match(/2026-11-15T00:00:00Z/g)?.length).toBe(1);
  });
});

describe("a conta do pagamento ao parceiro (Finanças, 12/11)", () => {
  it.each([
    [100, "normal", 1000, 230, 1230, 9000, 2070, 11070, 12300],
    [100, "isento", 1000, 230, 1230, 9000, 0, 9000, 10230],
    [350, "normal", 3500, 805, 4305, 31500, 7245, 38745, 43050],
    [350, "isento", 3500, 805, 4305, 31500, 0, 31500, 35805],
    [1000, "normal", 10000, 2300, 12300, 90000, 20700, 110700, 123000],
    [1000, "isento", 10000, 2300, 12300, 90000, 0, 90000, 102300],
  ] as const)("%s € %s", (v, regime, T, IT, FC, B, IP, FP, cliente) => {
    const c = conta(v, dezPorCento, regime);
    expect([c.taxaCent, c.ivaDaTaxaCent, c.faturaDaClyonCent, c.baseDoProfissionalCent, c.ivaDoProfissionalCent, c.faturaDoProfissionalCent, c.totalAoClienteCent]).toEqual([
      T, IT, FC, B, IP, FP, cliente,
    ]);
    expect(c.aPassarAClyonCent).toBe(FC);
    expect(c.ficaAClyonCent).toBe(T);
  });

  it("os arredondamentos: 287,45 € a 10 % e 350 € a 15 %", () => {
    const a = conta(287.45, dezPorCento, "normal");
    expect([a.taxaCent, a.ivaDaTaxaCent, a.faturaDaClyonCent, a.baseDoProfissionalCent, a.ivaDoProfissionalCent, a.faturaDoProfissionalCent, a.totalAoClienteCent]).toEqual([
      2875, 661, 3536, 25870, 5950, 31820, 35356,
    ]);
    expect(conta(287.45, dezPorCento, "isento").totalAoClienteCent).toBe(29406);
    const b = conta(350, { cliente: 0, profissional: 0.15 }, "normal");
    expect([b.taxaCent, b.ivaDaTaxaCent, b.faturaDaClyonCent, b.baseDoProfissionalCent, b.ivaDoProfissionalCent, b.faturaDoProfissionalCent, b.totalAoClienteCent]).toEqual([
      5250, 1208, 6458, 29750, 6843, 36593, 43051,
    ]);
    expect(conta(350, { cliente: 0, profissional: 0.15 }, "isento").totalAoClienteCent).toBe(36208);
  });

  it("as mudanças: o material sem taxa, com IVA só no regime normal", () => {
    const n = conta(230, dezPorCento, "normal", 20);
    expect([n.taxaCent, n.ivaDaTaxaCent, n.faturaDaClyonCent, n.baseDoProfissionalCent, n.ivaDoProfissionalCent, n.faturaDoProfissionalCent, n.totalAoClienteCent]).toEqual([
      2300, 529, 2829, 22700, 5221, 27921, 30750,
    ]);
    const i = conta(230, dezPorCento, "isento", 20);
    expect([i.faturaDoProfissionalCent, i.totalAoClienteCent, i.aPassarAClyonCent]).toEqual([22700, 25529, 2829]);
  });

  it("o exemplo do dono com a taxa de 44 €: 54,12 / 376,38 / 430,50 / 360,12", () => {
    // 44 € de 350 € = 12,5714… %: só para provar a fórmula com os números dele.
    const c = contaDoPagamentoDirecto({ servicoCent: 35000, taxas: { cliente: 0, profissional: 44 / 350 }, regime: "normal" });
    const i = contaDoPagamentoDirecto({ servicoCent: 35000, taxas: { cliente: 0, profissional: 44 / 350 }, regime: "isento" });
    if (!c.ok || !i.ok) throw new Error("conta");
    expect(c.conta.faturaDaClyonCent).toBe(5412);
    expect(c.conta.faturaDoProfissionalCent).toBe(37638);
    expect(c.conta.totalAoClienteCent).toBe(43050);
    expect(i.conta.totalAoClienteCent).toBe(36012);
  });

  it("as invariantes fecham em todos os casos, e a taxa do cliente entra na fatura da CLYON", () => {
    const casos: Array<[number, number, { cliente: number; profissional: number }]> = [
      [100, 0, dezPorCento], [287.45, 0, dezPorCento], [350, 0, { cliente: 0, profissional: 0.15 }],
      [230, 20, dezPorCento], [99.99, 3.33, { cliente: 0.05, profissional: 0.06 }],
    ];
    for (const [v, m, t] of casos) {
      for (const regime of ["normal", "isento"] as const) {
        const c = conta(v, t, regime, m);
        expect(c.totalAoClienteCent).toBe(c.faturaDoProfissionalCent + c.faturaDaClyonCent);
        expect(c.ficaAoProfissionalCent + c.aPassarAClyonCent).toBe(c.totalAoClienteCent);
        // Sem taxa do cliente, taxa + líquido = serviço + material.
        if (t.cliente === 0) expect(c.taxaCent + c.liquidoDoProfissionalCent).toBe(c.servicoCent + c.materialCent);
        if (regime === "isento") expect(c.ivaDoProfissionalCent).toBe(0);
      }
    }
  });

  it("recusa zero, negativos e valores sem regime", () => {
    expect(contaDoPagamentoDirecto({ servicoCent: 0, taxas: dezPorCento, regime: "normal" }).ok).toBe(false);
    expect(contaDoPagamentoDirecto({ servicoCent: -100, taxas: dezPorCento, regime: "normal" }).ok).toBe(false);
    expect(contaDoPagamentoDirecto({ servicoCent: 100, taxas: dezPorCento, regime: "x" as never }).ok).toBe(false);
    expect(contaDoValorAcordado(null, dezPorCento, "normal")).toBeNull();
  });
});

describe("o perfil fiscal que o cliente vê ao escolher", () => {
  it("com IVA, isento, a confirmar (conta como com IVA) e a guia", () => {
    const em = "2026-11-13T10:00:00Z";
    expect(perfilFiscalDoParceiro({ regimeIva: "normal", regimeIvaConfirmadoEm: em }).fatura).toBe("Fatura com IVA");
    expect(perfilFiscalDoParceiro({ regimeIva: "isento", regimeIvaConfirmadoEm: em }).tipoDeFatura).toBe("isento");
    const semConfirmar = perfilFiscalDoParceiro({ regimeIva: "isento", regimeIvaConfirmadoEm: null });
    expect(semConfirmar.fatura).toBe("Tipo de fatura a confirmar");
    expect(semConfirmar.regimeParaAConta).toBe("normal");
    expect(perfilFiscalDoParceiro({ emiteGuiaTransporte: 1, guiaVerificadaEm: em }).guia).toBe("Emite guia de resíduos");
    expect(perfilFiscalDoParceiro({ emiteGuiaTransporte: 1, guiaVerificadaEm: null }).guia).toBeNull();
  });
});

describe("IBAN, MB WAY e regime obrigatórios, com os 7 dias", () => {
  const completo = { iban: "PT50000000000000000000000", ibanTitular: "Nome", mbway: "912345678", regimeIva: "normal", regimeIvaConfirmadoEm: "2026-11-01T00:00:00Z" };
  const antigoSemDados = { estado: "aprovado", aprovadoEm: "2026-10-01T00:00:00Z" };
  const novoSemDados = { estado: "aprovado", aprovadoEm: "2026-11-16T00:00:00Z" };

  it("hoje não muda nada para ninguém", () => {
    expect(estadoDosDadosParaReceber(antigoSemDados, HOJE).estado).toBe("ainda_nao_vale");
    expect(dadosImpedemAceitar(novoSemDados, HOJE)).toBe(false);
  });

  it("aprovado antes: aviso até 22/11, depois impede; novo: impede desde o início", () => {
    const e = estadoDosDadosParaReceber(antigoSemDados, DIA_15);
    expect(e.estado).toBe("aviso");
    expect(dadosImpedemAceitar(antigoSemDados, DIA_15)).toBe(false);
    expect(dadosImpedemAceitar(antigoSemDados, DIA_23)).toBe(true);
    expect(dadosImpedemAceitar(novoSemDados, DIA_15)).toBe(true);
    expect(estadoDosDadosParaReceber({ ...completo, ...antigoSemDados }, DIA_23).estado).toBe("completos");
    // O regime por confirmar também conta (pergunta 3).
    expect(dadosImpedemAceitar({ ...completo, regimeIvaConfirmadoEm: null, ...novoSemDados }, DIA_15)).toBe(true);
  });

  it("o IBAN e o MB WAY só ao cliente contratado, e só no modelo novo", () => {
    expect(dadosParaPagarAoParceiro(completo, { contratado: false, doNovoModelo: true })).toBeNull();
    expect(dadosParaPagarAoParceiro(completo, { contratado: true, doNovoModelo: false })).toBeNull();
    expect(dadosParaPagarAoParceiro(completo, { contratado: true, doNovoModelo: true })?.mbway).toBe("912345678");
  });
});

describe("o valor em atraso e o stand-by", () => {
  const nasceu = new Date("2026-11-16T10:00:00Z");
  const valor = { negociacaoId: 1, pedidoId: 700, total: 43.05, nasceuEm: nasceu, paga: false };

  it("no 4.º dia ainda não; ao 5.º, stand-by com «Pagar o valor em atraso»", () => {
    expect(standByDe([valor], new Date("2026-11-20T10:00:00Z")).emStandBy).toBe(false);
    const s = standByDe([valor], new Date("2026-11-20T10:00:01Z"));
    expect(s.emStandBy).toBe(true);
    expect(s.total).toBe(43.05);
    expect(explicacaoDoStandBy(s.valores)).toContain(PAGAR_O_VALOR_EM_ATRASO);
    expect(explicacaoDoStandBy(s.valores)).toContain("#700");
  });

  it("pago, normaliza sozinho", () => {
    expect(standByDe([{ ...valor, paga: true }], new Date("2026-12-01T00:00:00Z")).emStandBy).toBe(false);
  });
});

describe("como o cliente paga ao parceiro", () => {
  it("transferência, MB WAY ou dinheiro; sem dinheiro a partir do tecto", () => {
    expect(comoPagarDisponiveis(500)).toEqual(["transferencia", "mbway", "dinheiro"]);
    expect(comoPagarDisponiveis(3000)).toEqual(["transferencia", "mbway"]);
    expect(lerComoPagar("multibanco")).toBeNull();
  });
});

describe("a língua do modelo novo", () => {
  const FICHEIROS = [
    "src/lib/novo-modelo.ts",
    "src/lib/pagamento-directo.ts",
    "src/lib/perfil-fiscal.ts",
    "src/lib/dados-para-receber.ts",
    "src/lib/valor-em-atraso.ts",
    "src/lib/pagar-ao-parceiro.ts",
  ];
  // Só as frases (strings), sem comentários: os comentários explicam o que se tirou.
  const frases = (f: string) =>
    (readFileSync(join(process.cwd(), f), "utf8").match(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? []).join("\n");

  it("nunca «valor em dívida», «caução», «cativo» nem «a CLYON recebe/guarda»", () => {
    for (const f of FICHEIROS) {
      const t = frases(f);
      expect(t, f).not.toMatch(/em d[íi]vida/i);
      expect(t, f).not.toMatch(/d[íi]vida/i);
      expect(t, f).not.toMatch(/cau[çc][ãa]o/i);
      expect(t, f).not.toMatch(/cativo/i);
      expect(t, f).not.toMatch(/a CLYON (recebe|guarda)/i);
    }
  });
});
