import { beforeAll, describe, expect, it, vi } from "vitest";
import type { TrabalhoNaCarteira } from "./carteira";
import { podeEstarNoModeloNovo, podeTerDividaParaAClyon } from "./quem-pode-ter-divida";
import { porCobrarDasDividasNasLinhas } from "./a-quem-foi-o-dinheiro";

/*
 * d125 (CEO e dono, 25-11-2026): Pagamentos › «A receber dos profissionais»
 * dizia 0,00 € com um parceiro a dever o valor do modelo de 15-11 (o cliente
 * pagou-lhe, ele passa à CLYON a taxa e o IVA dela) — o pré-filtro dos
 * candidatos só via o dinheiro, o «pago ao profissional» e a folha final.
 * Valores inventados (o repositório é público): 100 € a 13 % → 13 € de taxa e
 * 2,99 € de IVA dela = 15,99 € a passar à CLYON.
 *
 * O relógio: datas explícitas — cada chamada recebe `agora` (25-11-2026, ou o dia
 * antes do modelo), nunca o relógio verdadeiro.
 */

const NOVO = { pid: 41, neg: 4101, pedido: 9101 };
const ANTIGO = { pid: 42, neg: 4201, pedido: 9201 };
const FORA = { pid: 43, neg: 4301, pedido: 9301 };
const agora = new Date("2026-11-25T19:00:00Z");

/** As linhas que a consulta dos candidatos devolve (uma por negociação acordada). */
const candidatas = [
  // Do modelo de 15-11: confirmado hoje, pela plataforma, sem pagamento à CLYON.
  { providerId: NOVO.pid, formaDePagamento: "na_plataforma", execucaoEnviadaEm: "2026-11-25 16:19:49", confirmadoEm: "2026-11-25 18:04:22", pagoEm: null, pagoAoProfissional: 0, folhaFinalDepoisDePago: 0 },
  // Do antigo: registado «pago ao profissional» antes de 15-11.
  { providerId: ANTIGO.pid, formaDePagamento: "na_plataforma", execucaoEnviadaEm: "2026-11-09 12:00:00", confirmadoEm: "2026-11-10 12:18:15", pagoEm: null, pagoAoProfissional: 1, folhaFinalDepoisDePago: 0 },
  // Pago pela plataforma e fechado em outubro: não pode ter nada a passar.
  { providerId: FORA.pid, formaDePagamento: "na_plataforma", execucaoEnviadaEm: "2026-10-18 10:00:00", confirmadoEm: "2026-10-20 10:00:00", pagoEm: "2026-10-22 10:00:00", pagoAoProfissional: 0, folhaFinalDepoisDePago: 0 },
];

const trabalhos: Record<number, TrabalhoNaCarteira> = {
  [NOVO.neg]: {
    negociacaoId: NOVO.neg,
    pedidoId: NOVO.pedido,
    noNovoModelo: true,
    estado: "acordada",
    valorAcordado: 100,
    taxaCliente: 0,
    taxaProfissional: 0.13,
    formaDePagamento: "na_plataforma",
    execucaoEnviadaEm: "2026-11-25T16:19:49Z",
    confirmadoEm: "2026-11-25T18:04:22Z",
    pagoEm: null,
    negociacaoCriadaEm: "2026-11-20T09:00:00Z",
  } as TrabalhoNaCarteira,
  [ANTIGO.neg]: {
    negociacaoId: ANTIGO.neg,
    pedidoId: ANTIGO.pedido,
    estado: "acordada",
    valorAcordado: 370,
    taxaCliente: 0,
    taxaProfissional: 0.15,
    formaDePagamento: "na_plataforma",
    comoEntrou: "ao_profissional",
    valorQueEntrou: 370,
    execucaoEnviadaEm: "2026-11-09T12:00:00Z",
    confirmadoEm: "2026-11-10T12:18:15Z",
    pagoEm: null,
    clientePagouEm: "2026-11-10T13:16:24Z",
    negociacaoCriadaEm: "2026-11-05T09:00:00Z",
  } as TrabalhoNaCarteira,
};

const lidos = vi.hoisted(() => ({ profissionais: [] as number[], sql: [] as string[] }));

vi.mock("./db", () => {
  const negs: Record<number, number> = { 41: 4101, 42: 4201, 43: 4301 };
  const pedidos: Record<number, number> = { 4101: 9101, 4201: 9201, 4301: 9301 };
  return {
    getPool: async () => ({
      execute: async (sql: string) => {
        lidos.sql.push(sql);
        if (/FROM negociacoes n\s+WHERE n\.estado = 'acordada'/.test(sql)) {
          // A base fingida cumpre o WHERE de antes (só dinheiro, pago ao profissional ou folha final), se lho pedirem.
          const soOsDeAntes = /WHERE[\s\S]*formaDePagamento = 'dinheiro'/.test(sql);
          const linhas = soOsDeAntes
            ? candidatas.filter((c) => c.formaDePagamento === "dinheiro" || c.pagoAoProfissional === 1 || c.folhaFinalDepoisDePago === 1)
            : candidatas;
          return [linhas, []];
        }
        return [[], []];
      },
    }),
    toMySQLDateTime: (d: Date) => d.toISOString(),
    negociacoesDoProfissional: async (pid: number) => {
      lidos.profissionais.push(pid);
      const id = negs[pid];
      return id ? [{ id, pedidoId: pedidos[id], contactName: null, serviceType: null }] : [];
    },
    registar: async () => undefined,
    appendOrderHistory: async () => undefined,
  };
});
vi.mock("./folha-final-na-base", () => ({ ensureFolhasFinais: async () => undefined }));
vi.mock("./carteira-do-profissional", () => ({
  trabalhosDaCarteira: async (linhas: Array<{ id: number }>) => linhas.map((l) => trabalhos[l.id]).filter(Boolean),
}));

let dividasDosProfissionais: typeof import("./cobrancas-na-base").dividasDosProfissionais;
beforeAll(async () => {
  ({ dividasDosProfissionais } = await import("./cobrancas-na-base"));
}, 120_000);

describe("d125: quem entra na conta de «A receber dos profissionais»", () => {
  it("o parceiro do modelo de 15-11 aparece, com o valor a passar à CLYON", async () => {
    const mapa = await dividasDosProfissionais(undefined, agora);
    const dele = mapa.get(NOVO.pid);
    expect(dele).toBeDefined();
    expect(dele).toHaveLength(1);
    expect(dele![0]).toMatchObject({ negociacaoId: NOVO.neg, pedidoId: NOVO.pedido, novoModelo: true, paga: false });
    expect(dele![0].porPagar).toBe(15.99);
  });

  it("os antigos continuam (pago ao profissional), e quem não pode dever nem é lido", async () => {
    lidos.profissionais = [];
    const mapa = await dividasDosProfissionais(undefined, agora);
    expect(mapa.get(ANTIGO.pid)?.[0]).toMatchObject({ negociacaoId: ANTIGO.neg, aParte: true, paga: false });
    expect(mapa.get(ANTIGO.pid)![0].porPagar).toBeGreaterThan(0);
    expect(lidos.profissionais.sort()).toEqual([NOVO.pid, ANTIGO.pid].sort());
    expect(mapa.has(FORA.pid)).toBe(false);
  });

  it("o pré-filtro: dinheiro, pago ao profissional, folha final e o modelo novo; nunca um antigo pago pela plataforma", () => {
    expect(podeTerDividaParaAClyon({ formaDePagamento: "dinheiro", confirmadoEm: "2026-10-05 10:00:00" }, agora)).toBe(true);
    expect(podeTerDividaParaAClyon({ formaDePagamento: "na_plataforma", pagoAoProfissional: 1 }, agora)).toBe(true);
    expect(podeTerDividaParaAClyon({ formaDePagamento: "na_plataforma", folhaFinalDepoisDePago: "1" }, agora)).toBe(true);
    expect(podeTerDividaParaAClyon(candidatas[0], agora)).toBe(true);
    expect(podeTerDividaParaAClyon(candidatas[2], agora)).toBe(false);
    // Por fazer (sem «está feito»), ainda não deve nada.
    expect(podeTerDividaParaAClyon({ formaDePagamento: "na_plataforma" }, agora)).toBe(false);
    // O «está feito» a 10-11 ainda fecha depois de 15-11 pelo prazo: entra (a conta decide).
    expect(podeEstarNoModeloNovo({ execucaoEnviadaEm: "2026-11-10 09:00:00" }, agora)).toBe(true);
    // Antes do modelo, nunca.
    expect(podeEstarNoModeloNovo({ confirmadoEm: "2026-11-14 09:00:00" }, new Date("2026-11-14T10:00:00Z"))).toBe(false);
  });

  it("o cartão «Pagos em mão» diz o mesmo que «A receber»: só as dívidas nascidas, só as do separador", () => {
    const linhas = [{ negociacaoId: NOVO.neg }, { negociacaoId: 4999 }];
    const dividas = [
      { negociacaoId: NOVO.neg, porPagar: 15.99 },
      { negociacaoId: ANTIGO.neg, porPagar: 12.5 },
    ];
    expect(porCobrarDasDividasNasLinhas(linhas, dividas)).toBe(15.99);
    expect(porCobrarDasDividasNasLinhas(linhas, null)).toBe(0);
  });
});
