import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * d123 (CEO e dono, 25-11-2026) — AS PROPOSTAS CHEGAM AO CLIENTE.
 *
 *   · a 1.ª mensagem como na d114 (1 h, ou a 2.ª proposta), das 9h às 20h;
 *   · a proposta NOVA sai sozinha, só ela, 2 h depois da última mensagem de
 *     propostas (da Vitória ou da equipa à mão), no máximo 3 por dia;
 *   · as outras rotinas já não as atrasam; o «não contactar» cala-as;
 *   · 5 maneiras de dizer cada tipo, nunca a mesma duas vezes seguidas;
 *   · «Orçamento enviado» só depois de uma mensagem que saiu.
 *
 * A base e o WhatsApp estão FINGIDOS: nenhuma mensagem sai a ninguém.
 * Números, nomes e telefones INVENTADOS (o repositório é público).
 */

const base = vi.hoisted(() => ({
  pedidosDaMesa: [] as Array<Record<string, unknown>>,
  linhaDoEnvio: null as null | Record<string, unknown>,
  ditas: [] as string[],
}));

vi.mock("./novo-modelo-no-servidor", () => ({
  negociacoesNoNovoModelo: vi.fn(async () => new Set<number>()),
  regimesDasNegociacoes: vi.fn(async () => new Map()),
}));

vi.mock("./db", async (original) => {
  const pool = {
    execute: async (sql: string) => {
      if (/FROM envioDasPropostasAoCliente WHERE pedidoId IN/.test(sql)) return [base.linhaDoEnvio ? [base.linhaDoEnvio] : [], []];
      if (/FROM assistenteAvisos WHERE chave IN/.test(sql)) return [base.ditas.map((chave) => ({ chave })), []];
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
  };
});

import {
  aEntregaPrendeAsPropostas,
  estadoDoEnvio,
  linhaDoEnvioNaMesa,
  MAXIMO_DE_MENSAGENS_DAS_PROPOSTAS_POR_DIA,
  MINUTOS_ENTRE_MENSAGENS_DAS_PROPOSTAS,
  type PedidoParaOEnvio,
} from "./envio-das-propostas-ao-cliente";
import {
  escolherAVariante,
  FECHOS_DAS_PROPOSTAS,
  lerAMensagemCurtaDasPropostas,
  mensagemDasPropostasVariada,
  VARIANTES_POR_TIPO,
  type PropostaCurta,
  type TipoDaMensagemDasPropostas,
} from "./propostas-curtas";
import { escolhaNaLista } from "./a-escolha-e-a-desistencia";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { etiquetaDasPropostasPorEnviar, ETIQUETA_DAS_PROPOSTAS_POR_ENVIAR, type PedidoParaOLado } from "./do-nosso-lado";

const MIN = 60_000;
const mais = (d: Date, m: number) => new Date(d.getTime() + m * MIN);
/** 25-11-2026, 15h00 em Lisboa (UTC no Inverno). */
const AGORA = new Date("2026-11-25T15:00:00Z");
const naBase = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

const envio = (o: Partial<PedidoParaOEnvio> = {}): PedidoParaOEnvio => ({
  pedidoId: 9123,
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

const TEJO: PropostaCurta = { negociacaoId: 1, parceiro: "Recolhas Inventadas", semIva: 80, total: 98.4 };
const SADO: PropostaCurta = { negociacaoId: 2, parceiro: "Transportes Exemplo", semIva: 100, total: 123 };
const ISENTO: PropostaCurta = { negociacaoId: 3, parceiro: "Mudanças Fictícias", semIva: 85, total: 86.96, isento: true };

describe("quando sai", () => {
  it("a 1.ª: 1 h depois da 1.ª proposta, ou logo à 2.ª (a d114 fica)", () => {
    expect(estadoDoEnvio(envio({ primeiraEm: mais(AGORA, -30), ultimaMudancaEm: mais(AGORA, -30) }), AGORA)).toMatchObject({
      tipo: "sai",
      agora: false,
      porqueEspera: "prazo",
    });
    expect(estadoDoEnvio(envio(), AGORA)).toMatchObject({ tipo: "sai", agora: true });
  });

  it("a nova: 2 h depois da última mensagem de propostas, e não no dia seguinte", () => {
    expect(MINUTOS_ENTRE_MENSAGENS_DAS_PROPOSTAS).toBe(120);
    const nova = envio({ ultimoEnvioEm: mais(AGORA, -100), primeiraEm: mais(AGORA, -30), ultimaMudancaEm: mais(AGORA, -30) });
    const e = estadoDoEnvio(nova, AGORA);
    expect(e).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "intervalo" });
    expect(e.tipo === "sai" && e.quando.toISOString()).toBe(mais(AGORA, 20).toISOString());
    expect(linhaDoEnvioNaMesa(e, true)).toContain("(2 h depois da última mensagem de propostas)");
    expect(estadoDoEnvio(nova, mais(AGORA, 21))).toMatchObject({ tipo: "sai", agora: true });
  });

  it("as que chegam nas 2 h vão juntas: a 2.ª nova não adia mais do que os 10 min de assentar", () => {
    const duas = envio({ ultimoEnvioEm: mais(AGORA, -110), primeiraEm: mais(AGORA, -60), ultimaMudancaEm: mais(AGORA, -2) });
    const e = estadoDoEnvio(duas, AGORA);
    expect(e.tipo === "sai" && e.quando.toISOString()).toBe(mais(AGORA, 10).toISOString());
  });

  it("no máximo 3 por dia: a 4.ª fica para amanhã às 9h", () => {
    expect(MAXIMO_DE_MENSAGENS_DAS_PROPOSTAS_POR_DIA).toBe(3);
    const terceira = envio({ ultimoEnvioEm: mais(AGORA, -150), enviosHoje: 2 });
    expect(estadoDoEnvio(terceira, AGORA)).toMatchObject({ tipo: "sai", agora: true });
    const quarta = envio({ ultimoEnvioEm: mais(AGORA, -150), enviosHoje: 3 });
    const e = estadoDoEnvio(quarta, AGORA);
    expect(e).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "tres_por_dia" });
    expect(e.tipo === "sai" && e.quando.toISOString()).toBe("2026-11-26T09:00:00.000Z");
  });

  it("a janela das 9h às 20h: o que cai depois das 20h, ou antes das 9h, sai às 9h", () => {
    const noite = new Date("2026-11-25T19:30:00Z");
    const e = estadoDoEnvio(envio({ ultimoEnvioEm: noite, primeiraEm: mais(noite, 10), ultimaMudancaEm: mais(noite, 10) }), mais(noite, 20));
    expect(e.tipo === "sai" && e.quando.toISOString()).toBe("2026-11-26T09:00:00.000Z");
    const cedo = new Date("2026-11-26T06:00:00Z");
    const m = estadoDoEnvio(envio({ primeiraEm: mais(cedo, -90), ultimaMudancaEm: mais(cedo, -90) }), cedo);
    expect(m.tipo === "sai" && m.quando.toISOString()).toBe("2026-11-26T09:00:00.000Z");
  });

  it("as outras rotinas já não atrasam; o «não contactar» cala", () => {
    expect(estadoDoEnvio(envio({ naoContactar: true }), AGORA)).toEqual({ tipo: "fica", motivo: "nao_contactar" });
  });

  it("a entrega da Vitória há mais de 2 h sem resposta já não prende; a de uma pessoa, a recente e a respondida prendem", () => {
    expect(aEntregaPrendeAsPropostas(null)).toBe(false);
    expect(aEntregaPrendeAsPropostas({ quem: "vitoria", entregueHaSegundos: 3 * 3600, respostaHaSegundos: null })).toBe(false);
    expect(aEntregaPrendeAsPropostas({ quem: "vitoria", entregueHaSegundos: 3600, respostaHaSegundos: null })).toBe(true);
    expect(aEntregaPrendeAsPropostas({ quem: "vitoria", entregueHaSegundos: 3 * 3600, respostaHaSegundos: 600 })).toBe(true);
    expect(aEntregaPrendeAsPropostas({ quem: "pessoa", entregueHaSegundos: 9 * 3600, respostaHaSegundos: null })).toBe(true);
    expect(aEntregaPrendeAsPropostas({ quem: null, entregueHaSegundos: 9 * 3600, respostaHaSegundos: null })).toBe(true);
  });
});

/* ── Os textos ───────────────────────────────────────────────────────────── */

const CASOS: Array<{ tipo: TipoDaMensagemDasPropostas; nova: boolean; propostas: PropostaCurta[] }> = [
  { tipo: "u", nova: false, propostas: [TEJO] },
  { tipo: "v", nova: false, propostas: [SADO, TEJO, ISENTO] },
  { tipo: "n", nova: true, propostas: [SADO] },
  { tipo: "n", nova: true, propostas: [SADO, ISENTO] },
];

const textosDe = (c: (typeof CASOS)[number], nome: string | null = "Joana", verificado = false) =>
  Array.from({ length: VARIANTES_POR_TIPO }, (_, i) =>
    mensagemDasPropostasVariada({
      pedidoId: 9123,
      nome,
      servico: "recolha de monos",
      propostas: c.propostas.map((p) => ({ ...p, verificado })),
      agora: AGORA,
      nova: c.nova,
      variante: `${c.tipo}${i + 1}`,
    }),
  );

describe("os textos — 5 maneiras por tipo, curtas, com marketing honesto", () => {
  it("cada tipo tem 5 maneiras diferentes", () => {
    for (const c of CASOS) expect(new Set(textosDe(c)).size, c.tipo).toBe(VARIANTES_POR_TIPO);
  });

  it("3 a 5 linhas, o pedido, o valor com IVA e o sem IVA ao lado, a chamada à acção", () => {
    for (const c of CASOS) {
      for (const t of textosDe(c)) {
        const linhas = t.split("\n");
        expect(linhas.length, t).toBeGreaterThanOrEqual(3);
        expect(linhas.length, t).toBeLessThanOrEqual(5);
        expect(linhas[0]).toContain("#9123 (recolha de monos)");
        expect(t).toContain(c.propostas.includes(TEJO) ? "98,40 € (80 € + IVA)" : "123 € (100 € + IVA)");
        expect(t).toMatch(c.propostas.length === 1 ? /[Rr]esponda 1|responder 1/ : /respond(?:a|er) com o número|o número da que/i);
        expect(FECHOS_DAS_PROPOSTAS).toContain(linhas[linhas.length - 1]);
      }
    }
  });

  it("a nova diz só a nova (ou as novas) — nunca a lista toda outra vez", () => {
    for (const t of textosDe(CASOS[2])) {
      expect(t).toContain("1) Transportes Exemplo: 123 € (100 € + IVA)");
      expect(t).not.toContain("Recolhas Inventadas");
      expect(t).not.toContain("2)");
    }
  });

  it("as regras de língua: «parceiro», um emoji no máximo, sem promessas que não se fazem, nada sem IVA sozinho", () => {
    const emojis = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
    for (const c of CASOS) {
      for (const t of textosDe(c)) {
        expect(t).not.toMatch(/profissiona/i);
        expect(t).not.toMatch(/no próprio dia|contentor|big ?bag|grátis/i);
        expect((t.match(emojis) ?? []).length, t).toBeLessThanOrEqual(1);
        // O sem IVA só entre parênteses, ao lado do total.
        for (const m of t.matchAll(/(\d[\d.]*(?:,\d{2})? €) \+ IVA/g)) expect(t).toContain(`(${m[1]} + IVA)`);
        expect(t).not.toMatch(/válida até|fatura|taxa/i);
      }
    }
  });

  it("«verificado(s)» só quando todos os parceiros da mensagem têm as três confirmações", () => {
    for (const c of CASOS) {
      for (const t of textosDe(c)) expect(t).not.toMatch(/verificad/);
      expect(textosDe(c, "Joana", true).some((t) => /verificad/.test(t)), c.tipo).toBe(true);
    }
  });

  it("a maneira: pelo pedido e pelo n.º da mensagem, e nunca a mesma duas vezes seguidas", () => {
    expect(escolherAVariante("u", 9123, 1)).toBe(escolherAVariante("u", 9123, 1));
    for (const tipo of ["u", "v", "n"] as const) {
      let anterior: string | null = null;
      for (let n = 1; n <= 30; n++) {
        const v = escolherAVariante(tipo, 9123, n, anterior);
        expect(v).toMatch(new RegExp(`^${tipo}[1-5]$`));
        expect(v).not.toBe(anterior);
        anterior = v;
      }
    }
    // A mesma da última mensagem a este cliente (de outro pedido dele): passa à seguinte.
    const v = escolherAVariante("n", 10, 0);
    expect(escolherAVariante("n", 10, 0, v)).not.toBe(v);
  });

  it("a d111 lê todas as maneiras: o pedido, as linhas, e o «1» escolhe", () => {
    for (const c of CASOS) {
      for (const t of textosDe(c)) {
        const lida = lerAMensagemCurtaDasPropostas(t);
        expect(lida, t).not.toBeNull();
        expect(lida!.pedidoId).toBe(9123);
        expect(lida!.linhas.length).toBe(c.propostas.length);
        const propostas = c.propostas.map((p) => ({ ...p, negociacaoId: p.negociacaoId ?? 0, valor: `${p.total}` }));
        const r = escolhaNaLista("1", lida!.linhas, propostas as never);
        expect(r.tipo).toBe("escolheu");
      }
    }
  });

  it("em inglês, francês e espanhol, pelas traduções fixas — todas as maneiras", () => {
    for (const c of CASOS) {
      for (const t of [...textosDe(c), ...textosDe(c, null), ...textosDe(c, "Joana", true)]) {
        for (const lingua of ["en", "fr", "es"] as const) {
          const fixa = traducaoFixa(t, lingua);
          expect(fixa, `${lingua}: ${t}`).not.toBeNull();
          expect(fixa).not.toMatch(/\b(proposta|propostas|parceiro|parceiros|adiantado|Quer avançar)\b/);
        }
        expect(traducaoFixa(t, "en")).toMatch(/VAT/);
      }
    }
  });
});

/* ── A etiqueta da Mesa ──────────────────────────────────────────────────── */

const negociacao = (id: number, nome: string, valor: number, criadaEm: Date) => ({
  id,
  providerId: 500 + id,
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

const pedidoDaMesa = (o: Record<string, unknown> = {}) => ({
  id: 9123,
  serviceType: "recolha_monos",
  city: "Almada",
  contactName: "Joana Inventada",
  contactEmail: null,
  contactPhone: "912345678",
  address: null,
  postalCode: null,
  valorDesejadoCliente: null,
  baseDoPreco: "total",
  origem: "backoffice",
  status: "sem_assistente",
  propostaEnviadaEm: null,
  valorUnicoCliente: null,
  escolhidosJson: null,
  horasPrevistas: 3,
  negociacoes: [negociacao(1, "Recolhas Inventadas", 80, mais(AGORA, -200)), negociacao(2, "Transportes Exemplo", 100, mais(AGORA, -30))],
  ...o,
});

describe("«Orçamento enviado» só depois de uma mensagem que saiu", () => {
  it("com propostas por enviar, a Mesa diz «Propostas por enviar»; depois do envio, a fase", () => {
    const p = pedidoDaMesa() as unknown as PedidoParaOLado;
    expect(etiquetaDasPropostasPorEnviar("orcamento_enviado", p, AGORA)).toBe(ETIQUETA_DAS_PROPOSTAS_POR_ENVIAR);
    const enviado = pedidoDaMesa({ propostaEnviadaEm: naBase(mais(AGORA, -5)) }) as unknown as PedidoParaOLado;
    expect(etiquetaDasPropostasPorEnviar("orcamento_enviado", enviado, AGORA)).toBeNull();
    expect(etiquetaDasPropostasPorEnviar("a_espera_de_propostas", p, AGORA)).toBeNull();
  });
});

/* ── Na base (fingida) ───────────────────────────────────────────────────── */

describe("na base: a nova sozinha, e o orçamento à mão já não fecha a porta", { timeout: 60_000 }, () => {
  beforeEach(() => {
    base.pedidosDaMesa = [];
    base.linhaDoEnvio = null;
    base.ditas = [];
  });

  it("a 1.ª mensagem diz as duas (lista), e sai já", async () => {
    base.pedidosDaMesa = [pedidoDaMesa()];
    const { candidatosAoEnvio } = await import("./envio-das-propostas-ao-cliente-na-base");
    const [c] = await candidatosAoEnvio(AGORA);
    expect(c.nova).toBe(false);
    expect(c.porDizer).toBe(2);
    expect(c.variante).toMatch(/^v[1-5]$/);
    expect(c.texto).toContain("Recolhas Inventadas");
    expect(c.texto).toContain("Transportes Exemplo");
    expect(c.estado).toMatchObject({ tipo: "sai", agora: true });
  });

  it("uma proposta nova depois da 1.ª mensagem: só ela, 2 h depois da última", async () => {
    // A 1.ª proposta já foi dita há 3 h; a 2.ª chegou há 30 min.
    base.ditas = ["proposta:1:1"];
    base.linhaDoEnvio = { pedidoId: 9123, estado: "enviado", motivo: null, ultimo: naBase(mais(AGORA, -180)), envios: 1, ultimaVariante: "u2" };
    base.pedidosDaMesa = [pedidoDaMesa({ propostaEnviadaEm: naBase(mais(AGORA, -180)) })];
    const { candidatosAoEnvio } = await import("./envio-das-propostas-ao-cliente-na-base");
    const [c] = await candidatosAoEnvio(AGORA);
    expect(c.nova).toBe(true);
    expect(c.porDizer).toBe(1);
    expect(c.variante).toMatch(/^n[1-5]$/);
    expect(c.texto).toContain("1) Transportes Exemplo: ");
    expect(c.texto).not.toContain("Recolhas Inventadas");
    expect(c.estado).toMatchObject({ tipo: "sai", agora: true });
  });

  it("o orçamento mandado à mão conta como a última mensagem: o que chegou depois sai como nova, 2 h depois dele", async () => {
    base.pedidosDaMesa = [pedidoDaMesa({ propostaEnviadaEm: naBase(mais(AGORA, -60)) })];
    const { candidatosAoEnvio } = await import("./envio-das-propostas-ao-cliente-na-base");
    const [c] = await candidatosAoEnvio(AGORA);
    expect(c.envio.jaEnviado).toBe(false);
    expect(c.nova).toBe(true);
    expect(c.texto).toContain("Transportes Exemplo");
    expect(c.texto).not.toContain("Recolhas Inventadas");
    expect(c.estado).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "intervalo" });
  });

  it("recomeçado do zero: as propostas são todas de depois do orçamento à mão — vão como a 1.ª, numa lista", async () => {
    base.pedidosDaMesa = [
      pedidoDaMesa({
        propostaEnviadaEm: naBase(mais(AGORA, -400)),
        negociacoes: [negociacao(1, "Recolhas Inventadas", 80, mais(AGORA, -40)), negociacao(2, "Transportes Exemplo", 100, mais(AGORA, -30))],
      }),
    ];
    const { candidatosAoEnvio } = await import("./envio-das-propostas-ao-cliente-na-base");
    const [c] = await candidatosAoEnvio(AGORA);
    expect(c.nova).toBe(false);
    expect(c.porDizer).toBe(2);
    expect(c.estado).toMatchObject({ tipo: "sai", agora: true });
  });

  it("3 mensagens de propostas hoje: a próxima fica para amanhã", async () => {
    base.ditas = ["proposta:1:1"];
    base.linhaDoEnvio = {
      pedidoId: 9123,
      estado: "enviado",
      motivo: null,
      ultimo: naBase(mais(AGORA, -180)),
      envios: 3,
      ultimaVariante: "n1",
      diaDosEnvios: "2026-11-25",
      enviosNoDia: 3,
    };
    base.pedidosDaMesa = [pedidoDaMesa({ propostaEnviadaEm: naBase(mais(AGORA, -180)) })];
    const { candidatosAoEnvio } = await import("./envio-das-propostas-ao-cliente-na-base");
    const [c] = await candidatosAoEnvio(AGORA);
    expect(c.estado).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "tres_por_dia" });
    expect(c.variante).not.toBe("n1");
  });
});
