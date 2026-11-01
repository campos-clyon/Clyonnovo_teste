/**
 * O REGISTO DOS CONVITES DA APP DE CLIENTE — 01-11-2026.
 *
 * Uma tabela NOVA (`convitesAppCliente`): nada do que já existe muda, e por
 * isso não há nada a copiar antes. Uma linha por conta convidada, com quando e
 * por quem. A chave primária é a conta e o email é único: um segundo envio à
 * mesma pessoa é recusado pela própria base, mesmo com dois cliques ou dois
 * separadores ao mesmo tempo.
 *
 * O link de adesão guarda-se em `plataformaConfiguracoes` (as configurações
 * da plataforma em texto, `db.ts`), com quem o mudou.
 */

import { getPool, ensureUsersSchema } from "./db";
import {
  CHAVE_DO_LINK_DE_ADESAO,
  escolherDestinatarios,
  linkDeAdesaoValido,
  type ContaParaConvidar,
  type MotivoDeFora,
} from "./convite-app-cliente";

let tabelasProntas = false;

async function garantirTabelas() {
  if (tabelasProntas) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  // A mesma definição de `db.ts` — CREATE IF NOT EXISTS não mexe na que já existe.
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS plataformaConfiguracoes (
      chave         VARCHAR(60) NOT NULL PRIMARY KEY,
      valor         TEXT NOT NULL,
      actualizadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      porQuem       VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  /*
   * `enviadoEm` NULL = reservado e a sair agora. Se o envio falhar, a linha
   * apaga-se e a conta volta à lista; se correr bem, fica com a data.
   */
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS convitesAppCliente (
      userId     INT UNSIGNED NOT NULL PRIMARY KEY,
      email      VARCHAR(255) NOT NULL,
      reservadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      enviadoEm  DATETIME NULL DEFAULT NULL,
      porQuem    VARCHAR(120) NULL DEFAULT NULL,
      UNIQUE KEY uq_convite_app_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tabelasProntas = true;
}

function emailsDeTesteDoAmbiente(): string[] {
  return (process.env.EUPAGO_EMAILS_DE_TESTE ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export async function linkDeAdesaoGuardado(): Promise<string | null> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) return null;
  const [rows] = (await pool.execute(
    "SELECT valor FROM plataformaConfiguracoes WHERE chave = ? LIMIT 1",
    [CHAVE_DO_LINK_DE_ADESAO],
  )) as [Array<{ valor: string }>, unknown];
  return linkDeAdesaoValido(rows[0]?.valor ?? null);
}

export async function guardarLinkDeAdesao(link: string, porQuem: string): Promise<void> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `INSERT INTO plataformaConfiguracoes (chave, valor, porQuem) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), porQuem = VALUES(porQuem)`,
    [CHAVE_DO_LINK_DE_ADESAO, link, porQuem.slice(0, 120)],
  );
}

export type EstadoDosConvites = {
  destinatarios: Array<{
    id: number;
    nome: string | null;
    email: string;
    enviadoEm: string | null;
    /** Já tem linha no registo (enviado, ou a sair) — nunca se volta a enviar. */
    registado: boolean;
  }>;
  deFora: Record<MotivoDeFora, number>;
  /** Convites registados (enviados) — também de contas que entretanto saíram da lista. */
  enviados: number;
};

/** Quem recebe, quem já recebeu e quem ficou de fora (e porquê). */
export async function estadoDosConvites(): Promise<EstadoDosConvites> {
  await ensureUsersSchema();
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const [contas] = (await pool.execute(
    "SELECT id, name, email, role, deletedAt FROM users ORDER BY createdAt DESC",
  )) as [ContaParaConvidar[], unknown];
  const [pros] = (await pool.execute(
    "SELECT DISTINCT LOWER(TRIM(email)) AS email FROM providers WHERE email IS NOT NULL AND TRIM(email) <> ''",
  )) as [Array<{ email: string }>, unknown];
  const [registos] = (await pool.execute(
    "SELECT userId, email, enviadoEm FROM convitesAppCliente",
  )) as [Array<{ userId: number; email: string; enviadoEm: Date | string | null }>, unknown];

  const { destinatarios, deFora } = escolherDestinatarios(
    contas,
    pros.map((p) => p.email),
    emailsDeTesteDoAmbiente(),
  );

  const porConta = new Map<number, Date | string | null>();
  const porEmail = new Map<string, Date | string | null>();
  for (const r of registos) {
    porConta.set(Number(r.userId), r.enviadoEm);
    porEmail.set(String(r.email).toLowerCase(), r.enviadoEm);
  }
  const iso = (v: Date | string | null | undefined) =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);

  return {
    destinatarios: destinatarios.map((d) => ({
      ...d,
      enviadoEm: iso(porConta.get(d.id) ?? porEmail.get(d.email) ?? null),
      registado: porConta.has(d.id) || porEmail.has(d.email),
    })),
    deFora,
    enviados: registos.filter((r) => r.enviadoEm != null).length,
  };
}

/**
 * Reserva a conta antes de enviar. `true` = é nossa, pode sair; `false` = já
 * foi convidada (ou está a sair noutro separador) e NÃO se envia.
 */
export async function reservarConvite(userId: number, email: string, porQuem: string): Promise<boolean> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    "INSERT IGNORE INTO convitesAppCliente (userId, email, porQuem) VALUES (?, ?, ?)",
    [userId, email.toLowerCase(), porQuem.slice(0, 120)],
  )) as [{ affectedRows: number }, unknown];
  return Number(r.affectedRows) === 1;
}

export async function marcarConviteEnviado(userId: number): Promise<void> {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute("UPDATE convitesAppCliente SET enviadoEm = UTC_TIMESTAMP() WHERE userId = ?", [userId]);
}

/** O envio falhou: a reserva sai e a conta volta a poder ser convidada. */
export async function libertarConvite(userId: number): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await pool.execute("DELETE FROM convitesAppCliente WHERE userId = ? AND enviadoEm IS NULL", [userId]);
}
