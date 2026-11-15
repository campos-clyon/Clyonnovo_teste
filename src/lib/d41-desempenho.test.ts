import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  ensureNegociacoesTable: async () => {},
  ensureProvidersSchema: async () => {},
  ensureRegistoTable: async () => {},
  ensureArquivoDePedidosTable: async () => {},
  ensureSimulatorOrdersTable: async () => {},
  getPool: async () => null,
}));

import {
  comparar,
  desempenhoDe,
  filtroValido,
  fraseDaVariacao,
  linhasDoFiltro,
  rotuloDoMes,
  somarMeses,
  type LinhaDoDesempenho,
} from "@/lib/desempenho";
import { linhaDoApagado, linhaDoPedido } from "@/lib/desempenho-na-base";
import { FILTROS_DO_DESEMPENHO } from "@/lib/desempenho";
import { GRUPOS_DE_SERVICOS } from "@/lib/service-categories";

// 15-11-2026 às 12:00 em Lisboa (Inverno: UTC+0).
const AGORA = new Date("2026-11-15T12:00:00Z");

let n = 0;
function linha(p: Partial<LinhaDoDesempenho> & { criado?: string; feito?: string }): LinhaDoDesempenho {
  n += 1;
  return {
    id: n,
    criadoEm: p.criado ? new Date(p.criado) : (p.criadoEm ?? null),
    servico: p.servico ?? "recolha_moveis",
    realizadoEm: p.feito ? new Date(p.feito) : (p.realizadoEm ?? null),
    cancelado: p.cancelado ?? false,
    deTeste: p.deTeste ?? false,
  };
}

describe("d41 — as médias e as comparações", () => {
  it("média por dia dos últimos 30 dias, contra os 30 anteriores", () => {
    const linhas = [
      // início dos dados bem para trás, para haver comparação
      linha({ criado: "2024-01-05T10:00:00Z" }),
      ...Array.from({ length: 60 }, (_, i) => linha({ criado: `2026-11-${String((i % 15) + 1).padStart(2, "0")}T10:00:00Z` })),
      ...Array.from({ length: 30 }, () => linha({ criado: "2026-10-01T10:00:00Z" })),
    ];
    const d = desempenhoDe(linhas, { agora: AGORA });
    // 17-10..15-11: os 60 de novembro → 2/dia; 18-09..16-10: os 30 de 01-10 → 1/dia
    expect(d.entrados.mediaPorDia.valor).toBe(2);
    expect(d.entrados.mediaPorDia.anterior).toBe(1);
    expect(d.entrados.mediaPorDia.variacao).toBeCloseTo(100);
  });

  it("sem dados que cheguem ao período anterior → sem dados para comparar", () => {
    const d = desempenhoDe([linha({ criado: "2026-11-10T10:00:00Z" })], { agora: AGORA });
    expect(d.entrados.mediaPorDia.variacao).toBeNull();
    expect(d.entrados.mediaPorMes.variacao).toBeNull();
    expect(d.entrados.anoAteHoje.variacao).toBeNull();
    expect(fraseDaVariacao(d.entrados.mediaPorDia.variacao)).toBe("sem dados para comparar");
  });

  it("média por mês: 12 meses completos (nov-25 a out-26), contra os 12 anteriores", () => {
    const linhas = [
      ...Array.from({ length: 24 }, () => linha({ criado: "2026-03-10T10:00:00Z" })), // dentro
      ...Array.from({ length: 12 }, () => linha({ criado: "2025-03-10T10:00:00Z" })), // anteriores
      linha({ criado: "2024-11-01T09:00:00Z" }), // anteriores (o início dos dados)
      linha({ criado: "2026-11-02T10:00:00Z" }), // mês corrente: não entra
    ];
    const d = desempenhoDe(linhas, { agora: AGORA });
    expect(d.entrados.mediaPorMes.valor).toBe(2);
    expect(d.entrados.mediaPorMes.anterior).toBeCloseTo(13 / 12);
  });

  it("mês homólogo: outubro contra outubro do ano anterior", () => {
    const linhas = [
      linha({ criado: "2025-01-01T10:00:00Z" }),
      ...Array.from({ length: 4 }, () => linha({ criado: "2025-10-15T10:00:00Z" })),
      ...Array.from({ length: 6 }, () => linha({ criado: "2026-10-15T10:00:00Z" })),
    ];
    const d = desempenhoDe(linhas, { agora: AGORA });
    expect(d.entrados.mesHomologo.mes).toBe("2026-10");
    expect(d.entrados.mesHomologo.mesAnterior).toBe("2025-10");
    expect(d.entrados.mesHomologo.valor).toBe(6);
    expect(d.entrados.mesHomologo.variacao).toBeCloseTo(50);
  });

  it("ano até hoje contra o mesmo período do ano anterior; previsão pelo ritmo de 90 dias", () => {
    const linhas = [
      ...Array.from({ length: 10 }, () => linha({ criado: "2025-03-01T10:00:00Z" })),
      linha({ criado: "2025-01-01T10:00:00Z" }),
      linha({ criado: "2025-12-20T10:00:00Z" }), // depois de 15-12-2025: fora do «até hoje» de 2025
      // 90 nos últimos 90 dias → ritmo 1/dia
      ...Array.from({ length: 90 }, (_, i) => {
        const dia = new Date(Date.UTC(2026, 10, 15 - i, 10));
        return linha({ criadoEm: dia });
      }),
    ];
    const d = desempenhoDe(linhas, { agora: AGORA });
    expect(d.entrados.anoAteHoje.valor).toBe(90);
    expect(d.entrados.anoAteHoje.anterior).toBe(11);
    expect(d.entrados.ritmo90).toBe(1);
    // 16-11..31-12 = 46 dias
    expect(d.entrados.previsaoDoAno.valor).toBe(136);
    expect(d.entrados.previsaoDoAno.anterior).toBe(12);
  });

  it("comparar: subida, descida, base zero", () => {
    expect(comparar(12, 10).variacao).toBeCloseTo(20);
    expect(fraseDaVariacao(comparar(12, 10).variacao)).toBe("▲ +20 %");
    expect(fraseDaVariacao(comparar(8, 10).variacao)).toBe("▼ −20 %");
    expect(comparar(5, 0).variacao).toBeNull();
  });
});

describe("d41 — realizados, cancelados e conversão", () => {
  it("o realizado conta pelo dia em que foi feito, e o cancelado nunca é realizado", () => {
    const linhas = [
      linha({ criado: "2026-09-02T10:00:00Z", feito: "2026-11-03T10:00:00Z" }),
      linha({ criado: "2026-09-03T10:00:00Z", cancelado: true }),
      linha({ criado: "2026-09-04T10:00:00Z", feito: "2026-10-03T10:00:00Z", cancelado: true }),
    ];
    const d = desempenhoDe(linhas, { agora: AGORA });
    const nov = d.meses.find((m) => m.mes === "2026-11")!;
    const out = d.meses.find((m) => m.mes === "2026-10")!;
    const set = d.meses.find((m) => m.mes === "2026-09")!;
    expect(nov.realizados).toBe(1);
    expect(out.realizados).toBe(0);
    expect(set.entrados).toBe(3);
    expect(set.cancelados).toBe(2);
    expect(set.realizadosDaCoorte).toBe(1);
    expect(set.conversao).toBeCloseTo(100 / 3);
    expect(d.cancelados.ultimos12Meses).toBe(2);
  });

  it("conversão dos 12 meses pela coorte de entrada", () => {
    const linhas = [
      linha({ criado: "2026-05-01T10:00:00Z", feito: "2026-05-02T10:00:00Z" }),
      linha({ criado: "2026-05-01T10:00:00Z" }),
      linha({ criado: "2026-06-01T10:00:00Z", feito: "2026-07-02T10:00:00Z" }),
      linha({ criado: "2026-06-01T10:00:00Z" }),
    ];
    const d = desempenhoDe(linhas, { agora: AGORA });
    expect(d.conversao12Meses.valor).toBe(50);
    expect(d.conversao12Meses.variacao).toBeNull();
  });

  it("a média por mês divide pelos meses com dados; o melhor e o pior só entre esses", () => {
    const linhas = [
      linha({ criado: "2026-06-25T10:00:00Z" }), // início a meio de junho: junho não conta
      ...Array.from({ length: 10 }, () => linha({ criado: "2026-07-10T10:00:00Z" })),
      ...Array.from({ length: 20 }, () => linha({ criado: "2026-08-10T10:00:00Z" })),
      ...Array.from({ length: 30 }, () => linha({ criado: "2026-09-10T10:00:00Z" })),
      ...Array.from({ length: 40 }, () => linha({ criado: "2026-10-10T10:00:00Z" })),
    ];
    const d = desempenhoDe(linhas, { agora: AGORA });
    expect(d.entrados.mesesNaMedia).toBe(4);
    expect(d.entrados.mediaPorMes.valor).toBe(25);
    expect(d.extremos.entrados).toEqual({ melhor: "2026-10", pior: "2026-07" });
  });

  it("melhor e pior mês só entre os completos", () => {
    const linhas = [
      linha({ criado: "2025-01-01T10:00:00Z" }),
      ...Array.from({ length: 5 }, () => linha({ criado: "2026-04-10T10:00:00Z" })),
      ...Array.from({ length: 50 }, () => linha({ criado: "2026-11-10T10:00:00Z" })),
    ];
    const d = desempenhoDe(linhas, { agora: AGORA });
    expect(d.meses).toHaveLength(13);
    expect(d.meses[12].emCurso).toBe(true);
    expect(d.extremos.entrados?.melhor).toBe("2026-04");
    expect(d.extremos.realizados).toBeNull();
  });
});

describe("d41 — filtro por serviço e contas de teste", () => {
  it("o filtro tem os quatro grupos da fonte única", () => {
    expect(FILTROS_DO_DESEMPENHO.map((f) => f.id)).toEqual(["todos", ...GRUPOS_DE_SERVICOS.map((g) => g.id)]);
    expect(filtroValido("qualquer")).toBe("todos");
  });

  it("filtra pelo grupo do serviço, e as de teste saem sempre", () => {
    const linhas = [
      linha({ criado: "2026-11-01T10:00:00Z", servico: "recolha_monos" }),
      linha({ criado: "2026-11-01T10:00:00Z", servico: "mudanca" }),
      linha({ criado: "2026-11-01T10:00:00Z", servico: "esvaziamento_casa" }),
      linha({ criado: "2026-11-01T10:00:00Z", servico: "mudanca", deTeste: true }),
    ];
    expect(linhasDoFiltro(linhas, "todos")).toHaveLength(3);
    expect(linhasDoFiltro(linhas, "mudancas")).toHaveLength(1);
    expect(linhasDoFiltro(linhas, "recolhas")).toHaveLength(1);
    const d = desempenhoDe(linhas, { agora: AGORA, filtro: "mudancas" });
    expect(d.meses[12].entrados).toBe(1);
  });

  it("um pedido de teste não marca o início dos dados", () => {
    const d = desempenhoDe(
      [linha({ criado: "2020-01-01T10:00:00Z", deTeste: true }), linha({ criado: "2026-11-01T10:00:00Z" })],
      { agora: AGORA },
    );
    expect(d.inicioDosDados).toBe("2026-11-01");
  });
});

describe("d41 — hora de Lisboa", () => {
  it("23:30 UTC de 31-07 é 01-08 em Lisboa (Verão): conta em agosto, e à 0h", () => {
    const d = desempenhoDe([linha({ criado: "2026-07-31T23:30:00Z" })], { agora: AGORA });
    expect(d.meses.find((m) => m.mes === "2026-08")!.entrados).toBe(1);
    expect(d.meses.find((m) => m.mes === "2026-07")!.entrados).toBe(0);
    // 01-08-2026 é sábado → linha 5 (seg = 0); hora 0
    expect(d.mapa[5][0]).toBe(1);
    expect(d.totalNoMapa).toBe(1);
  });

  it("o «hoje» é o de Lisboa", () => {
    const d = desempenhoDe([], { agora: new Date("2026-11-15T23:59:00Z") });
    expect(d.hoje).toBe("2026-11-15");
    expect(d.dias).toHaveLength(90);
    expect(d.dias[89].dia).toBe("2026-11-15");
  });

  it("meses e rótulos", () => {
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(somarMeses("2026-11", -24)).toBe("2024-11");
    expect(rotuloDoMes("2026-10")).toBe("out 26");
  });
});

describe("d41 — as linhas da base", () => {
  it("pedido concluído: o feitoEm manda; o dia corrigido à mão manda sobre ele", () => {
    const base = { id: 1, createdAt: "2026-10-01 10:00:00", serviceType: "mudanca", status: "concluido", concluidoEm: "2026-10-05 10:00:00" };
    expect(linhaDoPedido({ ...base, feitoEm: "2026-10-03 18:00:00" }).realizadoEm?.toISOString()).toBe("2026-10-03T18:00:00.000Z");
    expect(linhaDoPedido({ ...base, feitoEm: "2026-10-03 18:00:00", concluidoEmManual: 1 }).realizadoEm?.toISOString()).toBe("2026-10-05T10:00:00.000Z");
    expect(linhaDoPedido({ ...base }).realizadoEm?.toISOString()).toBe("2026-10-05T10:00:00.000Z");
    // a base está em UTC
    expect(linhaDoPedido(base).criadoEm?.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  it("pedido por fazer, cancelado ou arquivado; contas de teste", () => {
    expect(linhaDoPedido({ id: 2, status: "pendente" }).realizadoEm).toBeNull();
    expect(linhaDoPedido({ id: 2, status: "cancelado" }).cancelado).toBe(true);
    expect(linhaDoPedido({ id: 2, status: "arquivado" }).cancelado).toBe(true);
    expect(linhaDoPedido({ id: 2, status: "pendente", feitoPorTeste: 1 }).deTeste).toBe(true);
    expect(linhaDoPedido({ id: 2, status: "pendente", soDeTeste: "1" }).deTeste).toBe(true);
    expect(linhaDoPedido({ id: 2, status: "pendente", contactName: "Teste" }).deTeste).toBe(true);
    expect(linhaDoPedido({ id: 2, status: "pendente", contactName: "Maria" }).deTeste).toBe(false);
  });

  it("pedido apagado pela purga: nasce pelo detalhe, feito pela confirmação, teste pelo profissional", () => {
    const retrato = {
      acontecimento: "pedido_expurgado",
      negociacaoId: null,
      servicoTipo: "recolha_moveis",
      detalheJson: JSON.stringify({
        criadoEm: "2026-07-01T09:00:00.000Z",
        negociacoes: [
          { providerId: 7, confirmadoEm: "2026-07-04T15:00:00.000Z" },
          { providerId: 8, confirmadoEm: null },
        ],
      }),
    };
    const l = linhaDoApagado(300, [retrato], new Set());
    expect(l?.criadoEm?.toISOString()).toBe("2026-07-01T09:00:00.000Z");
    expect(l?.realizadoEm?.toISOString()).toBe("2026-07-04T15:00:00.000Z");
    expect(l?.deTeste).toBe(false);
    expect(linhaDoApagado(300, [retrato], new Set([7]))?.deTeste).toBe(true);
    expect(linhaDoApagado(300, [{ acontecimento: "pedido_cancelado" }], new Set())).toBeNull();
  });

  it("apagado: o estado do arquivo manda (concluído à mão sem negociação, ou cancelado)", () => {
    const retrato = { acontecimento: "pedido_expurgado", negociacaoId: null, detalheJson: JSON.stringify({ criadoEm: "2026-07-01T09:00:00.000Z" }) };
    const feito = linhaDoApagado(5, [retrato], new Set(), { status: "concluido", concluidoEm: "2026-07-05T10:00:00.000Z" });
    expect(feito?.realizadoEm?.toISOString()).toBe("2026-07-05T10:00:00.000Z");
    expect(feito?.cancelado).toBe(false);
    const canc = linhaDoApagado(5, [retrato], new Set(), { status: "arquivado" });
    expect(canc?.cancelado).toBe(true);
    expect(canc?.realizadoEm).toBeNull();
  });

  it("apagado cancelado: o último cancelamento sem reabertura depois", () => {
    const retrato = { acontecimento: "pedido_expurgado", negociacaoId: null, detalheJson: JSON.stringify({ criadoEm: "2026-07-01T09:00:00.000Z" }) };
    const canc = { acontecimento: "pedido_cancelado", ocorridoEm: "2026-07-02 10:00:00" };
    const reab = { acontecimento: "pedido_reaberto", ocorridoEm: "2026-07-03 10:00:00" };
    expect(linhaDoApagado(1, [retrato, canc], new Set())?.cancelado).toBe(true);
    expect(linhaDoApagado(1, [retrato, canc, reab], new Set())?.cancelado).toBe(false);
  });
});
