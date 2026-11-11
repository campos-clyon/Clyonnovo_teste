/**
 * O PROGRAMA DE ACESSO ANTECIPADO DA APP, NA BASE — 11-11-2026.
 *
 * Uma tabela NOVA (`programaDaApp`): nada do que já existe muda, e por isso
 * não há nada a copiar antes. Uma linha por EMAIL (chave única): é o email
 * que vai para a lista de testadores da Play, e duas linhas com o mesmo davam
 * dois convites à mesma pessoa. As regras puras estão em `programa-da-app.ts`.
 *
 * APAGAR A CONTA APAGA A INSCRIÇÃO: `apagarContaDeCliente` (db.ts) chama
 * `apagarInscricaoNaTransaccao` na mesma transacção, e o DELETE das contas no
 * backoffice chama `apagarInscricoesDaConta`. A purga da noite tira as de
 * quem saiu há mais de `DIAS_DO_PROGRAMA_DEPOIS_DE_SAIR` e as que ficaram sem
 * conta (`purgarProgramaDaApp`).
 *
 * As datas escrevem-se com UTC_TIMESTAMP() — a base é lida em UTC.
 */

import { getPool } from "./db";
import {
  accaoDaInscricao,
  eEstadoDoPrograma,
  type EstadoNoPrograma,
  type LinhaDoPrograma,
  type OrigemDaInscricao,
} from "./programa-da-app";

let tabelaPronta = false;

/** O CREATE, também lido pelo teste (as colunas que identificam a pessoa). */
export const SQL_DA_TABELA_DO_PROGRAMA = `
    CREATE TABLE IF NOT EXISTS programaDaApp (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email           VARCHAR(255) NOT NULL,
      userId          INT UNSIGNED NULL DEFAULT NULL,
      origem          VARCHAR(16)  NOT NULL DEFAULT 'conta',
      estado          VARCHAR(16)  NOT NULL DEFAULT 'inscrito',
      consentimentoEm DATETIME NOT NULL,
      adicionadoEm    DATETIME NULL DEFAULT NULL,
      adicionadoPor   VARCHAR(120) NULL DEFAULT NULL,
      convidadoEm     DATETIME NULL DEFAULT NULL,
      convidadoPor    VARCHAR(120) NULL DEFAULT NULL,
      saiuEm          DATETIME NULL DEFAULT NULL,
      criadoEm        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_programa_da_app_email (email),
      KEY programa_da_app_conta (userId),
      KEY programa_da_app_estado (estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

export async function ensureProgramaDaApp() {
  const pool = await getPool();
  if (!pool) throw new Error("[programa-da-app] base de dados indisponível");
  if (!tabelaPronta) {
    await pool.execute(SQL_DA_TABELA_DO_PROGRAMA);
    tabelaPronta = true;
  }
  return pool;
}

type LinhaDaBase = {
  id: number;
  email: string;
  userId: number | null;
  origem: string;
  estado: string;
  consentimentoEm: Date | string | null;
  adicionadoEm: Date | string | null;
  adicionadoPor: string | null;
  convidadoEm: Date | string | null;
  convidadoPor: string | null;
  saiuEm: Date | string | null;
};

function paraLinha(l: LinhaDaBase): LinhaDoPrograma {
  return {
    id: Number(l.id),
    email: String(l.email),
    userId: l.userId == null ? null : Number(l.userId),
    estado: eEstadoDoPrograma(l.estado) ? l.estado : "inscrito",
  };
}

const iso = (v: Date | string | null | undefined): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

const COLUNAS =
  "id, email, userId, origem, estado, consentimentoEm, adicionadoEm, adicionadoPor, convidadoEm, convidadoPor, saiuEm";

/** O id da conta deste email (não apagada), ou `null`. */
export async function idDaContaDoCliente(email: string): Promise<number | null> {
  const pool = await ensureProgramaDaApp();
  const [l] = (await pool.execute("SELECT id FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1", [
    email.trim().toLowerCase(),
  ])) as [Array<{ id: number }>, unknown];
  return l[0] ? Number(l[0].id) : null;
}

export type InscricaoDaConta = { estado: EstadoNoPrograma; email: string; convidadoEm: string | null } | null;

/** A inscrição desta conta: pela conta, ou pelo email da conta (se não for de outra). */
export async function inscricaoDaConta(userId: number | null, emailDaConta: string): Promise<InscricaoDaConta> {
  const pool = await ensureProgramaDaApp();
  const [linhas] = (await pool.execute(
    `SELECT ${COLUNAS} FROM programaDaApp
      WHERE userId = ? OR (email = ? AND userId IS NULL)
      ORDER BY (userId IS NULL), id DESC LIMIT 1`,
    [userId ?? 0, emailDaConta.trim().toLowerCase()],
  )) as [LinhaDaBase[], unknown];
  const l = linhas[0];
  if (!l) return null;
  return { estado: paraLinha(l).estado, email: String(l.email), convidadoEm: iso(l.convidadoEm) };
}

/**
 * Inscreve (ou reinscreve) — idempotente. Quem chama já validou o email e o
 * consentimento (`validarInscricao`).
 */
export async function inscreverNoPrograma(p: {
  email: string;
  userId: number | null;
  origem: OrigemDaInscricao;
}): Promise<{ ok: true; estado: EstadoNoPrograma }> {
  const pool = await ensureProgramaDaApp();
  const [pe] = (await pool.execute(`SELECT ${COLUNAS} FROM programaDaApp WHERE email = ? LIMIT 1`, [
    p.email,
  ])) as [LinhaDaBase[], unknown];
  let daConta: LinhaDoPrograma | null = null;
  if (p.userId != null) {
    const [pc] = (await pool.execute(`SELECT ${COLUNAS} FROM programaDaApp WHERE userId = ? ORDER BY id DESC LIMIT 1`, [
      p.userId,
    ])) as [LinhaDaBase[], unknown];
    daConta = pc[0] ? paraLinha(pc[0]) : null;
  }
  const porEmail = pe[0] ? paraLinha(pe[0]) : null;
  const accao = accaoDaInscricao(p.userId, porEmail, daConta);

  switch (accao.tipo) {
    case "de-outra-conta":
      // Não se mexe, e não se diz de quem é: para quem pergunta, está inscrito.
      return { ok: true, estado: "inscrito" };
    case "renovar":
      await pool.execute(
        "UPDATE programaDaApp SET consentimentoEm = UTC_TIMESTAMP(), userId = COALESCE(userId, ?) WHERE id = ?",
        [p.userId, accao.id],
      );
      return { ok: true, estado: porEmail!.estado };
    case "reentrar":
      await pool.execute(
        `UPDATE programaDaApp
            SET estado = 'inscrito', consentimentoEm = UTC_TIMESTAMP(), origem = ?, userId = COALESCE(userId, ?),
                adicionadoEm = NULL, adicionadoPor = NULL, convidadoEm = NULL, convidadoPor = NULL, saiuEm = NULL
          WHERE id = ?`,
        [p.origem, p.userId, accao.id],
      );
      return { ok: true, estado: "inscrito" };
    case "mudar-email":
      // Outro email = outra conta Google: tem de voltar a ir à lista da Play.
      await pool.execute(
        `UPDATE programaDaApp
            SET email = ?, estado = 'inscrito', consentimentoEm = UTC_TIMESTAMP(), origem = ?,
                adicionadoEm = NULL, adicionadoPor = NULL, convidadoEm = NULL, convidadoPor = NULL, saiuEm = NULL
          WHERE id = ?`,
        [p.email, p.origem, accao.id],
      );
      return { ok: true, estado: "inscrito" };
    case "nova":
      try {
        await pool.execute(
          "INSERT INTO programaDaApp (email, userId, origem, estado, consentimentoEm) VALUES (?, ?, ?, 'inscrito', UTC_TIMESTAMP())",
          [p.email, p.userId, p.origem],
        );
      } catch (err) {
        // Dois cliques ao mesmo tempo: o segundo encontra a linha do primeiro.
        if ((err as { code?: string })?.code !== "ER_DUP_ENTRY") throw err;
      }
      return { ok: true, estado: "inscrito" };
  }
}

/** Sair do programa, pela conta. */
export async function sairDoPrograma(userId: number | null, emailDaConta: string): Promise<boolean> {
  const pool = await ensureProgramaDaApp();
  const [r] = (await pool.execute(
    `UPDATE programaDaApp SET estado = 'saiu', saiuEm = UTC_TIMESTAMP()
      WHERE (userId = ? OR (email = ? AND userId IS NULL)) AND estado <> 'saiu'`,
    [userId ?? 0, emailDaConta.trim().toLowerCase()],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0) > 0;
}

/* ─── O backoffice ──────────────────────────────────────────────────────── */

export type InscricaoNoBackoffice = {
  id: number;
  email: string;
  estado: EstadoNoPrograma;
  origem: string;
  temConta: boolean;
  consentimentoEm: string | null;
  adicionadoEm: string | null;
  adicionadoPor: string | null;
  convidadoEm: string | null;
  convidadoPor: string | null;
  saiuEm: string | null;
};

export async function listaDoPrograma(): Promise<InscricaoNoBackoffice[]> {
  const pool = await ensureProgramaDaApp();
  const [linhas] = (await pool.execute(
    `SELECT p.id, p.email, p.userId, p.origem, p.estado, p.consentimentoEm, p.adicionadoEm, p.adicionadoPor,
            p.convidadoEm, p.convidadoPor, p.saiuEm,
            (u.id IS NOT NULL AND u.deletedAt IS NULL) AS temConta
       FROM programaDaApp p LEFT JOIN users u ON u.id = p.userId
      ORDER BY p.consentimentoEm DESC, p.id DESC
      LIMIT 2000`,
  )) as [Array<LinhaDaBase & { temConta: number }>, unknown];
  return linhas.map((l) => ({
    id: Number(l.id),
    email: String(l.email),
    estado: paraLinha(l).estado,
    origem: String(l.origem),
    temConta: Number(l.temConta) === 1,
    consentimentoEm: iso(l.consentimentoEm),
    adicionadoEm: iso(l.adicionadoEm),
    adicionadoPor: l.adicionadoPor ?? null,
    convidadoEm: iso(l.convidadoEm),
    convidadoPor: l.convidadoPor ?? null,
    saiuEm: iso(l.saiuEm),
  }));
}

/** Quantos esperam por ser postos na Play — o selo das Contas. */
export async function contarInscritosPorAdicionar(): Promise<number> {
  const pool = await ensureProgramaDaApp();
  const [l] = (await pool.execute("SELECT COUNT(*) AS n FROM programaDaApp WHERE estado = 'inscrito'")) as [
    Array<{ n: number }>,
    unknown,
  ];
  return Number(l[0]?.n ?? 0);
}

function idsLimpos(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 2000);
}

/** `inscrito` → `adicionado`. Só os inscritos mudam (a condição está no WHERE). */
export async function marcarAdicionados(ids: unknown, porQuem: string): Promise<number> {
  const lista = idsLimpos(ids);
  if (lista.length === 0) return 0;
  const pool = await ensureProgramaDaApp();
  const [r] = (await pool.query(
    `UPDATE programaDaApp SET estado = 'adicionado', adicionadoEm = UTC_TIMESTAMP(), adicionadoPor = ?
      WHERE id IN (?) AND estado = 'inscrito'`,
    [porQuem.slice(0, 120), lista],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0);
}

/** Os `adicionado` destes ids (ou todos, sem ids), para o envio do convite. */
export async function adicionadosParaConvidar(ids: unknown, limite: number): Promise<Array<{ id: number; email: string }>> {
  const pool = await ensureProgramaDaApp();
  const lista = idsLimpos(ids);
  const n = Math.max(1, Math.floor(limite));
  const [linhas] = (lista.length > 0
    ? await pool.query(
        `SELECT id, email FROM programaDaApp WHERE estado = 'adicionado' AND id IN (?) ORDER BY id LIMIT ${n}`,
        [lista],
      )
    : await pool.query(`SELECT id, email FROM programaDaApp WHERE estado = 'adicionado' ORDER BY id LIMIT ${n}`)) as [
    Array<{ id: number; email: string }>,
    unknown,
  ];
  return linhas.map((l) => ({ id: Number(l.id), email: String(l.email) }));
}

/** Quantos `adicionado` ficam por convidar (destes ids, ou todos). */
export async function adicionadosPorConvidar(ids: unknown): Promise<number> {
  const pool = await ensureProgramaDaApp();
  const lista = idsLimpos(ids);
  const [l] = (lista.length > 0
    ? await pool.query("SELECT COUNT(*) AS n FROM programaDaApp WHERE estado = 'adicionado' AND id IN (?)", [lista])
    : await pool.query("SELECT COUNT(*) AS n FROM programaDaApp WHERE estado = 'adicionado'")) as [
    Array<{ n: number }>,
    unknown,
  ];
  return Number(l[0]?.n ?? 0);
}

/**
 * Reserva o convite ANTES de enviar: `adicionado` → `convidado` numa só
 * instrução. Dois cliques ao mesmo tempo — só um muda a linha, e só esse envia.
 */
export async function reservarConviteDoPrograma(id: number, porQuem: string): Promise<boolean> {
  const pool = await ensureProgramaDaApp();
  const [r] = (await pool.execute(
    `UPDATE programaDaApp SET estado = 'convidado', convidadoEm = UTC_TIMESTAMP(), convidadoPor = ?
      WHERE id = ? AND estado = 'adicionado'`,
    [porQuem.slice(0, 120), id],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0) === 1;
}

/** O envio falhou: volta a `adicionado`, para se tentar outra vez. */
export async function desfazerConviteDoPrograma(id: number): Promise<void> {
  const pool = await ensureProgramaDaApp();
  await pool.execute(
    "UPDATE programaDaApp SET estado = 'adicionado', convidadoEm = NULL, convidadoPor = NULL WHERE id = ? AND estado = 'convidado'",
    [id],
  );
}

/* ─── Apagar a conta e a purga ──────────────────────────────────────────── */

type Executor = Pick<import("mysql2/promise").PoolConnection, "execute">;

/**
 * Dentro da transacção de `apagarContaDeCliente`: as inscrições desta conta
 * (pelo id) e a do email da conta. A tabela nasce na primeira inscrição; sem
 * ela, não há nada para apagar.
 */
export async function apagarInscricaoNaTransaccao(conn: Executor, email: string, contaIds: number[]): Promise<void> {
  try {
    await conn.execute(
      `DELETE FROM programaDaApp WHERE email = ? OR userId IN (${contaIds.map(() => "?").join(", ") || "NULL"})`,
      [email.trim().toLowerCase(), ...contaIds],
    );
  } catch (err) {
    if ((err as { code?: string })?.code !== "ER_NO_SUCH_TABLE") throw err;
  }
}

/** O DELETE das contas no backoffice: as inscrições ligadas a esta conta. */
export async function apagarInscricoesDaConta(userId: number): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  try {
    await pool.execute("DELETE FROM programaDaApp WHERE userId = ?", [userId]);
  } catch (err) {
    if ((err as { code?: string })?.code !== "ER_NO_SUCH_TABLE") throw err;
  }
}

/**
 * A PURGA: quem saiu há mais de `dias`, e as inscrições cuja conta já não
 * existe (apagada por um caminho que não passou por aqui). A seco só conta.
 */
export async function purgarProgramaDaApp(dias: number, opcoes: { aSerio?: boolean } = {}): Promise<number> {
  const aSerio = opcoes.aSerio !== false;
  const n = Math.max(1, Math.floor(dias));
  const pool = await ensureProgramaDaApp();
  const onde = `FROM programaDaApp p LEFT JOIN users u ON u.id = p.userId
     WHERE (p.estado = 'saiu' AND p.saiuEm < UTC_TIMESTAMP() - INTERVAL ${n} DAY)
        OR (p.userId IS NOT NULL AND (u.id IS NULL OR u.deletedAt IS NOT NULL))`;
  if (!aSerio) {
    const [l] = (await pool.execute(`SELECT COUNT(*) AS n ${onde}`)) as [Array<{ n: number }>, unknown];
    return Number(l[0]?.n ?? 0);
  }
  const [r] = (await pool.execute(`DELETE p ${onde}`)) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0);
}
