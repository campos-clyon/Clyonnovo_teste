import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFIRMO_AS_HORAS,
  HORAS_NAO_TRAVAM_O_FIM_SQL,
  MINIMO_DE_HORAS_FATURADAS,
  MINUTOS_DO_ARREDONDAMENTO,
  REGRA_DAS_HORAS,
  acertoDoFim,
  clientePodeResponderAsHoras,
  estimativaDasHoras,
  horasFaturadas,
  horasNaoTravamOFim,
  horasPrevistasDoPedido,
  intervaloDasHoras,
  lerMotivoDaContestacao,
  podeDarPorFeitoComAsHoras,
  podeMarcarHoras,
  porHoraParaOCliente,
  resumoDasHoras,
  totalDasHoras,
  totalPorHora,
  valorParaPagar,
  valorPorHoraDe,
} from "./horas-do-trabalho";
import { MINIMO_DE_HORAS } from "./tabela-das-mudancas";
import {
  MATERIAIS_DE_PARTIDA,
  lerMateriaisDaProposta,
  lerQuantidadesUsadas,
  materiaisParaOCliente,
  materiaisUsados,
} from "./materiais-da-proposta";
import { MATERIAIS } from "./tabela-das-mudancas";
import { precoDoCliente } from "./preco-do-cliente";
import { negociacaoParaAApp } from "./pedido-para-a-app";
import { negociacaoParaAVista } from "./negociacao-na-vista";
import { ACCOES_SO_DO_CLIENTE, eAccaoSoDoCliente } from "./agir-como-cliente";
import { acertoDasHoras } from "./pagamento-para-o-cliente";
import type { Pagamento } from "./pagamentos-na-base";

/**
 * AS HORAS DO TRABALHO — ordem do CEO com o sim do dono, 31-10-2026. A regra
 * (ao quarto de hora, para cima, mínimo 3), as noites que passam da
 * meia-noite e a que muda a hora, quem marca e quem confirma, o fim escondido
 * até às horas confirmadas, a diferença a pagar ou a devolver, e os materiais.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-11-03T20:00:00Z");
const SEM_TAXA_DO_CLIENTE = { cliente: 0, profissional: 0.11 };

describe("a regra: ao quarto de hora, para cima, nunca menos de 3 horas", () => {
  it("o mínimo é o da tabela das mudanças e o passo é de 15 minutos", () => {
    expect(MINIMO_DE_HORAS_FATURADAS).toBe(MINIMO_DE_HORAS);
    expect(MINIMO_DE_HORAS_FATURADAS).toBe(3);
    expect(MINUTOS_DO_ARREDONDAMENTO).toBe(15);
    expect(REGRA_DAS_HORAS).toContain("quarto de hora");
  });

  it("arredonda para cima e respeita o mínimo", () => {
    expect(horasFaturadas(0)).toBe(3);
    expect(horasFaturadas(45)).toBe(3);
    expect(horasFaturadas(130)).toBe(3);
    expect(horasFaturadas(180)).toBe(3);
    expect(horasFaturadas(181)).toBe(3.25);
    expect(horasFaturadas(240)).toBe(4);
    expect(horasFaturadas(241)).toBe(4.25);
    expect(horasFaturadas(250)).toBe(4.25);
    expect(horasFaturadas(255)).toBe(4.25);
    expect(horasFaturadas(256)).toBe(4.5);
  });
});

describe("o início e o fim, em hora de Lisboa", () => {
  it("conta o tempo entre as duas horas, no mesmo dia", () => {
    const r = intervaloDasHoras({ dia: "2026-11-03", inicio: "09:00", fim: "13:10" }, AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intervalo.minutos).toBe(250);
    expect(r.intervalo.horasFaturadas).toBe(4.25);
    expect(r.intervalo.passaDaMeiaNoite).toBe(false);
    // Inverno: Lisboa = UTC.
    expect(r.intervalo.inicioEm.toISOString()).toBe("2026-11-03T09:00:00.000Z");
  });

  it("um fim antes do início é no dia seguinte (passa da meia-noite)", () => {
    const r = intervaloDasHoras({ dia: "2026-11-02", inicio: "22:00", fim: "01:30" }, AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intervalo.passaDaMeiaNoite).toBe(true);
    expect(r.intervalo.minutos).toBe(210);
    expect(r.intervalo.horasFaturadas).toBe(3.5);
    expect(r.intervalo.fimEm.toISOString()).toBe("2026-11-03T01:30:00.000Z");
  });

  it("no Verão a hora de Lisboa está uma à frente do UTC", () => {
    const r = intervaloDasHoras({ dia: "2026-07-10", inicio: "09:00", fim: "12:00" }, AGORA);
    expect(r.ok && r.intervalo.inicioEm.toISOString()).toBe("2026-07-10T08:00:00.000Z");
  });

  it("a noite em que a hora muda conta as horas verdadeiras (25-10-2026: 02:00 volta a 01:00)", () => {
    const r = intervaloDasHoras({ dia: "2026-10-25", inicio: "00:00", fim: "04:00" }, AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intervalo.minutos).toBe(5 * 60);
    expect(r.intervalo.horasFaturadas).toBe(5);
  });

  it("recusa horas mal escritas, iguais (seriam 24 h), longas demais ou um fim que ainda não chegou", () => {
    expect(intervaloDasHoras({ dia: "2026-11-03", inicio: "9h", fim: "13:00" }, AGORA).ok).toBe(false);
    expect(intervaloDasHoras({ dia: "2026-11-03", inicio: "25:00", fim: "13:00" }, AGORA).ok).toBe(false);
    expect(intervaloDasHoras({ dia: "03/11/2026", inicio: "09:00", fim: "13:00" }, AGORA).ok).toBe(false);
    expect(intervaloDasHoras({ dia: "2026-11-03", inicio: "09:00", fim: "09:00" }, AGORA).ok).toBe(false);
    const futuro = intervaloDasHoras({ dia: "2026-11-03", inicio: "19:00", fim: "22:00" }, AGORA);
    expect(futuro.ok).toBe(false);
    if (!futuro.ok) expect(futuro.erro).toContain("ainda não chegou");
  });
});

describe("os valores: por hora até confirmar, o total depois", () => {
  it("total = horas × valor por hora + materiais; estimativa nunca abaixo de 3 h", () => {
    expect(totalDasHoras(50, 4.25)).toBe(212.5);
    expect(totalDasHoras(50, 4.25, 24)).toBe(236.5);
    expect(estimativaDasHoras(50, 2)).toBe(150);
    expect(estimativaDasHoras(50, 5)).toBe(250);
    expect(estimativaDasHoras(50, null)).toBe(150);
  });

  it("as horas previstas de uma mudança saem da tipologia; os outros trabalhos, o mínimo", () => {
    expect(horasPrevistasDoPedido({ serviceType: "mudanca", description: "mudança de um T2" })).toBe(4);
    expect(horasPrevistasDoPedido({ serviceType: "mudanca", tipologia: "T3", desmontagem: true })).toBe(6);
    expect(horasPrevistasDoPedido({ serviceType: "mudanca" })).toBe(3);
    expect(horasPrevistasDoPedido({ serviceType: "manutencao_casa" })).toBe(3);
  });

  it("antes de confirmadas o valor acordado é por hora e paga-se a estimativa; depois é o total", () => {
    const marcadas = {
      valorAcordado: 50,
      horasMarcadasEm: "2026-11-03 14:00:00",
      valorDasHoras: 212.5,
      horasFaturadas: 4.25,
    };
    expect(valorPorHoraDe(marcadas)).toBe(50);
    expect(totalPorHora(marcadas, 4)?.tipo).toBe("marcado");
    expect(valorParaPagar(marcadas, 4)).toBe(200);
    const confirmadas = { ...marcadas, valorAcordado: 212.5, valorPorHora: 50, horasConfirmadasEm: "2026-11-03 15:00:00" };
    expect(valorPorHoraDe(confirmadas)).toBe(50);
    expect(totalPorHora(confirmadas, 4)).toEqual({ tipo: "final", total: 212.5, horas: 4.25 });
    expect(valorParaPagar(confirmadas, 4)).toBe(212.5);
  });
});

describe("quem faz o quê, e o fim escondido até às horas confirmadas", () => {
  it("o «Está feito» de um trabalho por hora só com as horas gravadas; os outros como estavam", () => {
    expect(podeDarPorFeitoComAsHoras(false, {})).toBe(true);
    expect(podeDarPorFeitoComAsHoras(true, {})).toBe(false);
    expect(podeDarPorFeitoComAsHoras(true, { horasMarcadasEm: "2026-11-03 14:00:00" })).toBe(true);
  });

  it("o fim (cliente, CLYON ou prazo) espera pelas horas confirmadas — no ecrã e no SQL", () => {
    expect(horasNaoTravamOFim({})).toBe(true);
    expect(horasNaoTravamOFim({ horasMarcadasEm: "2026-11-03 14:00:00" })).toBe(false);
    expect(horasNaoTravamOFim({ horasMarcadasEm: "2026-11-03 14:00:00", horasConfirmadasEm: "2026-11-03 15:00:00" })).toBe(true);
    const db = ler("src/lib/db.ts");
    const confirmar = db.slice(db.indexOf("export async function confirmarExecucao"), db.indexOf("export async function libertarTrabalhosPorPrazo"));
    expect(confirmar.split(HORAS_NAO_TRAVAM_O_FIM_SQL).length - 1).toBe(2);
    const cron = db.slice(db.indexOf("export async function libertarTrabalhosPorPrazo"), db.indexOf("let levantamentosEnsured"));
    expect(cron).toContain(HORAS_NAO_TRAVAM_O_FIM_SQL);
  });

  it("marca só depois da chegada confirmada, num trabalho fechado e por confirmar", () => {
    const base = { porHora: true, estado: "acordada", chegadaOk: true, horas: {} };
    expect(podeMarcarHoras(base)).toBe(true);
    expect(podeMarcarHoras({ ...base, porHora: false })).toBe(false);
    expect(podeMarcarHoras({ ...base, chegadaOk: false })).toBe(false);
    expect(podeMarcarHoras({ ...base, estado: "aberta" })).toBe(false);
    expect(podeMarcarHoras({ ...base, confirmadoEm: "2026-11-03 15:00:00" })).toBe(false);
    expect(podeMarcarHoras({ ...base, horas: { horasConfirmadasEm: "2026-11-03 15:00:00" } })).toBe(false);
    // Contestadas, pode corrigir.
    expect(podeMarcarHoras({ ...base, horas: { horasMarcadasEm: "2026-11-03 14:00:00", horasContestadasEm: "2026-11-03 15:00:00" } })).toBe(true);
  });

  it("só o profissional DO trabalho marca: a sessão diz quem é e o UPDATE repete-o", () => {
    const rota = ler("src/app/api/profissionais/trabalho/horas/route.ts");
    expect(rota).toContain("sessaoActivaDoProfissional(tokenDoProfissional(req))");
    expect(rota).toContain("providerId: sessao.providerId");
    const servidor = ler("src/lib/horas-no-servidor.ts");
    expect(servidor).toContain("(await negociacoesDoProfissional(a.providerId)).find((l) => l.id === negociacaoId)");
    const db = ler("src/lib/db.ts");
    const gravar = db.slice(db.indexOf("export async function gravarHorasDoTrabalho"), db.indexOf("export async function confirmarHorasDoTrabalho"));
    expect(gravar).toMatch(/WHERE id = \? AND providerId = \? AND estado = 'acordada'\s+AND confirmadoEm IS NULL AND horasConfirmadasEm IS NULL/);
  });

  it("só o cliente confirma ou contesta: são acções só do cliente, e o link do profissional recusa-as", () => {
    expect(ACCOES_SO_DO_CLIENTE).toContain("confirmar_horas");
    expect(ACCOES_SO_DO_CLIENTE).toContain("contestar_horas");
    expect(eAccaoSoDoCliente("confirmar_horas")).toBe(true);
    expect(eAccaoSoDoCliente("contestar_horas")).toBe(true);
    const db = ler("src/lib/db.ts");
    const confirmar = db.slice(db.indexOf("export async function confirmarHorasDoTrabalho"), db.indexOf("export async function contestarHorasDoTrabalho"));
    expect(confirmar).toContain("WHERE id = ? AND pedidoId = ?");
    expect(confirmar).toContain("valorAcordado = valorDasHoras");
    expect(confirmar).toContain("valorPorHora = COALESCE(valorPorHora, valorAcordado)");
    // A CLYON confirma pelo backoffice, só administradores.
    expect(ler("src/app/api/admin/negociacoes/horas/route.ts")).toContain("await requireAdminGeral(req)");
  });

  it("o «Não concordo» precisa do porquê", () => {
    expect(lerMotivoDaContestacao("não").ok).toBe(false);
    const r = lerMotivoDaContestacao("  Acabaram às 12h, não às 13h  ");
    expect(r.ok && r.motivo).toBe("Acabaram às 12h, não às 13h");
    expect(clientePodeResponderAsHoras({ horasMarcadasEm: "2026-11-03 14:00:00" })).toBe(true);
    expect(clientePodeResponderAsHoras({ horasMarcadasEm: "2026-11-03 14:00:00", horasContestadasEm: "2026-11-03 15:00:00" })).toBe(false);
  });

  it("o «Está feito» na rota espera pelas horas antes de gravar", () => {
    const rota = ler("src/app/api/profissionais/trabalho/route.ts");
    const espera = rota.indexOf("podeDarPorFeitoComAsHoras(porHora, trabalho)");
    expect(espera).toBeGreaterThan(0);
    expect(espera).toBeLessThan(rota.indexOf("await registarExecucao("));
  });
});

describe("o que o cliente lê: por hora, com IVA ao lado, e «parceiro»", () => {
  it("«50,00 €/hora + IVA (61,50 €/hora com IVA), mínimo 3 horas»", () => {
    const p = precoDoCliente(50, SEM_TAXA_DO_CLIENTE, "iva_incluido");
    expect(porHoraParaOCliente(p)).toBe("50,00 €/hora + IVA (61,50 €/hora com IVA), mínimo 3 horas");
  });

  it("o resumo das horas diz das HH:MM às HH:MM = N h → total X € + IVA (Y € com IVA)", () => {
    const r = resumoDasHoras(
      {
        valorAcordado: 50,
        valorPorHora: 50,
        horasInicioEm: "2026-11-03 09:00:00",
        horasFimEm: "2026-11-03 13:10:00",
        horasMinutos: 250,
        horasFaturadas: 4.25,
        valorDasHoras: 212.5,
        horasMarcadasEm: "2026-11-03 13:15:00",
      },
      SEM_TAXA_DO_CLIENTE,
      "iva_incluido",
    );
    expect(r?.textoParaOCliente).toBe("O parceiro marcou das 09:00 às 13:10 = 4,25 h → total 212,50 € + IVA (261,38 € com IVA).");
    expect(r?.textoParaOCliente).not.toMatch(/profissional/i);
    expect(r?.recebe).toBe(189.13);
  });

  it("num pedido por hora a app e o site mostram o preço de UMA hora e a estimativa — nunca misturados", () => {
    const vista = negociacaoParaAVista(
      {
        id: 1,
        estado: "aberta",
        valorAcordado: null,
        taxaCliente: 0,
        createdAt: "2026-10-31 10:00:00",
        propostasJson: JSON.stringify([{ por: "profissional", valor: 50, criadaEm: "2026-10-31T10:00:00Z", estado: "pendente" }]),
        profissionalNome: "Ana",
        materiaisJson: JSON.stringify({ incluidos: true }),
      },
      { porCarga: false, porHora: true, horasPrevistas: 4, agora: AGORA },
    );
    const app = negociacaoParaAApp(vista, "hora", AGORA);
    expect(app.preco?.principal).toBe("61,50 €/hora com IVA");
    expect(app.preco?.detalhe).toBe("50,00 €/hora + IVA (61,50 €/hora com IVA), mínimo 3 horas");
    expect(app.preco?.nota).toContain("Estimativa para 4 h: 200,00 € + IVA (246,00 € com IVA)");
    expect(app.horas?.porHoraTexto).toContain("/hora");
    expect(app.materiaisTexto).toBe("Materiais incluídos no valor.");
  });

  it("contratado e com horas marcadas: confirma ou contesta; o «Sim, ficou feito» só depois de confirmadas", () => {
    const linha = {
      id: 2,
      estado: "acordada",
      valorAcordado: 50,
      taxaCliente: 0,
      createdAt: "2026-10-31 10:00:00",
      propostasJson: "[]",
      profissionalNome: "Ana",
      execucaoEnviadaEm: "2026-11-03 13:20:00",
      horasInicioEm: "2026-11-03 09:00:00",
      horasFimEm: "2026-11-03 13:10:00",
      horasMinutos: 250,
      horasFaturadas: 4.25,
      valorPorHora: 50,
      valorDasHoras: 212.5,
      horasMarcadasEm: "2026-11-03 13:15:00",
    };
    const antes = negociacaoParaAApp(negociacaoParaAVista(linha, { porCarga: false, porHora: true, horasPrevistas: 4, agora: AGORA }), "hora", AGORA);
    expect(antes.accoes).toContain("confirmar_horas");
    expect(antes.accoes).toContain("contestar_horas");
    expect(antes.accoes).not.toContain("confirmar");
    expect(antes.horas?.botaoConfirmar).toBe(CONFIRMO_AS_HORAS);
    expect(antes.horas?.marcadas?.texto).toContain("O parceiro marcou das 09:00 às 13:10 = 4,25 h");
    const depois = negociacaoParaAApp(
      negociacaoParaAVista(
        { ...linha, valorAcordado: 212.5, horasConfirmadasEm: "2026-11-03 14:00:00", horasConfirmadasPor: "cliente" },
        { porCarga: false, porHora: true, horasPrevistas: 4, agora: AGORA },
      ),
      "hora",
      AGORA,
    );
    expect(depois.accoes).toContain("confirmar");
    expect(depois.accoes).not.toContain("confirmar_horas");
    expect(depois.preco?.principal).toBe("261,38 € com IVA");
    expect(depois.preco?.nota).toBe("Total das horas confirmadas.");
  });
});

describe("o dinheiro no fim: a diferença paga-se, o que sobra devolve-se à mão", () => {
  const pago = (valor: number, parte: "trabalho" | "diferenca" = "trabalho"): Pagamento =>
    ({ id: 1, estado: "pago", valor, valorPago: valor, comFactura: true, parte }) as unknown as Pagamento;
  const trabalho = {
    porHora: { horasConfirmadas: true, valorFinal: 250 },
    acordado: 250,
    taxas: SEM_TAXA_DO_CLIENTE,
    modelo: "iva_incluido" as const,
  };

  it("acertoDoFim ao cêntimo", () => {
    expect(acertoDoFim(184.5, 307.5)).toEqual({ aPagar: 123, aDevolver: 0 });
    expect(acertoDoFim(350, 307.5)).toEqual({ aPagar: 0, aDevolver: 42.5 });
    expect(acertoDoFim(307.5, 307.5)).toEqual({ aPagar: 0, aDevolver: 0 });
  });

  it("depois de pago e confirmado: a diferença a pagar, ou a devolver", () => {
    expect(acertoDasHoras(trabalho, [pago(184.5)])).toMatchObject({ aPagar: 123, aDevolver: 0, final: 307.5 });
    expect(acertoDasHoras(trabalho, [pago(350)])).toMatchObject({ aPagar: 0, aDevolver: 42.5 });
    // Paga a diferença, fica certo.
    expect(acertoDasHoras(trabalho, [pago(184.5), pago(123, "diferenca")])).toMatchObject({ aPagar: 0, aDevolver: 0 });
    // Sem horas confirmadas, ou sem o trabalho pago, não há acerto.
    expect(acertoDasHoras({ ...trabalho, porHora: { horasConfirmadas: false, valorFinal: null } }, [pago(184.5)])).toBeNull();
    expect(acertoDasHoras(trabalho, [])).toBeNull();
    expect(acertoDasHoras({ ...trabalho, porHora: null }, [pago(184.5)])).toBeNull();
  });

  it("a diferença vai pela mesma rota, com o valor do servidor, e com índice único próprio", () => {
    const rota = ler("src/app/api/pagamentos/route.ts");
    expect(rota).toContain(`const parte = corpo.parte === "diferenca" ? "diferenca" : "trabalho";`);
    expect(rota).toContain("acertoDasHoras(t, await pagamentosDaNegociacao(t.negociacaoId))");
    expect(rota).toContain("valor = acerto.aPagar;");
    const base = ler("src/lib/pagamentos-na-base.ts");
    expect(base).toContain("ADD UNIQUE KEY uq_uma_diferenca (diferencaPaga)");
    expect(base).toContain("negociacaoPaga = IF(parte = 'diferenca', NULL, ?)");
    // Nunca se devolve sozinho: não há chamada de reembolso nesta conta.
    expect(ler("src/lib/pagamento-para-o-cliente.ts")).not.toMatch(/reembols/i);
  });

  it("o cliente paga a estimativa num trabalho por hora, e o total depois de confirmadas", () => {
    const acesso = ler("src/lib/acesso-ao-pagamento.ts");
    expect(acesso).toContain("valorParaPagar(linha, horasPrevistasDaLinha(");
  });
});

describe("os materiais da proposta", () => {
  it("os de partida têm os nomes curtos e os preços da tabela das mudanças (uma lista só)", () => {
    for (const m of MATERIAIS_DE_PARTIDA) {
      expect(MATERIAIS.find((t) => t.id === m.id)?.preco).toBe(m.preco);
    }
    expect(MATERIAIS_DE_PARTIDA.map((m) => m.nome)).toEqual(["Caixa", "Cartão", "Filme / plástico"]);
  });

  it("lê o que vem do formulário: incluídos, ou à parte com preços válidos", () => {
    expect(lerMateriaisDaProposta({ incluidos: true })).toEqual({ incluidos: true });
    expect(lerMateriaisDaProposta(null)).toBeNull();
    expect(lerMateriaisDaProposta({ incluidos: false, itens: [] })).toBeNull();
    const m = lerMateriaisDaProposta({
      incluidos: false,
      itens: [
        { id: "caixa", preco: "2,5" },
        { id: "filme", preco: 0 },
        { nome: "Fita cola", preco: 2, unidade: "rolo" },
        { nome: "", preco: 3 },
      ],
    });
    expect(m).toEqual({
      incluidos: false,
      itens: [
        { id: "caixa", nome: "Caixa", preco: 2.5, unidade: "unidade" },
        { id: "outro-3", nome: "Fita cola", preco: 2, unidade: "rolo" },
      ],
    });
  });

  it("ao cliente, cada preço com o IVA ao lado; no fim as quantidades somam-se", () => {
    const m = lerMateriaisDaProposta({ incluidos: false, itens: [{ id: "caixa", preco: 2 }, { id: "filme", preco: 10 }] });
    expect(materiaisParaOCliente(m, SEM_TAXA_DO_CLIENTE, "iva_incluido")).toBe(
      "Materiais à parte: caixa 2,00 € + IVA (2,46 € com IVA) por unidade · filme / plástico 10,00 € + IVA (12,30 € com IVA) por rolo.",
    );
    const q = lerQuantidadesUsadas({ caixa: 12, filme: "1", fita: 9, outro: -1 }, m);
    expect(q).toEqual({ caixa: 12, filme: 1 });
    expect(materiaisUsados(m, q).total).toBe(34);
  });
});
