import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * d88 (CEO e dono, 23-11-2026) — passos 1 e 3.
 *
 *   1. o «Pedir o que falta» sai sozinho: 30 min depois, das 8h às 21h (fora,
 *      às 9h), repetido no dia seguinte, 3 no máximo, arquivo no dia a seguir;
 *      a Vitória reconhece a resposta (d86); uma mensagem automática por dia;
 *   3. as propostas vão ao cliente sozinhas: com 3 propostas, ou 3 h depois da
 *      1.ª; acima de 500 € com IVA fica com uma pessoa; fora de horas, às 9h;
 *      nunca duas vezes; o texto e o caminho do «Enviar pela CLYON».
 *
 * A base, o WhatsApp e o email estão FINGIDOS: nenhuma mensagem sai a ninguém.
 * Números, nomes e telefones INVENTADOS (o repositório é público).
 */

const base = vi.hoisted(() => ({
  sqls: [] as Array<{ sql: string; params: unknown[] }>,
  enviados: [] as string[],
  jaSaiuHoje: false,
  reserva: 1,
  propostaEnviadaHa: null as number | null,
  marcados: [] as number[],
  historico: [] as string[],
  pedidoDoQueFalta: null as Record<string, unknown> | null,
  pedidosDaMesa: [] as Array<Record<string, unknown>>,
  interruptor: null as null | { ligado: number },
  linhaDoEnvio: null as null | { pedidoId: number; estado: string; motivo: string | null; ultimo?: string | null },
  /** d114: o «Avisar de propostas» do assistente e as propostas que ficaram ditas. */
  propostasLigado: true,
  ditas: [] as string[],
  fio: [] as Array<{ direccao: string; texto: string; criadoEm: string; haSegundos: number | null }>,
  lingua: null as null | "en" | "fr" | "es",
  guardadas: [] as string[],
  opcoesDoEnvio: [] as Array<{ semLinguaErrada?: boolean } | undefined>,
  traducao: "tradutor" as "tradutor" | "falha",
}));

vi.mock("./traduzir-para-o-cliente", async (original) => ({
  ...(await original<typeof import("./traduzir-para-o-cliente")>()),
  // O tradutor fingido: «tradutor» devolve o texto marcado; «falha», a tradução fixa ou nada (como o verdadeiro).
  traduzirSemLinguaErrada: vi.fn(async (texto: string, lingua: string) => {
    if (base.traducao === "tradutor") return `[${lingua}] ${texto}`;
    const { traducaoFixa } = await import("./traducoes-fixas-da-vitoria");
    return traducaoFixa(texto, lingua as "en");
  }),
}));

vi.mock("./uma-mensagem-automatica-por-dia", async (original) => ({
  ...(await original<typeof import("./uma-mensagem-automatica-por-dia")>()),
  jaSaiuHojeUmaMensagemAutomatica: vi.fn(async () => base.jaSaiuHoje),
}));

vi.mock("./novo-modelo-no-servidor", () => ({
  negociacoesNoNovoModelo: vi.fn(async () => new Set<number>()),
  regimesDasNegociacoes: vi.fn(async () => new Map()),
}));

vi.mock("./db", async (original) => {
  const pool = {
    execute: async (sql: string, params: unknown[] = []) => {
      base.sqls.push({ sql, params });
      if (/FROM retencaoInterruptores/.test(sql)) {
        const chave = String(params[0] ?? "");
        if (chave === "lembretes_do_que_falta_d71") return [[{ ligado: 1, mudadoEm: null, porQuem: null }], []];
        return [base.interruptor ? [{ ...base.interruptor, mudadoEm: null, porQuem: null }] : [], []];
      }
      if (/SELECT \* FROM lembretesDoQueFalta WHERE pedidoId IN/.test(sql)) return [[], []];
      if (/FROM simulatorOrders o\s+WHERE o\.id IN/.test(sql)) return [base.pedidoDoQueFalta ? [base.pedidoDoQueFalta] : [], []];
      if (/FROM envioDasPropostasAoCliente WHERE pedidoId IN/.test(sql)) return [base.linhaDoEnvio ? [base.linhaDoEnvio] : [], []];
      if (/SET estado = 'a_enviar'/.test(sql)) return [{ affectedRows: base.reserva }, []];
      if (/^\s*(UPDATE|INSERT)/.test(sql)) return [{ affectedRows: 1 }, []];
      return [[], []];
    },
    query: async (sql: string) => {
      base.sqls.push({ sql, params: [] });
      return [[], []];
    },
  };
  return {
    ...(await original<typeof import("./db")>()),
    getPool: async () => pool,
    ensureSimulatorOrdersTable: async () => {},
    ensureNegociacoesTable: async () => {},
    ensureRegistoTable: async () => {},
    appendOrderHistory: async (_id: number, e: { message: string }) => {
      base.historico.push(e.message);
    },
    registarSemFalhar: async () => {},
    respostasDoClienteNoWhatsApp: async () => new Map(),
    numeroInterrompidoWhatsApp: async () => false,
    numeroBloqueadoWhatsApp: async () => false,
    mensagensDoNumeroWhatsApp: async () => base.fio,
    linguaDoNumero: async () => base.lingua,
    guardarLinguaDoNumero: async (_t: string, l: string) => {
      base.guardadas.push(l);
    },
    retomarNumeroWhatsApp: async () => {},
    pedidosPorPromover: async () => (base.pedidoDoQueFalta ? [{ id: base.pedidoDoQueFalta.id }] : []),
    pedidosComNegociacoes: async () => base.pedidosDaMesa,
    parceirosParaOValorUnico: async () => new Map(),
    minutosDesdeAPropostaEnviada: async () => base.propostaEnviadaHa,
    assistentePode: async (c: string) => c === "propostas" && base.propostasLigado,
    reservarAvisoDoAssistente: async (d: { chave: string }) => {
      base.ditas.push(d.chave);
      return { id: base.ditas.length, jaExistia: false };
    },
    fecharAvisoDoAssistente: async () => {},
    marcarOrcamentoEnviado: async (id: number) => {
      base.marcados.push(id);
    },
  };
});

vi.mock("./whatsapp-cloud", async (original) => ({
  ...(await original<typeof import("./whatsapp-cloud")>()),
  enviarAvisoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    base.enviados.push(texto);
    return true;
  }),
  enviarTextoManualWhatsApp: vi.fn(async (_t: string, texto: string, opcoes?: { semLinguaErrada?: boolean }) => {
    base.enviados.push(texto);
    base.opcoesDoEnvio.push(opcoes);
    return true;
  }),
}));

vi.mock("./seguimento-da-app-envio", () => ({
  enviarEmailDoSeguimento: vi.fn(async (p: { texto: string }) => {
    base.enviados.push(p.texto);
    return true;
  }),
}));

import { textoDoLembrete1, textoDoLembrete2, textoDoLembrete3 } from "./lembrete-do-que-falta";
import { pedidoDoEnvioDeModelo } from "./envio-de-modelo";
import { respostaAoEnvioDeModelo } from "./resposta-ao-que-falta";
import { momentoDeSaida, podeSairAgora } from "./janela-das-mensagens-automaticas";
import {
  devidoDasPropostas,
  estadoDoEnvio,
  historicoDoEnvioAutomatico,
  linhaDoEnvioNaMesa,
  porqueFicaComUmaPessoa,
  type PedidoParaOEnvio,
} from "./envio-das-propostas-ao-cliente";
import { textoDoOrcamentoDaMesa } from "./texto-do-orcamento-da-mesa";
import { mensagemDasPropostas, propostasParaOCliente } from "./mensagem-das-propostas";
import { comValidade } from "./validade-do-orcamento";
import { haQueixaNaConversa } from "./queixa-na-conversa";
import { propostasPorEnviarDoPedido } from "./do-nosso-lado";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** Um instante em Lisboa (Inverno: Lisboa = UTC). */
const as = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00Z`);
const AGORA = as("2026-11-23", "15:00");
const antes = (min: number) => new Date(AGORA.getTime() - min * 60_000);
const naBase = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

beforeAll(async () => {
  await import("./lembrete-do-que-falta-na-base");
  await import("./envio-das-propostas-ao-cliente-na-base");
  await import("./whatsapp-cloud");
  await import("./o-que-falta-no-pedido");
  await import("./aviso-aos-profissionais");
  await import("./pedido-em-curso");
  await import("./traducoes-fixas-da-vitoria");
  await import("./db");
}, 120_000);

beforeEach(() => {
  base.sqls = [];
  base.enviados = [];
  base.jaSaiuHoje = false;
  base.reserva = 1;
  base.propostaEnviadaHa = null;
  base.marcados = [];
  base.historico = [];
  base.pedidoDoQueFalta = null;
  base.pedidosDaMesa = [];
  base.interruptor = null;
  base.linhaDoEnvio = null;
  base.propostasLigado = true;
  base.ditas = [];
  base.fio = [];
  base.lingua = null;
  base.guardadas = [];
  base.opcoesDoEnvio = [];
  base.traducao = "tradutor";
});

/* ── Passo 1 ─────────────────────────────────────────────────────────────── */

describe("passo 1: a Vitória reconhece a resposta (d86) às três mensagens", () => {
  const P = { id: 9101, serviceType: "recolha_moveis", city: "Seixal" };
  const F = ["fotografias", "estacionamento"] as const;

  it("as três são envios de modelo do pedido #9101", () => {
    for (const t of [textoDoLembrete1(P, [...F], AGORA), textoDoLembrete2(P, [...F], AGORA), textoDoLembrete3(P, [...F], AGORA)]) {
      expect(pedidoDoEnvioDeModelo(t)).toBe(9101);
    }
  });

  it("e a resposta do cliente à 2.ª é a resposta ao modelo", () => {
    const fio = [
      { direccao: "out", texto: textoDoLembrete2(P, [...F], AGORA), haSegundos: 3600 },
      { direccao: "in", texto: "Há lugar à porta. Mando a fotografia logo.", haSegundos: 60 },
    ];
    expect(respostaAoEnvioDeModelo(fio)).toEqual({ pedidoId: 9101 });
  });
});

describe("passo 1: as horas (8h–21h, fora às 9h)", () => {
  it("dentro da janela sai à hora; às 21h já não; de madrugada, às 9h", () => {
    expect(podeSairAgora(as("2026-11-23", "14:30"), as("2026-11-23", "14:30"))).toBe(true);
    expect(momentoDeSaida(as("2026-11-23", "21:20"), as("2026-11-23", "21:20")).toISOString()).toBe(as("2026-11-24", "09:00").toISOString());
    expect(momentoDeSaida(as("2026-11-24", "06:10"), as("2026-11-24", "06:10")).toISOString()).toBe(as("2026-11-24", "09:00").toISOString());
    expect(podeSairAgora(as("2026-11-24", "06:10"), as("2026-11-24", "08:30"))).toBe(false);
    expect(podeSairAgora(as("2026-11-24", "06:10"), as("2026-11-24", "09:00"))).toBe(true);
  });
});

/** Um pedido dos «Orçamentos novos», incompleto, como a base o devolve. */
const pedidoNovo = (o: Record<string, unknown> = {}) => ({
  id: 9101,
  status: "sem_assistente",
  createdAt: naBase(antes(40)),
  contactName: "Joana Inventada",
  contactEmail: null,
  contactPhone: "912345678",
  serviceType: "recolha_moveis",
  city: "Seixal",
  address: "Rua Inventada 7",
  postalCode: "2840-000",
  floor: "2",
  hasElevator: "sim",
  parkingDistance: null,
  description: "um sofá de três lugares",
  filesJson: null,
  urgency: null,
  dataAgendada: null,
  rawOrderJson: null,
  historyJson: null,
  anonimizadoEm: null,
  assignedToId: null,
  jaFoiEnviado: 0,
  ...o,
});

describe("passo 1: a rotina, com a base fingida", { timeout: 60_000 }, () => {
  it("40 min depois de entrar, às 15h: o ciclo nasce e a 1.ª vai para a fila", async () => {
    base.pedidoDoQueFalta = pedidoNovo();
    const { rotinaDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await rotinaDoQueFalta(AGORA);
    expect(r).toMatchObject({ ligado: true, novos: 1, naFila: 1 });
    expect(base.sqls.some((q) => /INSERT IGNORE INTO lembretesDoQueFalta \(pedidoId, canal\) VALUES/.test(q.sql))).toBe(true);
    expect(base.sqls.some((q) => /UPDATE lembretesDoQueFalta SET porEnviar = \?/.test(q.sql) && q.params[0] === "lembrete1")).toBe(true);
  });

  it("com 20 min, ainda não entra", async () => {
    base.pedidoDoQueFalta = pedidoNovo({ createdAt: naBase(antes(20)) });
    const { rotinaDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await rotinaDoQueFalta(AGORA);
    expect(r).toMatchObject({ novos: 0, naFila: 0 });
  });

  it("atribuído a uma pessoa, «Outro serviço», ou um «Pedir info» à mão: não entra", async () => {
    const { rotinaDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    for (const o of [{ assignedToId: 3 }, { serviceType: "outro" }, { status: "precisa_info" }]) {
      base.sqls = [];
      base.pedidoDoQueFalta = pedidoNovo(o);
      const r = await rotinaDoQueFalta(AGORA);
      expect(r.novos, JSON.stringify(o)).toBe(0);
    }
  });

  it("a uma-por-dia: com outra automática hoje, o ciclo nasce mas a 1.ª não vai para a fila", async () => {
    base.pedidoDoQueFalta = pedidoNovo();
    base.jaSaiuHoje = true;
    const { rotinaDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await rotinaDoQueFalta(AGORA);
    expect(r).toMatchObject({ novos: 1, naFila: 0 });
  });

  it("a equipa carregou em «Pedir o que falta»: conta como a 1.ª, e hoje não sai mais nada", async () => {
    base.pedidoDoQueFalta = pedidoNovo({
      historyJson: JSON.stringify([
        { type: "note", message: "Rita pediu ao cliente, por WhatsApp, as informações em falta: estacionamento.", createdAt: naBase(antes(25)) },
      ]),
    });
    const { rotinaDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await rotinaDoQueFalta(AGORA);
    expect(r).toMatchObject({ novos: 1, naFila: 0 });
    const ins = base.sqls.find((q) => /INSERT IGNORE INTO lembretesDoQueFalta \(pedidoId, canal, lembrete1Em, lembrete1PelaEquipa\)/.test(q.sql));
    expect(ins?.params[2]).toBe(naBase(antes(25)));
  });

  it("fora das 8h–21h, a rotina não faz nada", async () => {
    base.pedidoDoQueFalta = pedidoNovo();
    const { rotinaDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    expect(await rotinaDoQueFalta(as("2026-11-23", "07:45"))).toMatchObject({ foraDeHoras: true, novos: 0 });
  });
});

/* ── Passo 3 ─────────────────────────────────────────────────────────────── */

const envio = (o: Partial<PedidoParaOEnvio> = {}): PedidoParaOEnvio => ({
  pedidoId: 9102,
  parceiros: 1,
  primeiraEm: antes(60),
  ultimaMudancaEm: antes(60),
  jaEnviado: false,
  base: "total",
  melhorComIva: 135.3,
  temTelemovel: true,
  ...o,
});

describe("passo 3: quando vão as propostas (d114: 1 h, ou a 2.ª; depois uma por dia)", () => {
  it("3 propostas: vai já (10 min depois da última), sem esperar a hora", () => {
    const e = estadoDoEnvio(envio({ parceiros: 3, primeiraEm: antes(40), segundaEm: antes(30), ultimaMudancaEm: antes(15) }), AGORA);
    expect(e).toMatchObject({ tipo: "sai", agora: true });
  });

  it("1 proposta: 1 h depois da 1.ª", () => {
    expect(estadoDoEnvio(envio({ primeiraEm: antes(30), ultimaMudancaEm: antes(30) }), AGORA)).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "prazo" });
    expect(estadoDoEnvio(envio({ primeiraEm: antes(61), ultimaMudancaEm: antes(61) }), AGORA)).toMatchObject({ tipo: "sai", agora: true });
    expect(devidoDasPropostas(envio({ primeiraEm: antes(30), ultimaMudancaEm: antes(30) })).toISOString()).toBe(antes(-30).toISOString());
  });

  it("um parceiro mudou a proposta há menos de 10 min: espera-se", () => {
    const e = estadoDoEnvio(envio({ parceiros: 3, primeiraEm: antes(200), ultimaMudancaEm: antes(4) }), AGORA);
    expect(e).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "mudou" });
    expect(linhaDoEnvioNaMesa(e, true)).toBe("a Vitória envia ao cliente a 23/11 às 15h06 (um parceiro mudou a proposta há menos de 10 min)");
  });

  it("fora de horas: às 9h", () => {
    const noite = as("2026-11-23", "22:30");
    const e = estadoDoEnvio(envio({ parceiros: 3, primeiraEm: as("2026-11-23", "21:40"), ultimaMudancaEm: as("2026-11-23", "21:40") }), noite);
    expect(e).toMatchObject({ tipo: "sai", agora: false });
    expect(e.tipo === "sai" && e.quando.toISOString()).toBe(as("2026-11-24", "09:00").toISOString());
  });

  it("já saiu hoje outra mensagem automática: amanhã às 9h", () => {
    const e = estadoDoEnvio(envio({ parceiros: 3, ultimaMudancaEm: antes(30) }), AGORA, { jaSaiuHoje: true });
    expect(e).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "uma_por_dia" });
    expect(linhaDoEnvioNaMesa(e, true)).toBe("a Vitória envia ao cliente a 24/11 às 9h (já saiu hoje outra mensagem automática a este cliente)");
  });

  it("ficam com uma pessoa: acima de 500 € com IVA, Trabalho CLYON, valor único, à hora, com uma pessoa, outra língua, queixa", () => {
    expect(porqueFicaComUmaPessoa(envio({ melhorComIva: 500 }))).toBeNull();
    expect(porqueFicaComUmaPessoa(envio({ melhorComIva: 615 }))).toBe("acima_de_500");
    expect(porqueFicaComUmaPessoa(envio({ trabalhoClyon: true }))).toBe("trabalho_clyon");
    expect(porqueFicaComUmaPessoa(envio({ valorUnico: true }))).toBe("valor_unico");
    expect(porqueFicaComUmaPessoa(envio({ base: "hora" }))).toBe("a_hora");
    expect(porqueFicaComUmaPessoa(envio({ comUmaPessoa: true }))).toBe("com_uma_pessoa");
    expect(porqueFicaComUmaPessoa(envio({ linguaSemTraducao: "fr" }))).toBe("noutra_lingua");
    expect(porqueFicaComUmaPessoa(envio({ queixa: true }))).toBe("queixa");
    expect(porqueFicaComUmaPessoa(envio({ temTelemovel: false }))).toBe("sem_telemovel");
    const e = estadoDoEnvio(envio({ parceiros: 3, melhorComIva: 615 }), AGORA);
    expect(linhaDoEnvioNaMesa(e, true)).toBe("fica com uma pessoa: a melhor proposta passa dos 500 € com IVA");
  });

  it("desligado, a Mesa diz «enviaria»; já enviado, nada", () => {
    const e = estadoDoEnvio(envio({ parceiros: 3, ultimaMudancaEm: antes(30) }), AGORA);
    expect(linhaDoEnvioNaMesa(e, false)).toBe("envio automático desligado: enviaria já");
    expect(estadoDoEnvio(envio({ jaEnviado: true }), AGORA)).toEqual({ tipo: "ja_enviado" });
  });

  it("uma queixa na conversa, dos últimos 14 dias", () => {
    expect(haQueixaNaConversa([{ direccao: "in", texto: "Isto está muito caro, não concordo", haSegundos: 3600 }])).toBe(true);
    expect(haQueixaNaConversa([{ direccao: "in", texto: "Com esse atendimento fica difícil", haSegundos: 60 }])).toBe(true);
    expect(haQueixaNaConversa([{ direccao: "in", texto: "Obrigada, fico a aguardar", haSegundos: 60 }])).toBe(false);
    expect(haQueixaNaConversa([{ direccao: "out", texto: "muito caro", haSegundos: 60 }])).toBe(false);
    expect(haQueixaNaConversa([{ direccao: "in", texto: "muito caro", haSegundos: 20 * 86_400 }])).toBe(false);
  });

  it("o histórico diz que foi a Vitória, e quantas propostas", () => {
    expect(historicoDoEnvioAutomatico(3)).toBe("Orçamento enviado ao cliente automaticamente — pela Vitória (3 propostas, mensagem curta, d114).");
    expect(historicoDoEnvioAutomatico(1)).toBe("Orçamento enviado ao cliente automaticamente — pela Vitória (1 proposta, mensagem curta, d114).");
    expect(historicoDoEnvioAutomatico(2, true)).toBe("Propostas atualizadas ao cliente automaticamente — pela Vitória (2 propostas, mensagem curta, d114).");
  });
});

/** Um pedido da Mesa que a CLYON negoceia, com propostas de parceiros pendentes. */
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
  criadaEm: naBase(antes(300)),
  actualizadaEm: naBase(criadaEm),
});
const pedidoDaMesa = (o: Record<string, unknown> = {}) => ({
  id: 9102,
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
  negociacoes: [
    negociacao(1, "Recolhas Inventadas", 100, antes(40)),
    negociacao(2, "Transportes Exemplo", 120, antes(30)),
    negociacao(3, "Mudanças Fictícias", 140, antes(20)),
  ],
  ...o,
});

describe("passo 3: a mesma função do botão", () => {
  it("o texto é o do «Enviar pela CLYON»: as propostas e a validade", () => {
    const p = pedidoDaMesa();
    const t = textoDoOrcamentoDaMesa(p, AGORA);
    const esperado = comValidade(
      mensagemDasPropostas({
        nomeCliente: p.contactName,
        servico: "recolha de monos",
        servicoId: p.serviceType,
        cidade: p.city,
        propostas: propostasParaOCliente(p.negociacoes),
        fechado: null,
        base: "total",
        horasPrevistas: 3,
        mudancaDaLista: false,
      }),
      AGORA,
    );
    expect(t).toBe(esperado);
    expect(t).toContain("Esta proposta é válida até");
    expect(t).toContain("Recolhas Inventadas");
  });

  it("o painel fica com o texto do botão; a Vitória manda a mensagem curta (d114) pelo caminho do botão", () => {
    const painel = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(painel).toContain("return textoDoOrcamentoDaMesa(p, new Date(), propostas);");
    const naBase = ler("src/lib/envio-das-propostas-ao-cliente-na-base.ts");
    expect(naBase).toContain("const texto = textoDasPropostasDoPedido(p, agora, notas, ultimoEnvioEm == null);");
    expect(naBase).toContain("const texto = c.texto;");
    expect(naBase).toContain("enviarTextoManualWhatsApp(telefone, texto, { semLinguaErrada: true })");
    expect(naBase).toContain("db.marcarOrcamentoEnviado(pedidoId)");
    expect(naBase).toContain("db.retomarNumeroWhatsApp(telefone)");
    // A reserva vem ANTES de enviar.
    expect(naBase.indexOf("SET estado = 'a_enviar'")).toBeLessThan(naBase.indexOf("enviarTextoManualWhatsApp(telefone, texto, { semLinguaErrada: true })"));
    expect(naBase).not.toMatch(/DELETE FROM/);
  });

  it("a conta das propostas por enviar é a do cartão da Mesa", () => {
    expect(propostasPorEnviarDoPedido(pedidoDaMesa(), AGORA)).toMatchObject({ parceiros: 3 });
    // O cliente com email negoceia sozinho pelo link: não é da CLYON.
    expect(propostasPorEnviarDoPedido(pedidoDaMesa({ origem: null, contactEmail: "joana@exemplo.pt" }), AGORA)).toBeNull();
  });
});

describe("passo 3: o envio, com a base fingida", { timeout: 60_000 }, () => {
  it("3 propostas: envia uma vez, curta, marca «A aguardar cliente», escreve no histórico e deixa-as ditas", async () => {
    base.pedidosDaMesa = [pedidoDaMesa()];
    const { enviarAsPropostasAoCliente } = await import("./envio-das-propostas-ao-cliente-na-base");
    const r = await enviarAsPropostasAoCliente(9102, AGORA);
    expect(r).toEqual({ ok: true, feito: "Orçamento enviado ao cliente automaticamente — pela Vitória (3 propostas, mensagem curta, d114)." });
    expect(base.enviados).toHaveLength(1);
    expect(base.enviados[0]).toContain("Já tem 3 propostas para o seu pedido #9102 (recolha de monos):");
    expect(base.enviados[0]).toContain("1) Recolhas Inventadas: ");
    expect(base.enviados[0]).toContain("Qual prefere? Responda com o número.");
    expect(base.enviados[0]).not.toMatch(/válida até|fatura|adiantado|taxa/);
    expect(base.marcados).toEqual([9102]);
    expect(base.historico).toEqual(["Orçamento enviado ao cliente automaticamente — pela Vitória (3 propostas, mensagem curta, d114)."]);
    expect(base.ditas).toEqual(["proposta:1:1", "proposta:2:1", "proposta:3:1"]);
  });

  it("com o «Avisar de propostas» do assistente desligado, nada sai", async () => {
    base.pedidosDaMesa = [pedidoDaMesa()];
    base.propostasLigado = false;
    const { enviarAsPropostasAoCliente, rotinaDasPropostas } = await import("./envio-das-propostas-ao-cliente-na-base");
    expect(await enviarAsPropostasAoCliente(9102, AGORA)).toEqual({ ok: false, porque: "desligado" });
    expect(await rotinaDasPropostas(AGORA)).toMatchObject({ ligado: false, naFila: 0 });
    expect(base.enviados).toEqual([]);
  });

  it("repetir não reenvia: outra passagem já reservou, ou o orçamento já foi", async () => {
    base.pedidosDaMesa = [pedidoDaMesa()];
    base.reserva = 0;
    const { enviarAsPropostasAoCliente } = await import("./envio-das-propostas-ao-cliente-na-base");
    expect((await enviarAsPropostasAoCliente(9102, AGORA)).ok).toBe(false);
    base.reserva = 1;
    base.pedidosDaMesa = [pedidoDaMesa({ propostaEnviadaEm: naBase(antes(5)) })];
    expect((await enviarAsPropostasAoCliente(9102, AGORA)).ok).toBe(false);
    base.pedidosDaMesa = [pedidoDaMesa()];
    base.propostaEnviadaHa = 3;
    expect((await enviarAsPropostasAoCliente(9102, AGORA)).ok).toBe(false);
    base.propostaEnviadaHa = null;
    // d114: a mensagem de hoje já saiu — a seguinte só amanhã.
    base.linhaDoEnvio = { pedidoId: 9102, estado: "enviado", motivo: null, ultimo: naBase(antes(60)) };
    expect((await enviarAsPropostasAoCliente(9102, AGORA)).ok).toBe(false);
    expect(base.enviados).toEqual([]);
    expect(base.marcados).toEqual([]);
  });

  it("acima de 500 € com IVA fica com uma pessoa: não envia", async () => {
    base.pedidosDaMesa = [
      pedidoDaMesa({
        negociacoes: [negociacao(1, "Recolhas Inventadas", 450, antes(40)), negociacao(2, "Transportes Exemplo", 480, antes(30)), negociacao(3, "Mudanças Fictícias", 500, antes(20))],
      }),
    ];
    const { enviarAsPropostasAoCliente, rotinaDasPropostas } = await import("./envio-das-propostas-ao-cliente-na-base");
    expect((await enviarAsPropostasAoCliente(9102, AGORA)).ok).toBe(false);
    expect(await rotinaDasPropostas(AGORA)).toMatchObject({ ficam: 1, naFila: 0 });
    expect(base.enviados).toEqual([]);
  });

  it("1 proposta há 30 min: espera; há 1 h: entra na fila", async () => {
    const { rotinaDasPropostas } = await import("./envio-das-propostas-ao-cliente-na-base");
    base.pedidosDaMesa = [pedidoDaMesa({ negociacoes: [negociacao(1, "Recolhas Inventadas", 100, antes(30))] })];
    expect(await rotinaDasPropostas(AGORA)).toMatchObject({ esperam: 1, naFila: 0 });
    base.pedidosDaMesa = [pedidoDaMesa({ negociacoes: [negociacao(1, "Recolhas Inventadas", 100, antes(65))] })];
    expect(await rotinaDasPropostas(AGORA)).toMatchObject({ esperam: 0, naFila: 1 });
    expect(base.enviados).toEqual([]);
  });

  it("as que o cliente já ouviu (por qualquer caminho) não fazem sair nada", async () => {
    base.pedidosDaMesa = [pedidoDaMesa()];
    const { candidatosAoEnvio } = await import("./envio-das-propostas-ao-cliente-na-base");
    const [c] = await candidatosAoEnvio(AGORA);
    expect(c.envio.novas).toBe(3);
    expect(c.chaves.map((x) => x.chave)).toEqual(["proposta:1:1", "proposta:2:1", "proposta:3:1"]);
  });

  it("fora de horas, a rotina e a passagem não fazem nada", async () => {
    base.pedidosDaMesa = [pedidoDaMesa()];
    const { rotinaDasPropostas, passagemDasPropostas } = await import("./envio-das-propostas-ao-cliente-na-base");
    expect(await rotinaDasPropostas(as("2026-11-23", "21:15"))).toMatchObject({ foraDeHoras: true });
    expect(await passagemDasPropostas(as("2026-11-24", "07:30"))).toBe("fora-da-janela");
    expect(base.enviados).toEqual([]);
  });

  it("o interruptor nasce LIGADO; desligado, nada sai", async () => {
    const { interruptorDasPropostas, enviarAsPropostasAoCliente } = await import("./envio-das-propostas-ao-cliente-na-base");
    expect((await interruptorDasPropostas()).ligado).toBe(true);
    base.interruptor = { ligado: 0 };
    base.pedidosDaMesa = [pedidoDaMesa()];
    expect(await enviarAsPropostasAoCliente(9102, AGORA)).toEqual({ ok: false, porque: "desligado" });
    expect(base.enviados).toEqual([]);
  });
});

describe("as rotinas e a ponte estão ligadas", () => {
  it("o cron das propostas existe, falha fechado, e a ponte dá a passagem", () => {
    const crons = (JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> }).crons;
    expect(crons).toContainEqual({ path: "/api/cron/propostas-ao-cliente", schedule: "2,17,32,47 * * * *" });
    const rota = ler("src/app/api/cron/propostas-ao-cliente/route.ts");
    expect(rota).toMatch(/if \(!secret\)[\s\S]*status: 503/);
    expect(ler("src/app/api/whatsapp/ponte/route.ts")).toContain("passagemDasPropostas()");
  });

  it("o interruptor das Configs é só do administrador, e ligar pede LIGAR", () => {
    const rota = ler("src/app/api/admin/propostas-ao-cliente/route.ts");
    expect(rota).toContain("requireAdminGeral");
    expect(rota).toContain('!== "LIGAR"');
    expect(ler("src/lib/envio-das-propostas-ao-cliente-na-base.ts")).toContain("LIGADO POR OMISSÃO");
  });

  it("o orçamento automático conta para a uma-por-dia de todas as rotinas", () => {
    expect(ler("src/lib/uma-mensagem-automatica-por-dia.ts")).toContain('tabela: "envioDasPropostasAoCliente", colunas: ["enviadoEm"]');
  });
});

/* ── O orçamento na língua da conversa (o #659) ─────────────────────────── */

describe("o orçamento sai na língua da conversa — uma conversa em inglês (o #659)", { timeout: 60_000 }, () => {
  /** Uma conversa toda em inglês, inventada. */
  const EM_INGLES = [
    { direccao: "in", texto: "Hello, I need to get rid of an old sofa and two mattresses", criadoEm: "", haSegundos: 7200 },
    { direccao: "out", texto: "Olá! Aqui é a Vitória, a assistente automática da CLYON.", criadoEm: "", haSegundos: 7100 },
    { direccao: "in", texto: "Thank you, the building has an elevator and there is parking", criadoEm: "", haSegundos: 7000 },
  ];

  it("a língua lê-se da conversa quando ainda não há nenhuma guardada", async () => {
    const { linguaDoFio } = await import("./lingua-da-conversa");
    expect(linguaDoFio(EM_INGLES)).toBe("en");
    expect(linguaDoFio([{ direccao: "in", texto: "Bom dia, preciso de levar um sofá velho" }])).toBeNull();
    expect(linguaDoFio([])).toBeNull();
  });

  it("em português, a localidade em português («Lisbon» é «Lisboa»); em inglês, «Lisbon», com o IVA e a validade traduzidos", async () => {
    const { traducaoFixa } = await import("./traducoes-fixas-da-vitoria");
    const p = pedidoDaMesa({ city: "Lisbon" });
    const pt = textoDoOrcamentoDaMesa(p, AGORA);
    expect(pt).toContain("para a recolha de monos em Lisboa:");
    expect(pt).not.toContain("Lisbon");
    const en = traducaoFixa(pt, "en");
    expect(en).not.toBeNull();
    expect(en).toContain("We have received 3 quotes for your request (bulky items removal) in Lisbon:");
    expect(en).toContain("Recolhas Inventadas: ");
    expect(en).toContain("+ VAT = ");
    expect(en).toContain("This quote is valid until Thursday, 26/11.");
    expect(en).not.toMatch(/\b(Olá|propostas|Já recebemos|válida até)\b/);
    expect(traducaoFixa(pt, "fr")).toContain("à Lisbonne :");
    expect(traducaoFixa(pt, "es")).toContain("en Lisboa:");
  });

  it("o automático, com o tradutor em baixo: sai pela tradução fixa, nunca em português, e a língua fica guardada", async () => {
    base.fio = EM_INGLES;
    base.traducao = "falha";
    base.pedidosDaMesa = [pedidoDaMesa({ city: "Lisbon" })];
    const { enviarAsPropostasAoCliente } = await import("./envio-das-propostas-ao-cliente-na-base");
    expect((await enviarAsPropostasAoCliente(9102, AGORA)).ok).toBe(true);
    expect(base.opcoesDoEnvio).toEqual([{ semLinguaErrada: true }]);
    expect(base.guardadas).toEqual(["en"]);
  });

  it("o automático, sem tradução fixa da mensagem: fica com uma pessoa, «cliente noutra língua»", async () => {
    base.fio = EM_INGLES;
    // Um nome de parceiro com um ponto a meio parte a frase em duas: a mensagem curta fica sem tradução fixa.
    const comPonto = negociacao(1, "J. Inventado", 100, antes(200));
    base.pedidosDaMesa = [pedidoDaMesa({ negociacoes: [comPonto] })];
    const { candidatosAoEnvio, enviarAsPropostasAoCliente } = await import("./envio-das-propostas-ao-cliente-na-base");
    const [c] = await candidatosAoEnvio(AGORA);
    const { traducaoFixa } = await import("./traducoes-fixas-da-vitoria");
    expect(traducaoFixa(c.texto, "en")).toBeNull();
    expect(c.estado).toEqual({ tipo: "fica", motivo: "noutra_lingua" });
    expect((await enviarAsPropostasAoCliente(9102, AGORA)).ok).toBe(false);
    expect(base.enviados).toEqual([]);
  });

  it("o botão: o tradutor falha e não há tradução fixa — não sai, e diz-se porquê", async () => {
    base.fio = EM_INGLES;
    base.traducao = "falha";
    const { orcamentoNaLinguaDaConversa } = await import("./lingua-da-conversa");
    const r = await orcamentoNaLinguaDaConversa("351912345678", "Olá! Isto é uma frase que não tem tradução fixa nenhuma, escrita à mão.");
    expect(r).toMatchObject({ ok: false, lingua: "en" });
    expect(r.ok === false && r.motivo).toContain("cliente noutra língua (inglês)");
    // Com a mensagem do orçamento, a tradução fixa chega.
    expect((await orcamentoNaLinguaDaConversa("351912345678", textoDoOrcamentoDaMesa(pedidoDaMesa(), AGORA))).ok).toBe(true);
    // E em português, sai sempre.
    base.fio = [];
    expect(await orcamentoNaLinguaDaConversa("351912345678", "Olá!")).toEqual({ ok: true, lingua: null });
  });

  it("o «Enviar pela CLYON» (Mesa e Trabalhos CLYON) vê a língua antes de enviar, e envia sem a língua errada", () => {
    for (const rota of ["src/app/api/admin/negociacoes/route.ts", "src/app/api/admin/trabalhos-clyon/route.ts"]) {
      const f = ler(rota);
      const i = f.indexOf("orcamentoNaLinguaDaConversa(telefone, texto, { guardar: true })");
      expect(i, rota).toBeGreaterThan(-1);
      expect(f.indexOf("enviarTextoManualWhatsApp(telefone, texto, { semLinguaErrada: true })"), rota).toBeGreaterThan(i);
      expect(f, rota).toContain("Não saiu: ${naLingua.motivo}.");
    }
  });
});
