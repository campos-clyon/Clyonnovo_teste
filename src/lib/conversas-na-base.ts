import { ensureSimulatorOrdersTable, ensureUsersSchema, getPool } from "./db";
import {
  conversaParaApagar,
  type AtendidaPor,
  type AutorDaMensagem,
  type Conversa,
  type ConversaParaAPurga,
  type MensagemGuardada,
} from "./conversas-da-clyon";

/**
 * AS CONVERSAS NA BASE — 30-10-2026 («Conversas», fase 1).
 *
 * Três tabelas, criadas como as outras do projecto (`CREATE TABLE IF NOT
 * EXISTS` à primeira chamada, uma vez por processo):
 *   · `conversas` — uma linha por conversa. `chaveUnica` impede duas
 *     «Suporte CLYON» na mesma conta (`suporte_cliente:<conta>`);
 *   · `mensagensDaConversa` — as mensagens; `textoOriginal` só quando o filtro
 *     tapou alguma coisa, e só a equipa o lê;
 *   · `leiturasDaConversa` — até onde cada um leu (`quem`: `cliente:<id>`,
 *     `profissional:<id>` ou `equipa`).
 * Mensagens e leituras saem com a conversa (ON DELETE CASCADE).
 *
 * As datas são do relógio da base (UTC); quem as mostra converte para Lisboa.
 */

let prontas = false;

async function ensureConversasTables() {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  if (prontas) return pool;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS conversas (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tipo             VARCHAR(30)  NOT NULL,
      pedidoId         INT          NULL DEFAULT NULL,
      negociacaoId     INT          NULL DEFAULT NULL,
      clienteContaId   INT UNSIGNED NULL DEFAULT NULL,
      profissionalId   INT          NULL DEFAULT NULL,
      estado           VARCHAR(20)  NOT NULL DEFAULT 'aberta',
      atendidaPor      VARCHAR(20)  NOT NULL DEFAULT 'equipa',
      chaveUnica       VARCHAR(80)  NULL DEFAULT NULL,
      criadaEm         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ultimaMensagemEm DATETIME     NULL DEFAULT NULL,
      fechadaEm        DATETIME     NULL DEFAULT NULL,
      UNIQUE KEY uq_conversa_chave (chaveUnica),
      KEY idx_conversa_cliente (clienteContaId, tipo),
      KEY idx_conversa_profissional (profissionalId, tipo),
      KEY idx_conversa_pedido (pedidoId),
      KEY idx_conversa_tipo_ultima (tipo, ultimaMensagemEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mensagensDaConversa (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      conversaId    INT UNSIGNED NOT NULL,
      autor         VARCHAR(20)  NOT NULL,
      autorId       INT          NULL DEFAULT NULL,
      texto         TEXT         NOT NULL,
      textoOriginal TEXT         NULL,
      filtrada      TINYINT(1)   NOT NULL DEFAULT 0,
      anexoUrl      VARCHAR(500) NULL DEFAULT NULL,
      criadaEm      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_mensagem_conversa (conversaId, id),
      CONSTRAINT fk_mensagem_conversa FOREIGN KEY (conversaId) REFERENCES conversas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS leiturasDaConversa (
      conversaId INT UNSIGNED NOT NULL,
      quem       VARCHAR(40)  NOT NULL,
      lidoAte    DATETIME     NOT NULL,
      PRIMARY KEY (conversaId, quem),
      CONSTRAINT fk_leitura_conversa FOREIGN KEY (conversaId) REFERENCES conversas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  prontas = true;
  return pool;
}

type Linha = Record<string, unknown>;

function iso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? `${s.replace(" ", "T")}Z` : s;
}

function conversaDaLinha(l: Linha): Conversa {
  const n = (x: unknown) => (x == null ? null : Number(x));
  return {
    id: Number(l.id),
    tipo: String(l.tipo) as Conversa["tipo"],
    pedidoId: n(l.pedidoId),
    negociacaoId: n(l.negociacaoId),
    clienteContaId: n(l.clienteContaId),
    profissionalId: n(l.profissionalId),
    estado: String(l.estado) as Conversa["estado"],
    atendidaPor: String(l.atendidaPor) as AtendidaPor,
    criadaEm: iso(l.criadaEm) ?? "",
    ultimaMensagemEm: iso(l.ultimaMensagemEm),
  };
}

function mensagemDaLinha(l: Linha): MensagemGuardada {
  return {
    id: Number(l.id),
    conversaId: Number(l.conversaId),
    autor: String(l.autor) as AutorDaMensagem,
    autorId: l.autorId == null ? null : Number(l.autorId),
    texto: String(l.texto ?? ""),
    textoOriginal: l.textoOriginal == null ? null : String(l.textoOriginal),
    filtrada: Number(l.filtrada) === 1,
    anexoUrl: l.anexoUrl == null ? null : String(l.anexoUrl),
    criadaEm: iso(l.criadaEm) ?? "",
  };
}

const COLUNAS = "c.id, c.tipo, c.pedidoId, c.negociacaoId, c.clienteContaId, c.profissionalId, c.estado, c.atendidaPor, c.criadaEm, c.ultimaMensagemEm";

/** A conta (users.id) deste email de cliente, ou null. */
export async function contaDoClientePorEmail(email: string): Promise<number | null> {
  await ensureUsersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [l] = (await pool.execute("SELECT id FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1", [email])) as [
    Linha[],
    unknown,
  ];
  return l[0] ? Number(l[0].id) : null;
}

/** A «Suporte CLYON» desta conta — cria-se ao primeiro uso, uma por conta. */
export async function suporteDoCliente(contaId: number): Promise<Conversa> {
  const pool = await ensureConversasTables();
  const chave = `suporte_cliente:${contaId}`;
  await pool.execute(
    `INSERT IGNORE INTO conversas (tipo, clienteContaId, estado, atendidaPor, chaveUnica)
     VALUES ('suporte_cliente', ?, 'aberta', 'vitoria', ?)`,
    [contaId, chave],
  );
  const [l] = (await pool.execute(`SELECT ${COLUNAS} FROM conversas c WHERE c.chaveUnica = ? LIMIT 1`, [chave])) as [
    Linha[],
    unknown,
  ];
  if (!l[0]) throw new Error("[conversas] a conversa de suporte não ficou gravada");
  return conversaDaLinha(l[0]);
}

export type ConversaNaLista = Conversa & { porLer: number; ultimaMensagem: string | null; ultimaFoiFiltrada: boolean };

async function listar(where: string, args: Array<string | number>, quem: string): Promise<ConversaNaLista[]> {
  const pool = await ensureConversasTables();
  const [l] = (await pool.execute(
    `SELECT ${COLUNAS},
            (SELECT m.texto FROM mensagensDaConversa m WHERE m.conversaId = c.id ORDER BY m.id DESC LIMIT 1) AS ultimaMensagem,
            (SELECT m.filtrada FROM mensagensDaConversa m WHERE m.conversaId = c.id ORDER BY m.id DESC LIMIT 1) AS ultimaFiltrada,
            (SELECT COUNT(*) FROM mensagensDaConversa m
              LEFT JOIN leiturasDaConversa r ON r.conversaId = c.id AND r.quem = ?
              WHERE m.conversaId = c.id AND m.autor <> ? AND (r.lidoAte IS NULL OR m.criadaEm > r.lidoAte)) AS porLer
       FROM conversas c
      WHERE ${where}
      ORDER BY COALESCE(c.ultimaMensagemEm, c.criadaEm) DESC
      LIMIT 200`,
    [quem, quem.split(":")[0], ...args],
  )) as [Linha[], unknown];
  return l.map((x) => ({
    ...conversaDaLinha(x),
    porLer: Number(x.porLer ?? 0),
    ultimaMensagem: x.ultimaMensagem == null ? null : String(x.ultimaMensagem),
    ultimaFoiFiltrada: Number(x.ultimaFiltrada) === 1,
  }));
}

/** As conversas de um cliente: o suporte dele e as dos pedidos dele. */
export function conversasDoCliente(contaId: number): Promise<ConversaNaLista[]> {
  return listar("c.clienteContaId = ? AND c.tipo IN ('suporte_cliente','pedido')", [contaId], `cliente:${contaId}`);
}

/** As conversas de um parceiro: o suporte dele e as dos pedidos em que foi contratado. */
export function conversasDoProfissional(providerId: number): Promise<ConversaNaLista[]> {
  return listar(
    "c.profissionalId = ? AND c.tipo IN ('suporte_profissional','pedido')",
    [providerId],
    `profissional:${providerId}`,
  );
}

export async function conversaPorId(id: number): Promise<Conversa | null> {
  const pool = await ensureConversasTables();
  const [l] = (await pool.execute(`SELECT ${COLUNAS} FROM conversas c WHERE c.id = ? LIMIT 1`, [id])) as [Linha[], unknown];
  return l[0] ? conversaDaLinha(l[0]) : null;
}

/** As últimas mensagens (até 200), da mais antiga para a mais nova. */
export async function mensagensDe(conversaId: number, limite = 200): Promise<MensagemGuardada[]> {
  const pool = await ensureConversasTables();
  const n = Math.max(1, Math.min(500, Math.floor(limite)));
  const [l] = (await pool.execute(
    `SELECT * FROM (SELECT id, conversaId, autor, autorId, texto, textoOriginal, filtrada, anexoUrl, criadaEm
                      FROM mensagensDaConversa WHERE conversaId = ? ORDER BY id DESC LIMIT ${n}) t
      ORDER BY id ASC`,
    [conversaId],
  )) as [Linha[], unknown];
  return l.map(mensagemDaLinha);
}

/** Grava uma mensagem e acerta a hora da última mensagem da conversa. */
export async function gravarMensagem(m: {
  conversaId: number;
  autor: AutorDaMensagem;
  autorId: number | null;
  texto: string;
  textoOriginal: string | null;
  filtrada: boolean;
  anexoUrl: string | null;
}): Promise<MensagemGuardada> {
  const pool = await ensureConversasTables();
  const [r] = (await pool.execute(
    `INSERT INTO mensagensDaConversa (conversaId, autor, autorId, texto, textoOriginal, filtrada, anexoUrl)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [m.conversaId, m.autor, m.autorId, m.texto, m.textoOriginal, m.filtrada ? 1 : 0, m.anexoUrl],
  )) as [{ insertId: number }, unknown];
  await pool.execute("UPDATE conversas SET ultimaMensagemEm = NOW() WHERE id = ?", [m.conversaId]);
  const [l] = (await pool.execute(
    "SELECT id, conversaId, autor, autorId, texto, textoOriginal, filtrada, anexoUrl, criadaEm FROM mensagensDaConversa WHERE id = ?",
    [r.insertId],
  )) as [Linha[], unknown];
  return mensagemDaLinha(l[0]);
}

/** Marca como lido até agora (relógio da base). */
export async function marcarLida(conversaId: number, quem: string): Promise<void> {
  const pool = await ensureConversasTables();
  await pool.execute(
    `INSERT INTO leiturasDaConversa (conversaId, quem, lidoAte) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE lidoAte = NOW()`,
    [conversaId, quem],
  );
}

/** «Falar com uma pessoa»: a conversa passa a ser atendida pela equipa. */
export async function passarParaAEquipa(conversaId: number): Promise<void> {
  const pool = await ensureConversasTables();
  await pool.execute("UPDATE conversas SET atendidaPor = 'equipa' WHERE id = ?", [conversaId]);
}

/* ── A equipa (backoffice) ─────────────────────────────────────────────── */

export type SuporteNaMesa = ConversaNaLista & { clienteNome: string | null; clienteEmail: string | null };

/** As conversas «Suporte — clientes» para a equipa, com as por ler da equipa. */
export async function suportesDosClientes(): Promise<SuporteNaMesa[]> {
  await ensureUsersSchema();
  const lista = await listar("c.tipo = 'suporte_cliente' AND c.ultimaMensagemEm IS NOT NULL", [], "equipa");
  if (lista.length === 0) return [];
  const pool = await ensureConversasTables();
  const ids = [...new Set(lista.map((c) => c.clienteContaId).filter((x): x is number => x != null))];
  const nomes = new Map<number, { nome: string | null; email: string | null }>();
  if (ids.length) {
    const [l] = (await pool.query("SELECT id, name, email FROM users WHERE id IN (?)", [ids])) as [Linha[], unknown];
    for (const u of l) nomes.set(Number(u.id), { nome: (u.name as string) ?? null, email: (u.email as string) ?? null });
  }
  return lista.map((c) => ({
    ...c,
    clienteNome: nomes.get(c.clienteContaId ?? 0)?.nome ?? null,
    clienteEmail: nomes.get(c.clienteContaId ?? 0)?.email ?? null,
  }));
}

/** Quantas mensagens de clientes no suporte a equipa ainda não leu (o selo). */
export async function suportePorLerDaEquipa(): Promise<number> {
  const pool = await ensureConversasTables();
  const [l] = (await pool.execute(
    `SELECT COUNT(*) AS n
       FROM mensagensDaConversa m
       JOIN conversas c ON c.id = m.conversaId AND c.tipo = 'suporte_cliente'
       LEFT JOIN leiturasDaConversa r ON r.conversaId = c.id AND r.quem = 'equipa'
      WHERE m.autor = 'cliente' AND (r.lidoAte IS NULL OR m.criadaEm > r.lidoAte)`,
  )) as [Linha[], unknown];
  return Number(l[0]?.n ?? 0);
}

/* ── A purga ───────────────────────────────────────────────────────────── */

/**
 * As conversas que já passaram do prazo (decisão 3b). A base dá as idades
 * pelo relógio dela; quem decide é `conversaParaApagar` (pura, com testes).
 * A seco (`aSerio: false`) só conta. Até 2000 por noite.
 */
export async function purgarConversas(
  prazos: { mesesDoPedido: number; diasDoSuporte: number },
  opcoes: { aSerio?: boolean } = {},
): Promise<number> {
  const aSerio = opcoes.aSerio !== false;
  await ensureSimulatorOrdersTable();
  const pool = await ensureConversasTables();
  const minimo = Math.max(1, Math.min(prazos.diasDoSuporte, prazos.mesesDoPedido * 28));
  const [l] = (await pool.execute(
    `SELECT c.id, c.tipo, c.estado,
            (o.id IS NOT NULL) AS pedidoExiste,
            TIMESTAMPDIFF(DAY, COALESCE(c.ultimaMensagemEm, c.criadaEm), NOW()) AS diasSemMensagens,
            TIMESTAMPDIFF(MONTH, COALESCE(c.fechadaEm, c.ultimaMensagemEm, c.criadaEm), NOW()) AS mesesDesdeQueFechou
       FROM conversas c
       LEFT JOIN simulatorOrders o ON o.id = c.pedidoId
      WHERE COALESCE(c.ultimaMensagemEm, c.criadaEm) < NOW() - INTERVAL ${minimo} DAY
      LIMIT 2000`,
  )) as [Linha[], unknown];
  const ids = l
    .map(
      (x): ConversaParaAPurga => ({
        id: Number(x.id),
        tipo: String(x.tipo),
        estado: String(x.estado),
        pedidoExiste: Number(x.pedidoExiste) === 1,
        diasSemMensagens: Number(x.diasSemMensagens ?? 0),
        mesesDesdeQueFechou: Number(x.mesesDesdeQueFechou ?? 0),
      }),
    )
    .filter((c) => conversaParaApagar(c, prazos))
    .map((c) => c.id);
  if (!aSerio || ids.length === 0) return ids.length;
  const [r] = (await pool.query("DELETE FROM conversas WHERE id IN (?)", [ids])) as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0);
}
