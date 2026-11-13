import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCAO_DO_FECHO,
  FECHO_DO_MODELO_NOVO_DESDE,
  PERGUNTA_DO_FECHO,
  faseDoFecho,
  linhasDoFecho,
  perguntaAoClienteAgora,
  perguntaDoFechoParaOCliente,
  type TrabalhoParaOFecho,
} from "./fecho-do-modelo-novo";
import { NOVO_MODELO_DESDE } from "./novo-modelo";
import { doNossoLado } from "./do-nosso-lado";
import { avisosDoNossoLado, correrOsAvisosDaEquipa, type AvisoAEquipa } from "./avisos-a-equipa";
import { dividasDe, type TrabalhoNaCarteira } from "./carteira";
import { taxaAPassarAClyon } from "./taxa-a-passar-a-clyon";

/*
 * d15 (CEO e dono, 13-11-2026) — O TRABALHO DO MODELO NOVO FECHA SEM DEPENDER
 * SÓ DO PARCEIRO. As três regras, com o relógio simulado:
 *
 *   1. 24 h depois da data, contratado e sem «Está feito» → linha na Mesa e
 *      aviso à equipa;
 *   2. 48 h depois → a pergunta ao cliente; o «Sim» fecha (transacção) e a taxa
 *      nasce;
 *   3. a conta do parceiro com valores por pagar não se elimina.
 *
 * E o email ao cliente atrás de um interruptor DESLIGADO por omissão.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const H = 3600 * 1000;
/** A data do trabalho: dia 16-11 às 09h00 de Lisboa (= UTC em Novembro). */
const DATA = new Date("2026-11-16T09:00:00Z");
const depois = (horas: number) => new Date(DATA.getTime() + horas * H);

function trabalho(extra: Partial<TrabalhoParaOFecho> = {}): TrabalhoParaOFecho {
  return {
    pedidoId: 501,
    negociacaoId: 900,
    estado: "acordada",
    dataCombinada: DATA.toISOString(),
    dataAgendada: null,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    estadoDoPedido: "em_curso",
    noNovoModelo: true,
    respondeuNaoEm: null,
    ...extra,
  };
}

describe("regra 1 e 2 — as horas, pela data única do modelo", () => {
  it("a data é a de novo-modelo.ts, nunca outra", () => {
    expect(FECHO_DO_MODELO_NOVO_DESDE.getTime()).toBe(NOVO_MODELO_DESDE.getTime());
  });

  it("antes de 15-11 nada acontece, mesmo com a data passada há dias", () => {
    const antes = trabalho({ dataCombinada: "2026-11-10T09:00:00Z" });
    expect(faseDoFecho(antes, new Date("2026-11-14T23:59:00Z"))).toBe("nada");
    expect(linhasDoFecho([antes], new Date("2026-11-14T23:59:00Z"))).toEqual([]);
    expect(faseDoFecho(antes, new Date("2026-11-15T00:00:00Z"))).toBe("pergunta");
  });

  it("23 h: nada; 24 h: Mesa; 47 h: Mesa; 48 h: pergunta", () => {
    expect(faseDoFecho(trabalho(), depois(23.9))).toBe("nada");
    expect(faseDoFecho(trabalho(), depois(24))).toBe("mesa");
    expect(faseDoFecho(trabalho(), depois(47.9))).toBe("mesa");
    expect(faseDoFecho(trabalho(), depois(48))).toBe("pergunta");
  });

  it("sem a data combinada vale a que o cliente pediu", () => {
    const t = trabalho({ dataCombinada: null, dataAgendada: DATA.toISOString() });
    expect(faseDoFecho(t, depois(25))).toBe("mesa");
    expect(faseDoFecho(trabalho({ dataCombinada: null }), depois(100))).toBe("nada");
  });

  it("fora do modelo novo, com «Está feito», confirmado, por contratar ou com o pedido arrumado: nada", () => {
    const agora = depois(72);
    expect(faseDoFecho(trabalho({ noNovoModelo: false }), agora)).toBe("nada");
    expect(faseDoFecho(trabalho({ execucaoEnviadaEm: depois(30).toISOString() }), agora)).toBe("nada");
    expect(faseDoFecho(trabalho({ confirmadoEm: depois(30).toISOString() }), agora)).toBe("nada");
    expect(faseDoFecho(trabalho({ estado: "aberta" }), agora)).toBe("nada");
    for (const s of ["cancelado", "arquivado", "concluido", "rejeitado"]) {
      expect(faseDoFecho(trabalho({ estadoDoPedido: s }), agora), s).toBe("nada");
    }
  });

  it("«Ainda não» cala a pergunta 48 h, e ela volta depois", () => {
    const t = trabalho({ respondeuNaoEm: depois(50).toISOString() });
    expect(perguntaAoClienteAgora(t, depois(60))).toBe(false);
    expect(perguntaAoClienteAgora(t, depois(98))).toBe(true);
  });

  it("a pergunta vai escrita, com a acção que as três portas aceitam", () => {
    const p = perguntaDoFechoParaOCliente(trabalho(), "Ana Parceira", depois(48));
    expect(p).toMatchObject({ negociacaoId: 900, accao: ACCAO_DO_FECHO, pergunta: PERGUNTA_DO_FECHO });
    expect(p?.explicacao).toContain("Ana");
    expect(perguntaDoFechoParaOCliente(trabalho(), "Ana", depois(47))).toBeNull();
    expect(ler("src/lib/agir-como-cliente.ts")).toContain(`  "${ACCAO_DO_FECHO}",`);
  });
});

describe("regra 1 — a linha na Mesa e o aviso à equipa às 24 h", () => {
  const vazio = { conversas: null, pedidos: [], trabalhosClyon: [] };

  it("o grupo «sem_fecho» do Do nosso lado acende às 24 h, e não antes", () => {
    const g23 = doNossoLado({ ...vazio, semFecho: [trabalho()], agora: depois(23) });
    expect(g23.find((g) => g.tipo === "sem_fecho")?.linhas).toEqual([]);
    const g24 = doNossoLado({ ...vazio, semFecho: [trabalho()], agora: depois(24.5) });
    const linhas = g24.find((g) => g.tipo === "sem_fecho")?.linhas ?? [];
    expect(linhas).toHaveLength(1);
    expect(linhas[0].pedidoId).toBe(501);
    expect(linhas[0].aviso).toContain("#501");
  });

  it("um pedido no grupo do modelo novo sai do «data passada» (a mesma espera, uma linha só)", () => {
    const pedido = {
      id: 501,
      status: "em_curso",
      origem: null,
      contactEmail: null,
      dataAgendada: null,
      negociacoes: [{ estado: "acordada", propostasJson: null, dataCombinada: DATA.toISOString(), execucaoEnviadaEm: null, confirmadoEm: null }],
    };
    const sem = doNossoLado({ conversas: null, pedidos: [pedido], trabalhosClyon: [], agora: depois(30) });
    expect(sem.find((g) => g.tipo === "data_passada")?.linhas.map((l) => l.pedidoId)).toEqual([501]);
    const com = doNossoLado({ conversas: null, pedidos: [pedido], trabalhosClyon: [], semFecho: [trabalho()], agora: depois(30) });
    expect(com.find((g) => g.tipo === "data_passada")?.linhas).toEqual([]);
    expect(com.find((g) => g.tipo === "sem_fecho")?.linhas.map((l) => l.pedidoId)).toEqual([501]);
  });

  it("o aviso à equipa sai uma vez, para a Mesa, em horário", async () => {
    // 16-11 09h + 25 h = 17-11 às 10h de Lisboa: em horário.
    const agora = depois(25);
    const linhas = doNossoLado({ ...vazio, semFecho: [trabalho()], agora }).flatMap((g) => g.linhas);
    const avisos = avisosDoNossoLado(linhas, agora);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ seccao: "mesa", pedidoId: 501, chave: "nosso_lado:sem_fecho:p501" });

    const enviados: AvisoAEquipa[] = [];
    const reservados = new Set<string>();
    const deps = {
      lerDoNossoLado: async () => linhas,
      lerPorDecidir: async () => [],
      reservar: async (a: AvisoAEquipa) => (reservados.has(a.chave) ? false : (reservados.add(a.chave), true)),
      entregasPorEnviar: async () => [],
      aindaEntregue: async () => false,
      marcarEnviado: async () => {},
      enviar: async (a: AvisoAEquipa) => (enviados.push(a), 1),
    };
    await correrOsAvisosDaEquipa(deps, agora);
    await correrOsAvisosDaEquipa(deps, new Date(agora.getTime() + 10 * 60 * 1000));
    expect(enviados.map((a) => a.pedidoId)).toEqual([501]);
  });

  it("a leitura da Mesa e dos avisos é a mesma, e o selo da Mesa conta-a", () => {
    expect(ler("src/lib/avisos-a-equipa-na-base.ts")).toContain("trabalhosSemFechoNaBase(agora)");
    expect(ler("src/components/admin/DoNossoLado.tsx")).toContain('fetch("/api/admin/negociacoes/sem-fecho"');
    const db = ler("src/lib/db.ts");
    const i = db.indexOf("export async function contarPorFazer(");
    const corpo = db.slice(i, db.indexOf("\n}\n", i));
    expect(corpo).toContain("trabalhosSemFechoNaBase(agora)");
    expect(corpo).toContain("saida.negociacoes_clyon =");
    expect(ler("src/components/admin/LegacyAdminClient.tsx")).toContain("+ porFazerNosPedidos");
  });

  it("antes de 15-11 a leitura da base nem lá vai", () => {
    const f = ler("src/lib/fecho-do-modelo-novo-na-base.ts");
    const i = f.indexOf("export async function trabalhosSemFechoNaBase(");
    expect(f.slice(i, i + 400)).toContain("if (!novoModeloEmVigor(agora)) return [];");
  });
});

/* ── Regra 2: o «Sim» fecha e a taxa nasce ──────────────────────────────── */

const escritas: Array<{ sql: string; params: unknown[] }> = [];
const conta = { commit: 0, rollback: 0, linhas: 1 as number, statusDoPedido: "em_curso" as string };
const avisados: Array<{ pedidoId: number; negociacaoId: number }> = [];
const historico: string[] = [];
const depoisDaResposta = vi.hoisted(() => [] as Array<Promise<unknown>>);
const negociacao = {
  id: 900,
  pedidoId: 501,
  estado: "acordada",
  dataCombinada: DATA.toISOString(),
  execucaoEnviadaEm: null as string | null,
  confirmadoEm: null as string | null,
  profissionalNome: "Ana Parceira",
  ofertaClyon: null,
  fechoNaoEm: null,
};

vi.mock("./db", () => {
  const conn = {
    beginTransaction: async () => {},
    commit: async () => {
      conta.commit++;
    },
    rollback: async () => {
      conta.rollback++;
    },
    release: () => {},
    execute: async (sql: string, params: unknown[] = []) => {
      escritas.push({ sql, params });
      if (/^SELECT status FROM simulatorOrders/.test(sql.trim())) return [[{ status: conta.statusDoPedido }], []];
      return [{ affectedRows: conta.linhas }, []];
    },
  };
  return {
    ensureNegociacoesTable: async () => {},
    ensureSimulatorOrdersTable: async () => {},
    ensureRegistoTable: async () => {},
    getPool: async () => ({
      getConnection: async () => conn,
      execute: async (sql: string, params: unknown[] = []) => {
        escritas.push({ sql, params });
        return [{ affectedRows: conta.linhas }, []];
      },
    }),
    getSimulatorOrderById: async () => ({ id: 501, status: conta.statusDoPedido, dataAgendada: null, contactEmail: "cliente@exemplo.pt" }),
    negociacoesDoPedido: async () => [negociacao],
    registarNaTransaccao: async (_c: unknown, l: { acontecimento: string }) => {
      escritas.push({ sql: `REGISTO ${l.acontecimento}`, params: [] });
    },
    registarSemFalhar: async () => {},
    appendOrderHistory: async (_id: number, h: { message: string }) => {
      historico.push(h.message);
    },
  };
});
vi.mock("./novo-modelo-no-servidor", () => ({ segueONovoModelo: async () => true }));
vi.mock("./avisar-confirmacao", () => ({
  avisarProfissionalTrabalhoConfirmado: async (d: { pedidoId: number; negociacaoId: number }) => {
    avisados.push(d);
  },
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    depoisDaResposta.push(Promise.resolve().then(fn));
  },
}));

describe("regra 2 — «O trabalho já foi feito?» → «Sim» fecha e a taxa nasce", () => {
  beforeEach(() => {
    escritas.length = 0;
    avisados.length = 0;
    historico.length = 0;
    conta.commit = 0;
    conta.rollback = 0;
    conta.linhas = 1;
    conta.statusDoPedido = "em_curso";
  });

  it("às 48 h, o «Sim» entrega e confirma NUMA transacção, com as guardas da d27, e avisa (a referência da taxa)", async () => {
    const { responderAoFecho } = await import("./fecho-do-modelo-novo-na-base");
    const r = await responderAoFecho({ negociacaoId: 900, pedidoId: 501, resposta: "sim", onde: "na app", agora: depois(49) });
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ ok: true, confirmado: true });
    const sql = escritas.map((e) => e.sql.replace(/\s+/g, " "));
    const entregue = sql.findIndex((s) => s.includes("SET execucaoEnviadaEm = NOW()"));
    const confirmado = sql.findIndex((s) => s.includes("SET confirmadoEm = NOW(), confirmadoPor = 'cliente'"));
    expect(entregue).toBeGreaterThan(-1);
    expect(confirmado).toBeGreaterThan(entregue);
    expect(sql[entregue]).toContain("estado = 'acordada' AND execucaoEnviadaEm IS NULL AND confirmadoEm IS NULL");
    expect(sql[confirmado]).toContain("(horasMarcadasEm IS NULL OR horasConfirmadasEm IS NOT NULL)");
    expect(sql).toContain("REGISTO execucao_confirmada");
    expect(conta.commit).toBe(1);
    expect(conta.rollback).toBe(0);
    await Promise.all(depoisDaResposta);
    expect(avisados).toEqual([{ pedidoId: 501, negociacaoId: 900 }]);
  });

  it("às 47 h ainda não se aceita (409), e nada se escreve", async () => {
    const { responderAoFecho } = await import("./fecho-do-modelo-novo-na-base");
    const r = await responderAoFecho({ negociacaoId: 900, pedidoId: 501, resposta: "sim", onde: "na app", agora: depois(47) });
    expect(r.status).toBe(409);
    expect(escritas.filter((e) => /^\s*UPDATE\b/.test(e.sql))).toEqual([]);
    expect(avisados).toEqual([]);
  });

  it("se a confirmação não muda nada (horas por confirmar, outro fechou primeiro), desfaz tudo", async () => {
    const { fecharPeloClienteSemEstaFeito } = await import("./fecho-do-modelo-novo-na-base");
    conta.linhas = 0;
    expect(await fecharPeloClienteSemEstaFeito(900, 501, "na app")).toBe(false);
    expect(conta.commit).toBe(0);
    expect(conta.rollback).toBe(1);
  });

  it("um pedido fechado (cancelado) não se mexe", async () => {
    const { fecharPeloClienteSemEstaFeito } = await import("./fecho-do-modelo-novo-na-base");
    conta.statusDoPedido = "cancelado";
    expect(await fecharPeloClienteSemEstaFeito(900, 501, "na app")).toBe(false);
    expect(escritas.filter((e) => /^\s*UPDATE\b/.test(e.sql))).toEqual([]);
  });

  it("«Ainda não» fica escrito e não fecha nada", async () => {
    const { responderAoFecho } = await import("./fecho-do-modelo-novo-na-base");
    const r = await responderAoFecho({ negociacaoId: 900, pedidoId: 501, resposta: "nao", onde: "na app", agora: depois(49) });
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ ok: true, fecho: "nao" });
    expect(escritas.some((e) => e.sql.includes("SET fechoNaoEm = NOW()"))).toBe(true);
    expect(escritas.some((e) => e.sql.includes("SET confirmadoEm"))).toBe(false);
    expect(avisados).toEqual([]);
  });

  it("fechado, a taxa nasce: a carteira passa a ver o valor por pagar (a taxa e o IVA dela)", () => {
    const fechado: TrabalhoNaCarteira = {
      negociacaoId: 900,
      estado: "acordada",
      valorAcordado: 350,
      taxaCliente: 0,
      taxaProfissional: 0.1,
      formaDePagamento: "na_plataforma",
      execucaoEnviadaEm: depois(49).toISOString(),
      confirmadoEm: depois(49).toISOString(),
      negociacaoCriadaEm: "2026-11-15T12:00:00Z",
      clientePagouEm: null,
      noNovoModelo: true,
    } as TrabalhoNaCarteira;
    const aberto = { ...fechado, execucaoEnviadaEm: null, confirmadoEm: null } as TrabalhoNaCarteira;
    expect(dividasDe([aberto], depois(49))).toEqual([]);
    const [d] = dividasDe([fechado], depois(50));
    const taxa = taxaAPassarAClyon(350, { cliente: 0, profissional: 0.1 } as never);
    expect(d?.novoModelo).toBe(true);
    expect(d?.porPagar).toBeCloseTo(taxa?.total ?? -1, 2);
    expect(d?.porPagar).toBeGreaterThan(0);
  });

  it("a confirmação gera a referência da taxa no modelo novo (o mesmo aviso de qualquer confirmação)", () => {
    const f = ler("src/lib/avisar-confirmacao.ts");
    expect(f).toContain("lido?.noNovoModelo === true");
    expect(f).toContain("taxaAPassarAClyon(valor, taxas)");
    expect(f).toContain("await gerarReferenciaDaDivida(dados.negociacaoId");
  });

  it("as três portas do cliente e o link do email passam pela mesma função", () => {
    const agir = ler("src/lib/agir-como-cliente.ts");
    expect(agir).toContain("if (accao === ACCAO_DO_FECHO)");
    expect(agir).toContain("return responderAoFecho({");
    const link = ler("src/app/api/pedido/fecho/[token]/route.ts");
    expect(link).toContain("export async function POST(");
    expect(link).not.toContain("export async function GET(");
    expect(link).toContain("responderAoFecho({");
  });

  it("a R5 (app de cliente) leva a pergunta pronta e a acção", () => {
    const app = ler("src/lib/pedido-para-a-app.ts");
    expect(app).toContain("perguntaDoFecho: n.perguntaDoFecho ?? null,");
    expect(app).toContain("...(n.perguntaDoFecho ? [ACCAO_DO_FECHO] : []),");
    expect(ler("src/lib/vista-do-pedido.ts")).toContain("perguntaDoFechoNaBase(");
  });
});

/* ── O email: desligado por omissão ─────────────────────────────────────── */

describe("o email ao cliente: atrás de um interruptor DESLIGADO por omissão", () => {
  it("sem linha na tabela, o interruptor lê-se desligado", async () => {
    const { interruptorDoEmailDoFecho } = await import("./fecho-do-modelo-novo-na-base");
    // A base fingida devolve um resultado sem linhas para o SELECT do interruptor.
    const r = await interruptorDoEmailDoFecho();
    expect(r.ligado).toBe(false);
  });

  it("a rotina só envia com o interruptor ligado, depois de 15-11 e em horário", () => {
    const f = ler("src/lib/fecho-do-modelo-novo-na-base.ts");
    const i = f.indexOf("export async function correrOFechoDoModeloNovo(");
    const corpo = f.slice(i, f.indexOf("\nexport function resumoDoFecho", i));
    expect(corpo).toContain("if (r.antesDaData) return r;");
    expect(corpo).toContain("r.emailLigado = (await interruptorDoEmailDoFecho()).ligado;");
    expect(corpo).toContain("if (!r.emailLigado || !r.emHorario || trabalhos.length === 0) return r;");
    expect(corpo.indexOf("if (!r.emailLigado")).toBeLessThan(corpo.indexOf("avisarDaPerguntaDoFecho"));
  });

  it("ligar pede LIGAR, só o administrador, e fica no registo", () => {
    const rota = ler("src/app/api/admin/fecho-do-modelo/interruptor/route.ts");
    expect(rota).toContain("requireAdminGeral");
    expect(rota).toContain('!== "LIGAR"');
    const f = ler("src/lib/fecho-do-modelo-novo-na-base.ts");
    expect(f).toContain('acontecimento: "fecho_interruptor"');
    expect(f).toContain("if (!l) return desligado;");
  });
});

