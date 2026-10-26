import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AS REGRAS NOVAS DA RETENÇÃO NUMA BASE FINGIDA — d32, 26-10-2026.
 *
 * *«Testes: cada regra (A–G) em ensaio não muda nada; com o interruptor ligado
 * faz o que deve (base fingida); carteiras, comissões e histórico do
 * profissional iguais antes e depois de A; nunca se apaga um concluído com
 * preço; um ficheiro usado por outro pedido não sai.»*
 *
 * A base é uma lista de linhas em memória e um encaminhador de SQL: cada
 * consulta que `regras-novas-na-base.ts` faz tem a sua resposta, e cada
 * UPDATE, DELETE e INSERT fica escrito em `escritas`. O ensaio passa se essa
 * lista acabar vazia — e se o Blob não tiver sido chamado para apagar nada.
 */

type Linha = Record<string, any>;

const base = vi.hoisted(() => ({
  pedidos: [] as Linha[],
  negociacoes: [] as Linha[],
  pagamentos: [] as Linha[],
  movimentos: [] as Linha[],
  arquivo: [] as Linha[],
  registo: [] as Linha[],
  leadsVelhos: 0,
  telemovelVelhas: 0,
  blobs: [] as Array<{ url: string; pathname: string; size: number; uploadedAt: Date }>,
  /** O que as outras tabelas dizem (anexos das Finanças, fotografias pendentes, perfis). */
  outrosTextos: [] as string[],
  escritas: [] as Array<{ sql: string; params: unknown[] }>,
}));

const URL = (c: string) => `https://loja.public.blob.vercel-storage.com/${c}`;
const ARRUMADOS = ["cancelado", "arquivado", "rejeitado"];

function responder(sqlBruto: string, params: unknown[] = []): [unknown, unknown] {
  const sql = sqlBruto.replace(/\s+/g, " ").trim();
  if (/^(UPDATE|DELETE|INSERT)/i.test(sql)) {
    base.escritas.push({ sql, params });
    // O efeito do UPDATE da anonimização na linha do pedido, para o resto da passagem o ver.
    const m = sql.match(/^UPDATE simulatorOrders SET (.+?), anonimizadoEm = NOW\(\)/);
    if (m) {
      const colunas = m[1].split(",").map((c) => c.trim().replace(/ = \?$/, ""));
      const id = params[params.length - 1];
      const p = base.pedidos.find((x) => x.id === id && !x.anonimizado);
      if (!p) return [{ affectedRows: 0 }, null];
      colunas.forEach((c, i) => (p[c] = params[i]));
      p.anonimizado = true;
      return [{ affectedRows: 1 }, null];
    }
    if (/^DELETE FROM leads/.test(sql)) return [{ affectedRows: base.leadsVelhos }, null];
    if (/^DELETE FROM whatsappNoTelemovel/.test(sql)) return [{ affectedRows: base.telemovelVelhas }, null];
    return [{ affectedRows: 1 }, null];
  }
  if (sql.includes("information_schema.COLUMNS")) {
    return [
      [
        { t: "simulatorOrders", c: "filesJson" },
        { t: "negociacoes", c: "provaJson" },
        { t: "financasMovimentos", c: "anexoUrl" },
      ],
      null,
    ];
  }
  if (sql.includes("information_schema.TABLES")) {
    return [(params as string[]).map((t) => ({ t })), null];
  }
  if (sql.startsWith("SELECT CONCAT_WS")) {
    if (sql.includes("`simulatorOrders`")) {
      return [base.pedidos.map((p) => ({ texto: [p.filesJson, p.rawOrderJson].filter(Boolean).join(" ") })), null];
    }
    if (sql.includes("`negociacoes`")) return [base.negociacoes.map((n) => ({ texto: n.provaJson ?? null })), null];
    return [base.outrosTextos.map((texto) => ({ texto })), null];
  }
  if (sql.includes("AS diasParado")) {
    return [
      base.pedidos.map((p) => ({
        id: p.id,
        status: p.status,
        anonimizado: p.anonimizado ? 1 : 0,
        dataPassou: p.dataPassou === false ? 0 : 1,
        temPreco: p.precoFinal != null || p.lucroManual != null || p.valorFixoClyon != null ? 1 : 0,
        diasParado: p.diasParado,
      })),
      null,
    ];
  }
  if (sql.includes("AS negociacaoCriadaEm FROM negociacoes n")) return [base.negociacoes, null];
  if (/FROM pagamentos$/.test(sql)) {
    return [base.pagamentos.map((p) => ({ ...p, viva: p.estado === "pendente" ? 1 : 0 })), null];
  }
  if (sql.includes("FROM movimentosDaCarteira WHERE negociacaoId IS NOT NULL GROUP BY")) {
    const n = new Map<number, number>();
    for (const m of base.movimentos) n.set(m.negociacaoId, (n.get(m.negociacaoId) ?? 0) + 1);
    return [[...n].map(([negociacaoId, c]) => ({ negociacaoId, n: c })), null];
  }
  if (sql === "SELECT id, filesJson, rawOrderJson, calendarEventId FROM simulatorOrders") return [base.pedidos, null];
  if (sql.startsWith("SELECT provaJson, ajustesJson FROM negociacoes WHERE pedidoId IN")) {
    return [base.negociacoes.filter((n) => (params as number[]).includes(n.pedidoId)), null];
  }
  if (/FROM simulatorOrders WHERE id = \? AND anonimizadoEm IS NULL FOR UPDATE$/.test(sql)) {
    return [base.pedidos.filter((p) => p.id === params[0] && !p.anonimizado), null];
  }
  if (sql.startsWith("SELECT id, provaJson, ajustesJson FROM negociacoes WHERE pedidoId = ?")) {
    return [base.negociacoes.filter((n) => n.pedidoId === params[0]), null];
  }
  if (sql.startsWith("SELECT o.id FROM simulatorOrders o WHERE o.id = ?")) {
    // A verificação de última hora, avaliada aqui pela mesma regra.
    const p = base.pedidos.find((x) => x.id === params[0]);
    const negs = base.negociacoes.filter((n) => n.pedidoId === params[0]);
    const ids = negs.map((n) => n.id);
    const pode =
      p &&
      !p.anonimizado &&
      !negs.some(
        (n) =>
          ["acordada", "aguarda_contratacao"].includes(n.estado) ||
          n.execucaoEnviadaEm ||
          n.confirmadoEm ||
          n.pagoEm ||
          (n.valorAcordado != null && !ARRUMADOS.includes(p.status)),
      ) &&
      !(p.status === "concluido" && (p.precoFinal != null || p.lucroManual != null || p.valorFixoClyon != null)) &&
      !base.pagamentos.some((g) => g.pedidoId === p.id || ids.includes(g.negociacaoId)) &&
      !base.movimentos.some((m) => m.pedidoId === p.id || ids.includes(m.negociacaoId));
    return [pode ? [{ id: p!.id }] : [], null];
  }
  const arquivoComCliente = (a: Linha) =>
    a.anonimizadoEm == null && (a.clienteEmail != null || / /.test(a.clienteNome ?? "") || !String(a.dados).startsWith('{"anonimizado":true'));
  const registoComCliente = (r: Linha) =>
    r.acontecimento === "pedido_expurgado" && r.anonimizadoEm == null && (r.clienteEmail != null || / /.test(r.clienteNome ?? ""));
  if (sql.startsWith("SELECT COUNT(*) AS n FROM arquivoDePedidos")) return [[{ n: base.arquivo.filter(arquivoComCliente).length }], null];
  if (sql.startsWith("SELECT COUNT(*) AS n FROM registoPermanente")) return [[{ n: base.registo.filter(registoComCliente).length }], null];
  if (sql.startsWith("SELECT id, motivo, clienteNome, dados FROM arquivoDePedidos")) return [base.arquivo.filter(arquivoComCliente), null];
  if (sql.startsWith("SELECT id, clienteNome FROM registoPermanente")) return [base.registo.filter(registoComCliente), null];
  if (sql.startsWith("SELECT COUNT(*) AS n FROM leads")) return [[{ n: base.leadsVelhos }], null];
  if (sql.startsWith("SELECT COUNT(*) AS n FROM whatsappNoTelemovel")) return [[{ n: base.telemovelVelhas }], null];
  throw new Error(`SQL sem resposta na base fingida: ${sql.slice(0, 160)}`);
}

const pool = vi.hoisted(() => ({
  execute: async (sql: string, params?: unknown[]) => responder(sql, params ?? []),
  getConnection: async () => ({
    execute: async (sql: string, params?: unknown[]) => responder(sql, params ?? []),
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  }),
}));

vi.mock("./db", () => ({
  getPool: async () => pool,
  ensureSimulatorOrdersTable: async () => {},
  ensureNegociacoesTable: async () => {},
  ensureMovimentosTable: async () => {},
  ensureRegistoTable: async () => {},
  ensureArquivoDePedidosTable: async () => {},
  ensureLeadsExtended: async () => {},
  PEDIDOS_POR_PASSAGEM_DA_PURGA: 100,
  apagarFotosDoBlob: vi.fn(async (urls: string[]) => urls.length),
  /*
   * Como a verdadeira: depois de a linha mudar, só sai o que nenhum outro
   * pedido usa (o «Duplicar»).
   */
  semAsQueOutroPedidoUsa: vi.fn(async (urls: string[]) =>
    [...new Set(urls)].filter(
      (u) => !base.pedidos.some((p) => String(p.filesJson ?? "").includes(u) || String(p.rawOrderJson ?? "").includes(u)),
    ),
  ),
  deleteSimulatorOrder: vi.fn(async () => ({
    fotos: 0,
    fotosApagadas: 0,
    eventoApagado: false,
    eventoNaAgenda: null,
    eventoNaoEncontrado: false,
  })),
  guardarEventoPorApagar: vi.fn(async () => {}),
  registarNaTransaccao: vi.fn(async (_conn: unknown, linha: unknown) => {
    base.escritas.push({ sql: "INSERT INTO registoPermanente", params: [linha] });
  }),
}));

vi.mock("./blob-token", () => ({ obterTokenDoBlob: () => ({ ok: true, modo: "oidc", storeId: "store_fingido" }) }));
vi.mock("@vercel/blob", () => ({
  list: vi.fn(async ({ prefix }: { prefix: string }) => ({
    blobs: base.blobs.filter((b) => b.pathname.startsWith(prefix)),
    hasMore: false,
  })),
  del: vi.fn(async () => {}),
}));
vi.mock("./apagar-evento-do-calendario", () => ({
  apagarEventoDoCalendario: vi.fn(async () => ({ apagado: true })),
}));

import * as db from "./db";
import { purgarComAsRegrasNovas, regrasNovasDaNoite, regrasNovasEmPalavras, referidoNoTexto } from "./regras-novas-na-base";

const AGORA = new Date("2026-10-26T12:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);
const PARTILHADO = URL("simulador/1700000000000-ab12cd-sofa.jpg");

function encher() {
  base.escritas.length = 0;
  base.pedidos = [
    // 101 — concluído, confirmado e pago, há 120 dias: A anonimiza.
    {
      id: 101,
      status: "concluido",
      diasParado: 120,
      contactName: "Maria Joana Exemplo",
      contactPhone: "912345678",
      contactEmail: "maria.joana@exemplo.pt",
      address: "Rua das Flores 12",
      city: "Cascais",
      postalCode: "2750-123",
      description: "Sofá na garagem",
      filesJson: JSON.stringify([{ url: PARTILHADO }, { url: URL("simulador/1700000000001-zz99yy-armario.jpg") }]),
      rawOrderJson: JSON.stringify({ origemPedido: "simulador", contactEmail: "maria.joana@exemplo.pt" }),
      calendarEventId: "evento-101",
      calendarTargetId: "agenda-equipa",
      serviceType: "recolha-moveis",
    },
    // 102 — pendente e recente; a cópia do 101 («Duplicar») com a mesma fotografia.
    { id: 102, status: "pendente", diasParado: 5, filesJson: JSON.stringify([{ url: PARTILHADO }]), rawOrderJson: null },
    // 103 — cancelado, com acordo morto, sem trabalho nem dinheiro, há 70 dias: B apaga.
    { id: 103, status: "cancelado", diasParado: 70, filesJson: null, rawOrderJson: null },
    // 104 — concluído com preço, fechado à mão, há 70 dias: D — nunca se apaga; ainda não fez 90.
    { id: 104, status: "concluido", diasParado: 70, precoFinal: "250.00", filesJson: null, rawOrderJson: null },
    // 105 — cancelado; o cliente pagou e o trabalho não se fez: fica (dinheiro por devolver).
    { id: 105, status: "cancelado", diasParado: 200, filesJson: null, rawOrderJson: null },
    // 106 — rejeitado sem nada, há 65 dias: G — sai aos 60.
    { id: 106, status: "rejeitado", diasParado: 65, filesJson: null, rawOrderJson: null },
    // 107 — concluído com preço, fechado à mão, há 200 dias: D + A — anonimiza, nunca se apaga.
    { id: 107, status: "concluido", diasParado: 200, precoFinal: "300.00", contactName: "Ana", filesJson: null, rawOrderJson: null },
  ];
  base.negociacoes = [
    {
      id: 901,
      pedidoId: 101,
      estado: "acordada",
      valorAcordado: "200.00",
      execucaoEnviadaEm: "2026-06-20T10:00:00Z",
      confirmadoEm: "2026-06-21T10:00:00Z",
      pagoEm: "2026-06-25T10:00:00Z",
      formaDePagamento: null,
      ofertaClyon: null,
      semFactura: 0,
      negociacaoCriadaEm: "2026-10-02T10:00:00Z",
      provaJson: JSON.stringify({ fotos: [URL("trabalhos/901/prova.jpg")], nota: "na porta da Maria", em: "2026-06-20T10:00:00Z" }),
      ajustesJson: null,
    },
    { id: 903, pedidoId: 103, estado: "morta", valorAcordado: "150.00", execucaoEnviadaEm: null, confirmadoEm: null, pagoEm: null, negociacaoCriadaEm: "2026-08-01T10:00:00Z" },
    { id: 905, pedidoId: 105, estado: "morta", valorAcordado: "180.00", execucaoEnviadaEm: null, confirmadoEm: null, pagoEm: null, negociacaoCriadaEm: "2026-08-01T10:00:00Z" },
  ];
  base.pagamentos = [
    { id: 1, negociacaoId: 901, negociacaoPaga: 901, pedidoId: 101, estado: "pago", metodo: "mbway", pagoEm: "2026-06-19T10:00:00Z" },
    { id: 2, negociacaoId: 905, negociacaoPaga: 905, pedidoId: 105, estado: "pago", metodo: "multibanco", pagoEm: "2026-04-01T10:00:00Z" },
  ];
  base.movimentos = [{ negociacaoId: 901, pedidoId: 101 }];
  base.arquivo = [
    { id: 1, motivo: "retenção de 60 dias", clienteNome: "Rui Exemplo Teste", clienteEmail: "rui@exemplo.pt", dados: JSON.stringify({ pedido: { id: 50, city: "Lisboa", contactName: "Rui Exemplo Teste" } }), anonimizadoEm: null },
    { id: 2, motivo: "retenção de 60 dias", clienteNome: "Rita", clienteEmail: null, dados: '{"anonimizado":true,"pedido":{"id":51}}', anonimizadoEm: null },
  ];
  base.registo = [
    { id: 1, acontecimento: "pedido_expurgado", clienteNome: "Rui Exemplo Teste", clienteEmail: "rui@exemplo.pt", anonimizadoEm: null },
    { id: 2, acontecimento: "pedido_criado", clienteNome: "Outra Pessoa", clienteEmail: "outra@exemplo.pt", anonimizadoEm: null },
  ];
  base.leadsVelhos = 3;
  base.telemovelVelhas = 2;
  base.blobs = [
    // Sem referência e com 40 dias: sai.
    { url: URL("simulador/1690000000000-aa11bb-esquecida.jpg"), pathname: "simulador/1690000000000-aa11bb-esquecida.jpg", size: 2 * 1024 * 1024, uploadedAt: dias(40) },
    // Sem referência mas com 5 dias (um pedido a meio): fica.
    { url: URL("simulador/1729000000000-cc22dd-recente.jpg"), pathname: "simulador/1729000000000-cc22dd-recente.jpg", size: 1000, uploadedAt: dias(5) },
    // Antiga, mas usada por um pedido: fica.
    { url: PARTILHADO, pathname: "simulador/1700000000000-ab12cd-sofa.jpg", size: 1000, uploadedAt: dias(200) },
    // Antiga, usada num anexo das Finanças (também vive em simulador/): fica.
    { url: URL("simulador/f0e1d2c3-factura-gasoleo.pdf"), pathname: "simulador/f0e1d2c3-factura-gasoleo.pdf", size: 1000, uploadedAt: dias(90) },
    // Antiga, com um nome que tem espaço codificado e parênteses, referida na base: fica.
    { url: URL("simulador/1695000000000-ee33ff-foto%20(1).jpg"), pathname: "simulador/1695000000000-ee33ff-foto (1).jpg", size: 1000, uploadedAt: dias(90) },
  ];
  base.outrosTextos = [
    `{"anexoUrl":"${URL("simulador/f0e1d2c3-factura-gasoleo.pdf")}"}`,
    `[{"url":"${URL("simulador/1695000000000-ee33ff-foto%20(1).jpg")}"}]`,
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  encher();
});

describe("em ENSAIO, cada regra (A–G) conta e não muda nada", () => {
  it("nenhum UPDATE, DELETE ou INSERT — e nada sai do Blob nem da agenda", async () => {
    const r = await regrasNovasDaNoite({ aSerio: false, agora: AGORA });
    expect(base.escritas).toEqual([]);
    expect(db.apagarFotosDoBlob).not.toHaveBeenCalled();
    expect(db.deleteSimulatorOrder).not.toHaveBeenCalled();
    expect(db.guardarEventoPorApagar).not.toHaveBeenCalled();
    expect(r.aSerio).toBe(false);
  });

  it("A: anonimizaria o 101 e o 107 — e diz porque é que o 105 fica", async () => {
    const r = await regrasNovasDaNoite({ aSerio: false, agora: AGORA });
    expect(r.a.pedidos).toBe(2);
    expect([...r.a.ids].sort()).toEqual([101, 107]);
    expect(r.a.ficheiros).toBe(2);
    expect(r.a.fotografiasDaProva).toBe(1);
    expect(r.a.ficheirosPartilhados).toBe(1);
    expect(r.a.eventos).toBe(1);
    expect(r.a.ficamPorDinheiro).toBe(1); // o 105
    expect(r.a.aindaNoPrazo).toBe(1); // o 104
    expect(r.a.feitos).toBe(0);
  });

  it("B e G: com as regras novas a purga levaria o 103 e o 106; hoje, nenhum", async () => {
    const r = await regrasNovasDaNoite({ aSerio: false, agora: AGORA });
    expect([...r.b.ids].sort()).toEqual([103, 106]);
    expect(r.b.comAsNovas).toBe(2);
    expect(r.b.hoje).toBe(0);
    expect(r.b.semTrabalhoNemDinheiro).toBe(1);
    expect(r.b.rejeitados).toBe(1);
  });

  it("C, E, F e G: contados", async () => {
    const r = await regrasNovasDaNoite({ aSerio: false, agora: AGORA });
    expect(r.c).toEqual({ arquivo: 1, registo: 1, feitas: 0 });
    expect(r.e.ficheiros).toBe(1);
    expect(r.e.lista).toEqual(["simulador/1690000000000-aa11bb-esquecida.jpg"]);
    expect(r.e.bytes).toBe(2 * 1024 * 1024);
    expect(r.e.apagados).toBe(0);
    expect(r.f).toEqual({ contactos: 3, apagados: 0 });
    expect(r.g).toEqual({ telemovel: 2, apagadas: 0 });
  });

  it("a frase da noite diz que é ensaio e dá os números", async () => {
    const frase = regrasNovasEmPalavras(await regrasNovasDaNoite({ aSerio: false, agora: AGORA }));
    expect(frase).toContain("ENSAIO (nada mudou)");
    expect(frase).toContain("anonimizaria 2");
    expect(frase).toContain("apagaria 2 em vez de 0");
    expect(frase).toContain("1 ficheiros órfãos (2,0 MB)");
    expect(frase.length).toBeLessThan(300);
  });

  it("a purga com as regras novas, a seco, não apaga nada", async () => {
    const r = await purgarComAsRegrasNovas({ aSerio: false });
    expect(r.aSerio).toBe(false);
    expect([...r.naMira].sort()).toEqual([103, 106]);
    expect(db.deleteSimulatorOrder).not.toHaveBeenCalled();
    expect(base.escritas).toEqual([]);
  });
});

describe("com o interruptor ligado, faz o que deve", () => {
  it("A: o 101 fica com o primeiro nome e a localidade, e nada mais que identifique", async () => {
    const r = await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
    expect(r.a.feitos).toBe(2);
    const p = base.pedidos.find((x) => x.id === 101)!;
    expect(p.anonimizado).toBe(true);
    expect(p.contactName).toBe("Maria");
    expect(p.city).toBe("Cascais");
    expect(p.postalCode).toBe("2750");
    const texto = JSON.stringify(p);
    for (const pessoal of ["Joana", "Exemplo", "912345678", "maria.joana@exemplo.pt", "Rua das Flores", "2750-123", "Sofá", "armario.jpg"]) {
      expect(texto, pessoal).not.toContain(pessoal);
    }
  });

  it("A: um ficheiro usado por outro pedido não sai; os outros (do pedido e da prova) saem", async () => {
    await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
    const apagados = vi.mocked(db.apagarFotosDoBlob).mock.calls.flatMap((c) => c[0]);
    expect(apagados).toContain(URL("simulador/1700000000001-zz99yy-armario.jpg"));
    expect(apagados).toContain(URL("trabalhos/901/prova.jpg"));
    expect(apagados).not.toContain(PARTILHADO);
  });

  it("A: a prova perde as fotografias, e nenhuma coluna de dinheiro das negociações é escrita", async () => {
    await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
    const nas = base.escritas.filter((e) => e.sql.startsWith("UPDATE negociacoes"));
    expect(nas).toHaveLength(1);
    expect(nas[0].sql).toBe("UPDATE negociacoes SET provaJson = ?, ajustesJson = ?, updatedAt = updatedAt WHERE id = ?");
    expect(JSON.parse(String(nas[0].params[0])).fotos).toEqual([]);
    expect(String(nas[0].params[0])).not.toContain("Maria");
    // O pedido mantém a data de última mexida (as comissões contam por ela nos antigos).
    const doPedido = base.escritas.find((e) => e.sql.startsWith("UPDATE simulatorOrders"))!;
    expect(doPedido.sql).toContain("updatedAt = updatedAt");
    expect(doPedido.sql).not.toMatch(/precoFinal|valorAcordado|lucroManual|status =|concluidoEm/);
  });

  it("A: o evento sai da agenda e fica uma linha no registo, sem o cliente", async () => {
    await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
    const linhas = vi.mocked(db.registarNaTransaccao).mock.calls.map((c) => c[1] as Linha);
    const do101 = linhas.find((l) => l.pedidoId === 101)!;
    expect(do101.acontecimento).toBe("pedido_anonimizado");
    expect(do101.clienteEmail).toBeUndefined();
    expect(do101.clienteNome).toBeUndefined();
    expect(JSON.stringify(do101)).not.toContain("Maria");
    const { apagarEventoDoCalendario } = await import("./apagar-evento-do-calendario");
    expect(apagarEventoDoCalendario).toHaveBeenCalledWith("evento-101", "agenda-equipa");
  });

  it("D: o concluído com preço é anonimizado e nunca chega ao apagar", async () => {
    await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
    await purgarComAsRegrasNovas({ aSerio: true });
    const apagados = vi.mocked(db.deleteSimulatorOrder).mock.calls.map((c) => c[0]);
    expect(apagados).not.toContain(104);
    expect(apagados).not.toContain(107);
    expect(base.pedidos.find((x) => x.id === 107)!.anonimizado).toBe(true);
  });

  it("B e G: a purga apaga o 103 e o 106, pela porta de sempre, e mais nenhum", async () => {
    const r = await purgarComAsRegrasNovas({ aSerio: true });
    expect(r.aSerio).toBe(true);
    const apagados = vi.mocked(db.deleteSimulatorOrder).mock.calls.map((c) => c[0]);
    expect([...apagados].sort()).toEqual([103, 106]);
    for (const c of vi.mocked(db.deleteSimulatorOrder).mock.calls) {
      const contexto = c[1] as Linha;
      expect(contexto.acontecimento).toBe("pedido_expurgado");
      // A guarda de dentro (um trabalho em curso não sai) nunca se desarma aqui.
      expect(contexto.mesmoComTrabalhoEmCurso).toBeUndefined();
    }
  });

  it("B: se entrar dinheiro depois da decisão e antes do apagar, a verificação de última hora segura o pedido", async () => {
    const original = pool.execute;
    // O pagamento chega no instante entre a decisão (já tomada) e a pergunta de última hora.
    pool.execute = async (sql: string, params?: unknown[]) => {
      if (sql.replace(/\s+/g, " ").includes("SELECT o.id FROM simulatorOrders o WHERE o.id = ?") && params?.[0] === 103) {
        base.pagamentos.push({ id: 3, negociacaoId: 903, negociacaoPaga: 903, pedidoId: 103, estado: "pago", metodo: "mbway" });
      }
      return original(sql, params);
    };
    try {
      const r = await purgarComAsRegrasNovas({ aSerio: true });
      const apagados = vi.mocked(db.deleteSimulatorOrder).mock.calls.map((c) => c[0]);
      expect(apagados).toEqual([106]);
      expect(r.falhados).toEqual([
        { pedidoId: 103, erro: "a verificação de última hora encontrou trabalho, acordo ou dinheiro — ficou" },
      ]);
    } finally {
      pool.execute = original;
    }
  });

  it("C: as linhas antigas ficam com o primeiro nome e sem email; as já anónimas não se tocam", async () => {
    const r = await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
    const doArquivo = base.escritas.filter((e) => e.sql.startsWith("UPDATE arquivoDePedidos"));
    expect(doArquivo).toHaveLength(1);
    expect(doArquivo[0].params[0]).toBe("Rui");
    expect(doArquivo[0].params[1]).toBe("retenção de 60 dias");
    expect(String(doArquivo[0].params[2])).not.toContain("Teste");
    expect(doArquivo[0].params[3]).toBe(1);
    const doRegisto = base.escritas.filter((e) => e.sql.startsWith("UPDATE registoPermanente"));
    expect(doRegisto).toHaveLength(1);
    expect(doRegisto[0].sql).toContain("acontecimento = 'pedido_expurgado'");
    expect(doRegisto[0].params).toEqual(["Rui", 1]);
    expect(r.c.feitas).toBe(2);
  });

  it("E: sai só o ficheiro sem referência e com mais de 30 dias", async () => {
    const r = await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
    const chamadas = vi.mocked(db.apagarFotosDoBlob).mock.calls.map((c) => c[0]);
    const orfaos = chamadas.find((l) => l.some((u) => u.includes("esquecida")));
    expect(orfaos).toEqual([URL("simulador/1690000000000-aa11bb-esquecida.jpg")]);
    expect(chamadas.flat()).not.toContain(URL("simulador/1729000000000-cc22dd-recente.jpg"));
    expect(chamadas.flat()).not.toContain(URL("simulador/f0e1d2c3-factura-gasoleo.pdf"));
    expect(r.e.apagados).toBe(1);
  });

  it("E: se uma tabela não se deixar ler, nessa noite não sai ficheiro nenhum", async () => {
    const original = pool.execute;
    pool.execute = async (sql: string, params?: unknown[]) => {
      if (sql.startsWith("SELECT CONCAT_WS")) throw new Error("tabela partida");
      return original(sql, params);
    };
    try {
      const r = await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
      expect(r.e.erro).toContain("tabela partida");
      const chamadas = vi.mocked(db.apagarFotosDoBlob).mock.calls.flatMap((c) => c[0]);
      expect(chamadas).not.toContain(URL("simulador/1690000000000-aa11bb-esquecida.jpg"));
    } finally {
      pool.execute = original;
    }
  });

  it("E: se a lista das colunas vier sem as dos pedidos e das provas, não se confia nela — nada sai", async () => {
    const original = pool.execute;
    pool.execute = async (sql: string, params?: unknown[]) =>
      sql.includes("information_schema.COLUMNS") ? [[], null] : original(sql, params);
    try {
      const r = await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
      expect(r.e.erro).toContain("não se confia nela");
      const chamadas = vi.mocked(db.apagarFotosDoBlob).mock.calls.flatMap((c) => c[0]);
      expect(chamadas.some((u) => u.includes("esquecida") || u.includes("gasoleo"))).toBe(false);
    } finally {
      pool.execute = original;
    }
  });

  it("E: se mais de metade dos ficheiros parecer órfã, é a leitura que está mal — nada sai", async () => {
    for (let i = 0; i < 30; i++) {
      base.blobs.push({ url: URL(`simulador/170000000${i}-sem-dono.jpg`), pathname: `simulador/170000000${i}-sem-dono.jpg`, size: 10, uploadedAt: dias(100) });
    }
    const r = await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
    expect(r.e.erro).toContain("demasiados para ser verdade");
    expect(vi.mocked(db.apagarFotosDoBlob).mock.calls.flatMap((c) => c[0]).some((u) => u.includes("sem-dono"))).toBe(false);
  });

  it("F e G: os contactos com mais de 60 dias e as conversas do telemóvel saem", async () => {
    const r = await regrasNovasDaNoite({ aSerio: true, agora: AGORA });
    expect(base.escritas.some((e) => /^DELETE FROM leads WHERE createdAt < NOW\(\) - INTERVAL 60 DAY$/.test(e.sql))).toBe(true);
    expect(base.escritas.some((e) => e.sql.startsWith("DELETE FROM whatsappNoTelemovel") && e.sql.includes("60 * 86400"))).toBe(true);
    expect(r.f.apagados).toBe(3);
    expect(r.g.apagadas).toBe(2);
  });
});

describe("um ficheiro referido de qualquer forma fica", () => {
  it("pelo nome tal como está, codificado ou descodificado", () => {
    expect(referidoNoTexto(`x ${URL("simulador/a-b.jpg")} y`, "simulador/a-b.jpg")).toBe(true);
    expect(referidoNoTexto(`"${URL("simulador/foto%20(1).jpg")}"`, "simulador/foto (1).jpg")).toBe(true);
    expect(referidoNoTexto("simulador/foto (1).jpg", "simulador/foto%20(1).jpg")).toBe(true);
    expect(referidoNoTexto("nada aqui", "simulador/outro.jpg")).toBe(false);
  });
});
