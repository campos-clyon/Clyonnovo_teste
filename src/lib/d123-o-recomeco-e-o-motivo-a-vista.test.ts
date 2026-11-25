import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * d123, continuação (25-11-2026) — UM PEDIDO RECOMEÇADO DO ZERO FICAVA FORA DA
 * ROTINA DAS PROPOSTAS, E CALADO.
 *
 * O recomeço do zero REPÕE as mesmas negociações; a 1.ª proposta depois dele
 * tem a mesma chave (`proposta:<negociação>:1`) da 1.ª de antes, que já tinha
 * sido dita ao cliente. A rotina dava as novas por ditas, o estado era «já
 * enviado» e o cartão da Mesa não dizia nada. Agora:
 *
 *   · só conta como dita a chave registada DEPOIS da proposta;
 *   · ao dizê-la outra vez, a chave que já existia fica com a hora nova;
 *   · um pedido que a Mesa conta por enviar e a rotina não diz tem sempre uma
 *     linha no cartão (já ouvidas, a base falhou, o envio não leu o pedido).
 *
 * A base e o WhatsApp estão FINGIDOS: nenhuma mensagem sai a ninguém.
 * Números, nomes e telefones INVENTADOS (o repositório é público).
 */

const base = vi.hoisted(() => ({
  pedidosDaMesa: [] as Array<Record<string, unknown>>,
  ditas: [] as Array<{ chave: string; enviadoEm: string | null }>,
  falhaAsDitas: false,
  falhaOEnvio: false,
  sql: [] as Array<{ sql: string; args: unknown[] }>,
}));

vi.mock("./novo-modelo-no-servidor", () => ({
  negociacoesNoNovoModelo: vi.fn(async () => new Set<number>()),
  regimesDasNegociacoes: vi.fn(async () => new Map()),
}));

vi.mock("./db", async (original) => {
  const pool = {
    execute: async (sql: string, args: unknown[] = []) => {
      base.sql.push({ sql, args });
      if (/FROM envioDasPropostasAoCliente WHERE pedidoId IN/.test(sql)) {
        if (base.falhaOEnvio) throw new Error("base em baixo (fingida)");
        return [[], []];
      }
      if (/FROM assistenteAvisos WHERE chave IN/.test(sql)) {
        if (base.falhaAsDitas) throw Object.assign(new Error("base em baixo (fingida)"), { code: "ECONNRESET" });
        return [base.ditas, []];
      }
      if (/^\s*(UPDATE|INSERT)/.test(sql)) return [{ affectedRows: 1 }, []];
      return [[], []];
    },
    query: async () => [[], []],
  };
  return {
    ...(await original<typeof import("./db")>()),
    getPool: async () => pool,
    ensureRegistoTable: async () => {},
    numeroInterrompidoWhatsApp: async () => false,
    numeroBloqueadoWhatsApp: async () => false,
    mensagensDoNumeroWhatsApp: async () => [],
    linguaDoNumero: async () => null,
    guardarLinguaDoNumero: async () => {},
    pedidosComNegociacoes: async () => base.pedidosDaMesa,
    parceirosParaOValorUnico: async () => new Map(),
    reservarAvisoDoAssistente: async () => ({ id: null, jaExistia: true }),
    fecharAvisoDoAssistente: async () => {},
  };
});

import {
  aPropostaJaFoiDita,
  estadoDoEnvio,
  LINHA_DAS_JA_DITAS,
  LINHA_DO_ENVIO_POR_LER,
  linhaDoEnvioNaMesa,
  MOTIVOS_COM_UMA_PESSOA,
  type PedidoParaOEnvio,
} from "./envio-das-propostas-ao-cliente";

const MIN = 60_000;
const mais = (d: Date, m: number) => new Date(d.getTime() + m * MIN);
/** 25-11-2026, 15h00 em Lisboa (UTC no Inverno). */
const AGORA = new Date("2026-11-25T15:00:00Z");
const naBase = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

const envio = (o: Partial<PedidoParaOEnvio> = {}): PedidoParaOEnvio => ({
  pedidoId: 9124,
  parceiros: 1,
  primeiraEm: mais(AGORA, -90),
  ultimaMudancaEm: mais(AGORA, -90),
  jaEnviado: false,
  base: "total",
  melhorComIva: 98.4,
  temTelemovel: true,
  novas: 1,
  ...o,
});

const negociacao = (id: number, nome: string, valor: number, criadaEm: Date) => ({
  id,
  providerId: 600 + id,
  profissionalNome: nome,
  profissionalEmail: null,
  estado: "aberta",
  valorAcordado: null,
  propostasJson: JSON.stringify([{ por: "profissional", valor, estado: "pendente", criadaEm: criadaEm.toISOString() }]),
  execucaoEnviadaEm: null,
  provaJson: null,
  confirmadoEm: null,
  pagoEm: null,
  estrelas: null,
  avaliadoEm: null,
  criadaEm: naBase(mais(AGORA, -600)),
  actualizadaEm: naBase(criadaEm),
});

/** Orçamento à mão há 7 h; recomeçado do zero; as duas propostas novas há 40 e 30 min. */
const recomecado = (o: Record<string, unknown> = {}) => ({
  id: 9124,
  serviceType: "recolha_monos",
  city: "Almada",
  contactName: "Rui Inventado",
  contactEmail: null,
  contactPhone: "912345678",
  address: null,
  postalCode: null,
  valorDesejadoCliente: null,
  baseDoPreco: "total",
  origem: "backoffice",
  status: "sem_assistente",
  propostaEnviadaEm: naBase(mais(AGORA, -420)),
  valorUnicoCliente: null,
  escolhidosJson: null,
  horasPrevistas: 3,
  negociacoes: [negociacao(11, "Recolhas Inventadas", 80, mais(AGORA, -40)), negociacao(12, "Transportes Exemplo", 100, mais(AGORA, -30))],
  ...o,
});

describe("a proposta já foi dita? (pura)", () => {
  it("só o registo de depois da proposta a cala; sem registo, não; sem horas, sim", () => {
    const t = AGORA.getTime();
    expect(aPropostaJaFoiDita(undefined, t)).toBe(false);
    expect(aPropostaJaFoiDita(t - 6 * 3600_000, t)).toBe(false); // dita antes do recomeço
    expect(aPropostaJaFoiDita(t + 60_000, t)).toBe(true);
    expect(aPropostaJaFoiDita(t - 500, t)).toBe(true); // a base guarda ao segundo
    expect(aPropostaJaFoiDita(null, t)).toBe(true);
    expect(aPropostaJaFoiDita(t, null)).toBe(true);
  });
});

describe("nunca fora sem um motivo no cartão (pura)", () => {
  it("nada por dizer, mas a Mesa conta-as por enviar: a linha diz que o cliente já as ouviu", () => {
    const e = estadoDoEnvio(envio({ novas: 0 }), AGORA);
    expect(e).toEqual({ tipo: "ja_enviado", porque: "ditas" });
    expect(linhaDoEnvioNaMesa(e, true)).toContain(LINHA_DAS_JA_DITAS);
  });

  it("a base não disse o que já foi dito: fica, e diz porquê", () => {
    const e = estadoDoEnvio(envio({ novas: 0, ditasPorLer: true }), AGORA);
    expect(e).toEqual({ tipo: "fica", motivo: "ditas_por_ler" });
    expect(linhaDoEnvioNaMesa(e, true)).toContain(MOTIVOS_COM_UMA_PESSOA.ditas_por_ler);
  });

  it("depois de aceitar continua calado (não está por enviar)", () => {
    expect(linhaDoEnvioNaMesa(estadoDoEnvio(envio({ fechado: true }), AGORA), true)).toBeNull();
  });
});

describe("na base (fingida): o recomeço do zero", { timeout: 60_000 }, () => {
  beforeEach(() => {
    base.pedidosDaMesa = [];
    base.ditas = [];
    base.falhaAsDitas = false;
    base.falhaOEnvio = false;
    base.sql = [];
  });

  it("as chaves ditas antes do recomeço não calam as propostas novas: vão como a 1.ª, numa lista", async () => {
    base.ditas = [
      { chave: "proposta:11:1", enviadoEm: naBase(mais(AGORA, -480)) },
      { chave: "proposta:12:1", enviadoEm: naBase(mais(AGORA, -480)) },
    ];
    base.pedidosDaMesa = [recomecado()];
    const { candidatosAoEnvio } = await import("./envio-das-propostas-ao-cliente-na-base");
    const [c] = await candidatosAoEnvio(AGORA);
    expect(c.porDizer).toBe(2);
    expect(c.nova).toBe(false);
    expect(c.texto).toContain("Recolhas Inventadas");
    expect(c.texto).toContain("Transportes Exemplo");
    expect(c.estado).toMatchObject({ tipo: "sai", agora: true });
  });

  it("ditas depois de chegarem: não saem outra vez, e o cartão diz porquê", async () => {
    base.ditas = [
      { chave: "proposta:11:1", enviadoEm: naBase(mais(AGORA, -20)) },
      { chave: "proposta:12:1", enviadoEm: naBase(mais(AGORA, -20)) },
    ];
    base.pedidosDaMesa = [recomecado()];
    const { ensaioDasPropostas } = await import("./envio-das-propostas-ao-cliente-na-base");
    const { pedidos } = await ensaioDasPropostas(AGORA);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].linha).toContain(LINHA_DAS_JA_DITAS);
  });

  it("a base falha ao ler o que foi dito: nada sai, e o cartão diz porquê", async () => {
    base.falhaAsDitas = true;
    base.pedidosDaMesa = [recomecado()];
    const { candidatosAoEnvio, ensaioDasPropostas } = await import("./envio-das-propostas-ao-cliente-na-base");
    const [c] = await candidatosAoEnvio(AGORA);
    expect(c.estado).toEqual({ tipo: "fica", motivo: "ditas_por_ler" });
    const { pedidos } = await ensaioDasPropostas(AGORA);
    expect(pedidos[0].linha).toContain(MOTIVOS_COM_UMA_PESSOA.ditas_por_ler);
  });

  it("o envio automático não lê o pedido: a Mesa diz isso no cartão de quem tem propostas por enviar", async () => {
    base.falhaOEnvio = true;
    const pedido = recomecado();
    const { linhasDoEnvioNaMesa } = await import("./envio-das-propostas-ao-cliente-na-base");
    const linhas = await linhasDoEnvioNaMesa(AGORA, [pedido]);
    expect(linhas.get(9124)).toBe(LINHA_DO_ENVIO_POR_LER);
  });

  it("ao dizer outra vez uma chave que já existia, ela fica com a hora nova", async () => {
    const { marcarPropostasDitas } = await import("./envio-das-propostas-ao-cliente-na-base");
    await marcarPropostasDitas("912345678", 9124, [{ chave: "proposta:11:1", negociacaoId: 11 }]);
    const u = base.sql.find((x) => /UPDATE assistenteAvisos SET enviadoEm = UTC_TIMESTAMP\(\)/.test(x.sql));
    expect(u?.args).toEqual([9124, 11, "proposta:11:1"]);
  });
});
