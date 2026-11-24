import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * d102 (CEO e dono, 24-11-2026) — «cada passo, desde quando o cliente entra
 * até ao momento em que ele sai, a Vitória tem de estar a acompanhar»:
 *   (a) o pedido sem propostas (ou sem parceiros na zona): um aviso ao cliente;
 *   (b) o SIM pelo WhatsApp avisa o parceiro contratado, como no painel;
 *   (c) cancelar é igual em todo o lado (conversa, Vitória, painel, app);
 *   (d) «Recebemos o seu pedido #N», com o que falta, sem repetir o 1.º lembrete.
 * Base fingida; nenhuma mensagem sai a ninguém. Números e nomes INVENTADOS.
 */

const e = vi.hoisted(() => ({
  ordem: [] as string[],
  enviados: [] as Array<{ para: string; texto: string }>,
  emails: [] as Array<{ para: string; texto: string }>,
  jaSaiuHoje: false,
  naoContactar: false,
  // (a)
  pedidosSemPropostas: [] as Array<Record<string, unknown>>,
  negociacoes: [] as Array<Record<string, unknown>>,
  avisos: new Map<number, { estado: string; porque: string | null }>(),
  // (c)
  pedido: { id: 812, status: "enviado", anonimizadoEm: null as string | null, contactPhone: "351910000001", contactEmail: null as string | null, valorFixoClyon: null, serviceType: "recolha_monos", city: "Almada", scheduledDate: null, dataAgendada: null },
  contratado: false,
  pago: false,
  // (d)
  recebidos: new Map<number, string>(),
  oQueFalta: null as string | null,
  marcadosPeloRecebido: [] as number[],
}));

const pool = vi.hoisted(() => ({
  query: async (sql: string) => pool.execute(sql, []),
  execute: async (sql: string, params: unknown[] = []): Promise<[unknown, unknown]> => {
    // (a) os candidatos e as tabelas do aviso
    if (/FROM simulatorOrders o\s+LEFT JOIN envioAutomaticoAosParceiros/.test(sql)) return [e.pedidosSemPropostas, []];
    if (/SELECT pedidoId, estado, propostasJson, createdAt FROM negociacoes/.test(sql)) return [e.negociacoes, []];
    if (/SELECT pedidoId, estado, porque FROM semPropostasAoCliente/.test(sql))
      return [[...e.avisos].map(([pedidoId, a]) => ({ pedidoId, ...a })), []];
    if (/INSERT IGNORE INTO semPropostasAoCliente/.test(sql)) {
      const id = Number(params[0]);
      if (e.avisos.has(id)) return [{ affectedRows: 0 }, []];
      e.avisos.set(id, { estado: "a_enviar", porque: null });
      return [{ affectedRows: 1 }, []];
    }
    if (/UPDATE semPropostasAoCliente SET estado = 'a_enviar'/.test(sql)) {
      const id = Number(params[2]);
      if (e.avisos.get(id)?.estado !== "fica") return [{ affectedRows: 0 }, []];
      e.avisos.set(id, { estado: "a_enviar", porque: null });
      return [{ affectedRows: 1 }, []];
    }
    if (/UPDATE semPropostasAoCliente SET estado = 'enviado'/.test(sql)) {
      e.avisos.set(Number(params[0]), { estado: "enviado", porque: null });
      return [{ affectedRows: 1 }, []];
    }
    if (/INSERT INTO semPropostasAoCliente[\s\S]*'fica'/.test(sql)) {
      const id = Number(params[0]);
      if (!e.avisos.has(id)) e.avisos.set(id, { estado: "fica", porque: String(params[2]) });
      return [{ affectedRows: 1 }, []];
    }
    // (c) o pedido a cancelar
    if (/FROM simulatorOrders o WHERE o\.id = \?/.test(sql)) return [[e.pedido], []];
    if (/FROM negociacoes n/.test(sql)) return [e.contratado ? [{ x: 1 }] : [], []];
    if (/FROM pagamentos WHERE pedidoId = \? AND \(estado = 'pago'/.test(sql)) return [e.pago ? [{ x: 1 }] : [], []];
    if (/SELECT id, status, contactPhone FROM simulatorOrders/.test(sql)) return [[], []];
    if (/UPDATE vitoriaCancelamentos SET canceladoEm/.test(sql)) return [{ affectedRows: 1 }, []];
    // (d) o «recebemos»
    if (/SELECT id, status, anonimizadoEm, contactPhone FROM simulatorOrders WHERE id = \?/.test(sql))
      return [[{ id: params[0], status: "pendente", anonimizadoEm: null, contactPhone: "910000002" }], []];
    if (/INSERT IGNORE INTO pedidoRecebidoAoCliente \(pedidoId, estado\) VALUES \(\?, 'a_enviar'\)/.test(sql)) {
      const id = Number(params[0]);
      if (e.recebidos.has(id)) return [{ affectedRows: 0 }, []];
      e.recebidos.set(id, "a_enviar");
      return [{ affectedRows: 1 }, []];
    }
    if (/INSERT IGNORE INTO pedidoRecebidoAoCliente/.test(sql)) {
      const id = Number(params[0]);
      if (!e.recebidos.has(id)) e.recebidos.set(id, String(params[1]));
      return [{ affectedRows: 1 }, []];
    }
    if (/UPDATE pedidoRecebidoAoCliente SET estado = 'a_enviar'/.test(sql)) {
      const id = Number(params[0]);
      if (e.recebidos.get(id) !== "espera") return [{ affectedRows: 0 }, []];
      e.recebidos.set(id, "a_enviar");
      return [{ affectedRows: 1 }, []];
    }
    if (/UPDATE pedidoRecebidoAoCliente SET estado = 'enviado'/.test(sql)) {
      e.recebidos.set(Number(params[1]), "enviado");
      return [{ affectedRows: 1 }, []];
    }
    return [[], []];
  },
}));

vi.mock("./db", async (original) => ({
  ...(await original<typeof import("./db")>()),
  getPool: vi.fn(async () => pool),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  ensureNegociacoesTable: vi.fn(async () => {}),
  negociacoesDoPedido: vi.fn(async () => [{ id: 5, estado: "aberta", providerId: 41, taxaCliente: 0, taxaProfissional: 10 }]),
  cancelarPedido: vi.fn(async () => {
    e.ordem.push("cancelar");
    return { encerradas: 1 };
  }),
  gravarMotivoDoFecho: vi.fn(async () => {}),
  appendOrderHistory: vi.fn(async () => {}),
  registarSemFalhar: vi.fn(async () => {}),
  quemTemOTrabalhoClyon: vi.fn(async () => ({ vivos: [] })),
  apagarConversaWhatsApp: vi.fn(async () => {
    e.ordem.push("apagar-conversa");
    return 1;
  }),
  numeroBloqueadoWhatsApp: vi.fn(async () => false),
  numeroInterrompidoWhatsApp: vi.fn(async () => false),
  mensagensDoNumeroWhatsApp: vi.fn(async () => []),
}));
vi.mock("./avisar-cancelamento", () => ({
  avisarDoCancelamento: vi.fn(async () => {
    e.ordem.push("avisar-parceiros");
  }),
}));
vi.mock("./validade-do-orcamento-na-base", () => ({ marcarCicloTerminado: vi.fn(async () => {}) }));
vi.mock("./seguimento-do-cliente-na-base", () => ({ pararSeguimento: vi.fn(async () => true) }));
vi.mock("./whatsapp-cloud", () => ({
  enviarTextoWhatsApp: vi.fn(async (para: string, texto: string) => {
    e.ordem.push("mensagem");
    e.enviados.push({ para, texto });
    return true;
  }),
  enviarAvisoWhatsApp: vi.fn(async (para: string, texto: string) => {
    e.enviados.push({ para, texto });
    return true;
  }),
}));
vi.mock("./seguimento-da-app-envio", () => ({
  enviarEmailDoSeguimento: vi.fn(async (p: { para: string; texto: string }) => {
    e.ordem.push("email");
    e.emails.push(p);
    return true;
  }),
}));
vi.mock("./nao-contactar", () => ({
  marcarParaNaoContactar: vi.fn(async () => {
    e.ordem.push("nao-contactar");
    return true;
  }),
  eParaNaoContactar: vi.fn(async () => e.naoContactar),
}));
vi.mock("./uma-mensagem-automatica-por-dia", () => ({
  jaSaiuHojeUmaMensagemAutomatica: vi.fn(async () => e.jaSaiuHoje || e.naoContactar),
}));
vi.mock("./regras-novas-na-base", () => ({
  anonimizarPedido: vi.fn(async (id: number) => {
    e.ordem.push("anonimizar");
    return { pedidoId: id, fotografias: 0, fotografiasApagadas: 0, eventoApagado: false };
  }),
}));
vi.mock("./lembrete-do-que-falta-na-base", () => ({
  oQueFaltaParaORecebido: vi.fn(async () => e.oQueFalta),
  marcarOPrimeiroPeloRecebido: vi.fn(async (id: number) => {
    e.marcadosPeloRecebido.push(id);
  }),
}));

import {
  decidirOAvisoSemPropostas,
  haRespostaDeParceiro,
  pedidoSemPropostas,
  textoSemPropostas,
} from "./sem-propostas-ao-cliente";
import { rotinaSemPropostas } from "./sem-propostas-ao-cliente-na-base";
import { cancelarEApagarNaHora, type OrigemDoCancelamento } from "./cancelar-pelo-cliente-na-base";
import { cancelarPeloLembreteComum } from "./cancelar-pelo-lembrete";
import { FONTE_DO_CANCELAR_DO_AGENTE } from "./vitoria-agente/accoes-na-base";
import { decidirORecebido, textoDoRecebido } from "./recebemos-o-pedido";
import { avisarQueRecebemosOPedido } from "./recebemos-o-pedido-na-base";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** 24-11-2026 às 15h de Lisboa (UTC no Inverno). */
const TARDE = new Date("2026-11-24T15:00:00Z");
const NOITE = new Date("2026-11-24T22:30:00Z");
const MANHA_CEDO = new Date("2026-11-24T07:30:00Z");
const horasAntes = (d: Date, h: number) => new Date(d.getTime() - h * 3600_000);

beforeEach(() => {
  e.ordem = [];
  e.enviados = [];
  e.emails = [];
  e.jaSaiuHoje = false;
  e.naoContactar = false;
  e.pedidosSemPropostas = [];
  e.negociacoes = [];
  e.avisos = new Map();
  e.contratado = false;
  e.pago = false;
  e.pedido = { ...e.pedido, status: "enviado", contactEmail: null };
  e.recebidos = new Map();
  e.oQueFalta = null;
  e.marcadosPeloRecebido = [];
});
afterEach(() => vi.clearAllMocks());

/* ── (a) ─────────────────────────────────────────────────────────────────── */

describe("d102 (a) — o pedido sem propostas: a regra", () => {
  const base = { pedidoId: 700, status: "enviado", anonimizado: false, trabalhoClyon: false, deTeste: false, semParceirosDesde: null };
  const aberta = (h: number, propostasJson = "[]") => ({ estado: "aberta", propostasJson, criadaEm: horasAntes(TARDE, h) });

  it("24 h depois de seguir para os parceiros, sem proposta: entra; antes disso, não", () => {
    expect(pedidoSemPropostas({ ...base, negociacoes: [aberta(25), aberta(24.5)] }, TARDE)?.motivo).toBe("sem_propostas");
    expect(pedidoSemPropostas({ ...base, negociacoes: [aberta(23)] }, TARDE)).toBeNull();
  });

  it("com uma proposta ou um aceite de um parceiro, não entra", () => {
    expect(haRespostaDeParceiro([aberta(30, JSON.stringify([{ por: "profissional", valor: 90 }]))])).toBe(true);
    expect(pedidoSemPropostas({ ...base, negociacoes: [aberta(30), { estado: "aguarda_contratacao", propostasJson: "[]", criadaEm: null }] }, TARDE)).toBeNull();
    expect(pedidoSemPropostas({ ...base, negociacoes: [aberta(30, JSON.stringify([{ por: "cliente", valor: 50 }]))] }, TARDE)?.motivo).toBe("sem_propostas");
  });

  it("«sem parceiros na zona» entra logo; fechado, de teste ou Trabalho CLYON não", () => {
    expect(pedidoSemPropostas({ ...base, negociacoes: [], semParceirosDesde: horasAntes(TARDE, 1) }, TARDE)?.motivo).toBe("sem_parceiros");
    for (const p of [{ status: "cancelado" }, { deTeste: true }, { trabalhoClyon: true }, { anonimizado: true }]) {
      expect(pedidoSemPropostas({ ...base, ...p, negociacoes: [aberta(30)] }, TARDE)).toBeNull();
    }
  });

  it("o horário, a uma-por-dia (e o «não contactar», que ela inclui) e a conversa com uma pessoa", () => {
    const c = { telemovel: "351910000003", email: null, comUmaPessoa: false, bloqueado: false, jaSaiuHoje: false, jaAvisado: false };
    expect(decidirOAvisoSemPropostas(c, TARDE)).toEqual({ tipo: "sai", canal: "whatsapp" });
    expect(decidirOAvisoSemPropostas(c, NOITE).tipo).toBe("espera");
    expect(decidirOAvisoSemPropostas(c, MANHA_CEDO).tipo).toBe("espera");
    expect(decidirOAvisoSemPropostas({ ...c, jaSaiuHoje: true }, TARDE).tipo).toBe("espera");
    expect(decidirOAvisoSemPropostas({ ...c, comUmaPessoa: true }, TARDE).tipo).toBe("fica");
    expect(decidirOAvisoSemPropostas({ ...c, jaAvisado: true }, TARDE).tipo).toBe("ja_saiu");
    expect(decidirOAvisoSemPropostas({ ...c, telemovel: null, email: "cliente@exemplo.pt" }, TARDE)).toEqual({ tipo: "sai", canal: "email" });
  });

  it("os textos: «parceiro», o n.º do pedido, sem prazos nem «profissional»; o WhatsApp tem tradução fixa", () => {
    for (const m of ["sem_propostas", "sem_parceiros"] as const) {
      for (const canal of ["whatsapp", "email"] as const) {
        const t = textoSemPropostas(m, 700, canal);
        expect(t).toContain("#700");
        expect(t).toContain("parceiros");
        expect(t).not.toMatch(/profissiona|horas|amanhã|hoje|virtual/i);
        expect(t).not.toMatch(/\bIA\b/);
      }
      for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(textoSemPropostas(m, 700, "whatsapp"), l)).not.toBeNull();
    }
  });
});

describe("d102 (a) — o pedido sem propostas: a rotina", () => {
  const umPedido = () => {
    e.pedidosSemPropostas = [{ id: 700, status: "enviado", anonimizadoEm: null, valorFixoClyon: null, contactName: "Cliente Inventado", contactEmail: null, contactPhone: "910000003", semParceirosEm: null }];
    e.negociacoes = [{ pedidoId: 700, estado: "aberta", propostasJson: "[]", createdAt: horasAntes(TARDE, 26) }];
  };

  it("sai UMA vez por pedido: a segunda passagem já não envia", async () => {
    umPedido();
    const r1 = await rotinaSemPropostas(TARDE);
    expect(r1.enviados).toBe(1);
    expect(e.enviados).toHaveLength(1);
    expect(e.enviados[0].texto).toContain("#700");
    const r2 = await rotinaSemPropostas(TARDE);
    expect(r2.enviados).toBe(0);
    expect(e.enviados).toHaveLength(1);
  });

  it("fora das 8h–21h, ou com outra mensagem automática hoje (ou «não contactar»), não sai", async () => {
    umPedido();
    expect((await rotinaSemPropostas(NOITE)).enviados).toBe(0);
    e.naoContactar = true;
    expect((await rotinaSemPropostas(TARDE)).enviados).toBe(0);
    e.naoContactar = false;
    e.jaSaiuHoje = true;
    expect((await rotinaSemPropostas(TARDE)).enviados).toBe(0);
    expect(e.enviados).toHaveLength(0);
  });

  it("a rotina está no vercel.json, conta na uma-por-dia, e o «Do nosso lado» tem o grupo", () => {
    expect(ler("vercel.json")).toContain('"/api/cron/pedidos-sem-propostas"');
    expect(ler("src/lib/uma-mensagem-automatica-por-dia.ts")).toContain('tabela: "semPropostasAoCliente"');
    expect(ler("src/lib/do-nosso-lado.ts")).toContain('["sem_propostas", semPropostasDoNossoLado(');
    expect(ler("src/components/admin/DoNossoLado.tsx")).toContain("/api/admin/negociacoes/sem-propostas");
  });
});

/* ── (b) ─────────────────────────────────────────────────────────────────── */

describe("d102 (b) — o SIM pelo WhatsApp avisa o parceiro contratado, uma vez", () => {
  const W = ler("src/lib/whatsapp-negociacao.ts");
  const corpo = W.slice(W.indexOf("async function fecharPeloCliente("), W.indexOf("/** Recusar pelo cliente"));

  it("fecharPeloCliente avisa o contratado UMA vez, e só depois de o fecho ficar gravado", () => {
    expect(corpo.match(/avisarOContratadoDoFechoPeloWhatsApp\(/g)).toHaveLength(1);
    expect(corpo.indexOf("avisarOContratadoDoFechoPeloWhatsApp(")).toBeGreaterThan(corpo.indexOf("if (!gravou.ok)"));
    expect(W).toMatch(/export async function avisarOContratadoDoFechoPeloWhatsApp[\s\S]{0,900}avisarQueFoiContratadoSemFalhar\(/);
  });

  it("os três fechos passam por fecharPeloCliente: as regras, o SIM à Vitória e o «1» da validade (d62)", () => {
    expect(W).toContain('if (accao === "ct") await fecharPeloCliente(telefone, alvo);');
    expect(W).toContain("if (eDeFechar) await fecharPeloCliente(telefone, alvo, conteudo.texto);");
    const validade = W.slice(W.indexOf("export async function responderAoLembreteDoOrcamento("), W.indexOf("export async function responderAoSeguimentoDoCliente("));
    expect(validade).toContain("await fecharPeloCliente(telefone, alvo);");
    expect(ler("src/lib/vitoria-agente/ao-vivo-na-base.ts")).toMatch(/fecharPeloBotao:[\s\S]{0,400}id: `ct:\$\{pedidoId\}:\$\{negociacaoId\}`/);
  });

  it("o painel e a app avisam pela mesma função (não há um segundo aviso no fecho do WhatsApp)", () => {
    expect(ler("src/lib/agir-como-cliente.ts")).toMatch(/if \(nova\.estado === "acordada"\) \{[\s\S]{0,700}await avisarQueFoiContratadoSemFalhar\(/);
    expect(corpo).not.toContain("avisarQueFoiContratado(");
    expect(corpo).not.toContain("avisarProfissionalContratadoPorPush(");
  });
});

/* ── (c) ─────────────────────────────────────────────────────────────────── */

describe("d102 (c) — cancelar é igual pela conversa, pela Vitória, pelo painel e pela app", () => {
  const ORDEM_DA_D93 = ["cancelar", "avisar-parceiros", "mensagem", "nao-contactar", "anonimizar", "apagar-conversa"];
  const MENSAGEM = "O seu pedido #812 foi cancelado. Não voltaremos a contactá-lo e os seus dados foram apagados.";

  it("o mesmo resultado nas quatro portas: cancelado, parceiros avisados, a mensagem, «não contactar», anonimizado", async () => {
    for (const origem of ["conversa", "link", "conta", "app"] as OrigemDoCancelamento[]) {
      e.ordem = [];
      e.enviados = [];
      const r = await cancelarEApagarNaHora(812, { origem, telefone: origem === "conversa" ? "351910000001" : null, verificarTelefone: origem === "conversa" });
      expect(r.ok, origem).toBe(true);
      expect(e.ordem, origem).toEqual(ORDEM_DA_D93);
      expect(e.enviados[0]?.texto, origem).toBe(MENSAGEM);
    }
  });

  it("pela Vitória agente (o CANCELAR à pergunta): o caminho da d93, não a purga dos 7 dias", async () => {
    expect(FONTE_DO_CANCELAR_DO_AGENTE.anonimizaNaHora).toBe(true);
    const r = await cancelarPeloLembreteComum(FONTE_DO_CANCELAR_DO_AGENTE, pool as never, 812, "351910000001", {
      verificar: async () => ({ eClyon: false, servico: "recolha_monos", localidade: "Almada" }),
    });
    expect(r.ok).toBe(true);
    expect(e.ordem).toEqual(ORDEM_DA_D93);
    expect(e.enviados[0]?.texto).toBe(MENSAGEM);
  });

  it("sem telemóvel português, a confirmação vai por email", async () => {
    e.pedido = { ...e.pedido, contactPhone: null as unknown as string, contactEmail: "cliente@exemplo.pt" };
    const r = await cancelarEApagarNaHora(812, { origem: "app", verificarTelefone: false });
    expect(r.ok && r.mensagemPor).toBe("email");
    expect(e.emails[0]?.texto).toBe(MENSAGEM);
    e.pedido = { ...e.pedido, contactPhone: "351910000001", contactEmail: null };
  });

  it("as excepções (contratado, com data, pago) ficam com a equipa — em todas as portas", async () => {
    for (const origem of ["conversa", "vitoria", "link", "app"] as OrigemDoCancelamento[]) {
      for (const marca of ["contratado", "pago", "data"] as const) {
        e.ordem = [];
        if (marca === "data") e.pedido = { ...e.pedido, dataAgendada: "2026-12-01" as unknown as null };
        else e[marca] = true;
        const r = await cancelarEApagarNaHora(812, { origem, telefone: "351910000001", verificarTelefone: origem === "conversa" });
        expect(r.ok, `${origem}/${marca}`).toBe(false);
        expect(!r.ok && r.daEquipa, `${origem}/${marca}`).toBe(true);
        expect(e.ordem, `${origem}/${marca}`).toEqual([]);
        e.contratado = false;
        e.pago = false;
        e.pedido = { ...e.pedido, dataAgendada: null };
      }
    }
  });

  it("o painel e a app chamam o caminho da d93 antes do cancelamento de sempre, e a excepção passa à equipa", () => {
    const A = ler("src/lib/agir-como-cliente.ts");
    const bloco = A.slice(A.indexOf('if (accao === "cancelar_pedido") {'), A.indexOf("eAccaoDosEscolhidos(accao)"));
    expect(bloco.indexOf("cancelarEApagarNaHora(")).toBeGreaterThan(0);
    expect(bloco.indexOf("cancelarEApagarNaHora(")).toBeLessThan(bloco.indexOf("await cancelarPedido("));
    expect(bloco).toContain("interromperNumeroWhatsApp(");
  });

  it("o email do seguimento já não diz «responda a este email»: diz como cancelar (o link)", () => {
    const S = ler("src/lib/seguimento-do-cliente.ts");
    const corpoDoParaEmail = S.slice(S.indexOf("export function paraEmail("), S.indexOf("export function paraEmail(") + 700);
    expect(corpoDoParaEmail).not.toMatch(/responda a este email/i);
    expect(corpoDoParaEmail).toContain("cancelar o pedido, abra-o aqui: ${link}");
    expect(ler("src/lib/seguimento-do-cliente-na-base.ts")).toContain("paraEmail(texto, link)");
  });
});

/* ── (d) ─────────────────────────────────────────────────────────────────── */

describe("d102 (d) — «Recebemos o seu pedido #N»", () => {
  const FALTA =
    "Boa tarde! Aqui é a equipa da CLYON.\n\nO seu pedido #901 (recolha em Almada) está quase pronto para seguir para os parceiros da sua zona. Só falta:\n\n- A morada";

  it("o texto: sozinho, ou a abrir o «Pedir o que falta» (o mesmo texto, uma só mensagem)", () => {
    expect(textoDoRecebido(901, null)).toBe("Recebemos o seu pedido #901. Assim que houver novidades, digo-lhe por aqui.");
    const t = textoDoRecebido(901, FALTA);
    expect(t).toContain("Recebemos o seu pedido #901 (recolha em Almada). Está quase pronto");
    expect(t).toContain("Aqui é a equipa da CLYON.");
    expect(t).toContain("- A morada");
    expect(t.match(/#901/g)).toHaveLength(1);
    for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(textoDoRecebido(901, null), l)).not.toBeNull();
  });

  it("das 8h às 21h; fora disso, à espera das 8h; nunca a quem está em «não contactar»", () => {
    const s = { telemovel: "351910000002", naoContactar: false, bloqueado: false, comUmaPessoa: false, jaTratado: false };
    expect(decidirORecebido(s, TARDE).tipo).toBe("sai");
    expect(decidirORecebido(s, NOITE).tipo).toBe("espera");
    expect(decidirORecebido(s, new Date("2026-11-24T08:05:00Z")).tipo).toBe("sai");
    expect(decidirORecebido({ ...s, naoContactar: true }, TARDE).tipo).toBe("nao");
    expect(decidirORecebido({ ...s, telemovel: null }, TARDE).tipo).toBe("nao");
  });

  it("uma só mensagem, com o que falta, e a 1.ª do ciclo fica dada (o lembrete dos 30 min não sai)", async () => {
    e.oQueFalta = FALTA;
    await avisarQueRecebemosOPedido(901, TARDE);
    await avisarQueRecebemosOPedido(901, TARDE);
    expect(e.enviados).toHaveLength(1);
    expect(e.enviados[0].texto).toContain("Recebemos o seu pedido #901");
    expect(e.marcadosPeloRecebido).toEqual([901]);
  });

  it("completo: só o «recebemos», e o ciclo do que falta não é tocado", async () => {
    await avisarQueRecebemosOPedido(902, TARDE);
    expect(e.enviados.map((x) => x.texto)).toEqual(["Recebemos o seu pedido #902. Assim que houver novidades, digo-lhe por aqui."]);
    expect(e.marcadosPeloRecebido).toEqual([]);
  });

  it("à noite não sai (fica para as 8h); em «não contactar», nunca", async () => {
    await avisarQueRecebemosOPedido(903, NOITE);
    expect(e.recebidos.get(903)).toBe("espera");
    e.naoContactar = true;
    await avisarQueRecebemosOPedido(904, TARDE);
    expect(e.enviados).toHaveLength(0);
  });

  it("o simulador e o formulário chamam-no; a rotina das 8h corre antes da do que falta", () => {
    expect(ler("src/app/api/simulador/pedido/route.ts")).toContain("after(() => avisarQueRecebemosOPedido(id))");
    expect(ler("src/app/api/hero-quote/route.ts")).toContain("after(() => avisarQueRecebemosOPedido(novoId))");
    const cron = ler("src/app/api/cron/lembretes-do-que-falta/route.ts");
    expect(cron.indexOf("rotinaDoRecebido(")).toBeLessThan(cron.indexOf("return rotinaDoQueFalta("));
  });
});

/* ── (e) ─────────────────────────────────────────────────────────────────── */

describe("d102 (e) — os interruptores desligados, sem duplicar quando se ligarem", () => {
  const A = ler("src/lib/assistente-automatico.ts");

  it("«Está marcado» não sai com o «Avisar o cliente da data» ligado; a confirmação e a avaliação não vão pelo WhatsApp a quem tem email", () => {
    expect(A).toContain('.filter((n) => !(n.especie === "dia_marcado" && podeFazer("avisar_data")))');
    expect(A).toContain('.filter((n) => !((n.especie === "trabalho_feito" || n.especie === "avaliacao") && temEmail(p.contactEmail)));');
    expect(ler("src/lib/db.ts")).toContain("SELECT o.id, o.contactName, o.contactPhone, o.contactEmail, o.serviceType, o.status,");
  });

  it("as mensagens do assistente ao cliente passam pela uma-por-dia e pelo «não contactar»; o aviso da data também", () => {
    const envio = A.slice(A.indexOf("for (const n of novidadeAContar(p, agora, podeFazer))"), A.indexOf("const saiu = await enviarTextoWhatsApp(n.telefone, n.texto)"));
    expect(envio.indexOf("jaSaiuHojeUmaMensagemAutomatica(")).toBeGreaterThan(0);
    expect(envio.indexOf("jaSaiuHojeUmaMensagemAutomatica(")).toBeLessThan(envio.indexOf("reservarAvisoDoAssistente("));
    expect(A).toMatch(/eParaNaoContactar\(telefoneDoCliente\)[\s\S]{0,200}enviarAvisoWhatsApp\(telefoneDoCliente, texto\)/);
  });
});
