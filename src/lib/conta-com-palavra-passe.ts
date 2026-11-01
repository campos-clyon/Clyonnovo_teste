import { createHash, randomBytes } from "node:crypto";
import { ensureUsersSchema, getPool } from "@/lib/db";
import { CONTA_DO_PEDIDO } from "@/lib/conta-server";
import {
  HORAS_DA_CONFIRMACAO,
  HORAS_DO_REPOR,
  pareceUmTokenDaConta,
  type MotivoDoLink,
  type TipoDoLink,
} from "@/lib/palavra-passe-do-cliente";

/**
 * A PALAVRA-PASSE DO CLIENTE, NA BASE — 01-11-2026.
 *
 * DUAS TABELAS NOVAS, E NENHUMA COLUNA NOVA EM `users`.
 *
 * `users` é lida com `SELECT *` em dois sítios que devolvem a linha inteira ao
 * browser e à app (`/api/users/me`, `loadContaData`). Um hash lá dentro
 * saía-lhes no JSON à primeira distracção. Numa tabela à parte, só quem a
 * pede a vê.
 *
 *   · `clientePalavrasPasse` — uma linha por conta (`userId` = `users.id`),
 *     com o hash (bcrypt, o mesmo dos profissionais) e quando o email ficou
 *     confirmado. Pelo id e não pelo email: apagar a conta baralha o email da
 *     linha de `users`, e uma conta nova com o mesmo email nasce com outro id
 *     — a palavra-passe antiga nunca a abre. Apagar a conta apaga esta linha
 *     (`apagarContaDeCliente`).
 *   · `clienteLinksDaConta` — os links de confirmar, definir e repor: só o
 *     hash do token (SHA-256), o prazo, o uso único. O registo guarda aqui o
 *     nome e o hash da palavra-passe escolhida, À ESPERA — só passam para a
 *     conta quando o link é aberto.
 *
 * Sem chaves estrangeiras, como o resto da base: uma migração que falha a
 * meio não pode deixar a entrada partida.
 */

let tabelasProntas = false;

export async function ensureTabelasDaPalavraPasseDoCliente(): Promise<void> {
  if (tabelasProntas) return;
  const pool = await getPool();
  if (!pool) throw new Error("[conta-com-palavra-passe] base de dados indisponível");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS clientePalavrasPasse (
      userId        INT UNSIGNED NOT NULL PRIMARY KEY,
      passwordHash  VARCHAR(255) NOT NULL,
      confirmadoEm  DATETIME NOT NULL,
      alteradaEm    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      criadoEm      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS clienteLinksDaConta (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tipo                 VARCHAR(16)  NOT NULL,
      email                VARCHAR(255) NOT NULL,
      tokenHash            CHAR(64)     NOT NULL,
      nome                 VARCHAR(160) NULL,
      passwordHashPendente VARCHAR(255) NULL,
      expiraEm             DATETIME NOT NULL,
      usadoEm              DATETIME NULL DEFAULT NULL,
      criadoEm             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY link_da_conta_hash (tokenHash),
      KEY link_da_conta_email (email),
      KEY link_da_conta_expira (expiraEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tabelasProntas = true;
}

async function pool() {
  await ensureUsersSchema();
  await ensureTabelasDaPalavraPasseDoCliente();
  const p = await getPool();
  if (!p) throw new Error("[conta-com-palavra-passe] base de dados indisponível");
  return p;
}

export function hashDoTokenDaConta(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

export type ContaDoCliente = {
  id: number;
  nome: string | null;
  passwordHash: string | null;
};

/** A conta deste email (não apagada), com o hash se tiver palavra-passe. */
export async function contaDoClientePorEmail(email: string): Promise<ContaDoCliente | null> {
  const p = await pool();
  const [linhas] = (await p.execute(
    `SELECT u.id, u.name, pp.passwordHash
       FROM users u LEFT JOIN clientePalavrasPasse pp ON pp.userId = u.id
      WHERE u.email = ? AND u.deletedAt IS NULL LIMIT 1`,
    [normalizar(email)],
  )) as [Array<{ id: number; name: string | null; passwordHash: string | null }>, unknown];
  const l = linhas[0];
  return l ? { id: Number(l.id), nome: l.name ?? null, passwordHash: l.passwordHash ?? null } : null;
}

const HORAS: Record<TipoDoLink, number> = {
  registo: HORAS_DA_CONFIRMACAO,
  definir: HORAS_DA_CONFIRMACAO,
  repor: HORAS_DO_REPOR,
};

/**
 * Cria um link e mata os anteriores do mesmo email que ainda valiam — de
 * qualquer tipo: quem pede outro é porque o primeiro não serviu, e duas chaves
 * da mesma conta em circulação são uma a mais. Devolve o token (vai no email e
 * nunca se guarda).
 */
export async function criarLinkDaConta(
  tipo: TipoDoLink,
  email: string,
  extra: { nome?: string | null; passwordHashPendente?: string | null } = {},
): Promise<string> {
  const p = await pool();
  const norm = normalizar(email);
  const token = randomBytes(32).toString("base64url");
  await p.execute(
    "UPDATE clienteLinksDaConta SET usadoEm = NOW() WHERE email = ? AND usadoEm IS NULL",
    [norm],
  );
  await p.execute(
    `INSERT INTO clienteLinksDaConta (tipo, email, tokenHash, nome, passwordHashPendente, expiraEm)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [tipo, norm, hashDoTokenDaConta(token), extra.nome ?? null, extra.passwordHashPendente ?? null, HORAS[tipo]],
  );
  // Limpeza a passar, como nos links de entrada: uma semana depois de
  // expirar, a linha (com o email e um hash pendente) já não serve a ninguém.
  await p.execute("DELETE FROM clienteLinksDaConta WHERE expiraEm < DATE_SUB(NOW(), INTERVAL 7 DAY)");
  return token;
}

export type LinkGasto = {
  tipo: TipoDoLink;
  email: string;
  nome: string | null;
  passwordHashPendente: string | null;
};

/**
 * Gasta um link: UM ÚNICO UPDATE com o uso único lá dentro (como
 * `consumirLigacaoDeEntrada`) — dois toques, ou um pré-carregador do correio,
 * não o gastam duas vezes.
 */
export async function gastarLinkDaConta(
  token: unknown,
  tipos: readonly TipoDoLink[],
): Promise<{ ok: true; link: LinkGasto } | { ok: false; motivo: MotivoDoLink }> {
  if (!pareceUmTokenDaConta(token)) return { ok: false, motivo: "malformado" };
  const p = await pool();
  const hash = hashDoTokenDaConta(token);
  const marcas = tipos.map(() => "?").join(", ");
  const [res] = (await p.execute(
    `UPDATE clienteLinksDaConta SET usadoEm = NOW()
      WHERE tokenHash = ? AND usadoEm IS NULL AND expiraEm > NOW() AND tipo IN (${marcas})`,
    [hash, ...tipos],
  )) as [{ affectedRows?: number }, unknown];
  const [linhas] = (await p.execute(
    "SELECT tipo, email, nome, passwordHashPendente, usadoEm, expiraEm FROM clienteLinksDaConta WHERE tokenHash = ? LIMIT 1",
    [hash],
  )) as [Array<LinkGasto & { usadoEm: Date | null; expiraEm: Date }>, unknown];
  const l = linhas[0];
  if (Number(res.affectedRows ?? 0) === 1 && l) {
    return {
      ok: true,
      link: { tipo: l.tipo, email: l.email, nome: l.nome ?? null, passwordHashPendente: l.passwordHashPendente ?? null },
    };
  }
  if (!l || !tipos.includes(l.tipo)) return { ok: false, motivo: "desconhecido" };
  if (l.usadoEm) return { ok: false, motivo: "usado" };
  return { ok: false, motivo: "expirado" };
}

/**
 * Lê um link sem o gastar — para a página de repor dizer logo se o link
 * ainda serve, antes de a pessoa escrever a palavra-passe nova.
 */
export async function linkDaContaAindaServe(
  token: unknown,
  tipos: readonly TipoDoLink[],
): Promise<{ ok: true; tipo: TipoDoLink } | { ok: false; motivo: MotivoDoLink }> {
  if (!pareceUmTokenDaConta(token)) return { ok: false, motivo: "malformado" };
  const p = await pool();
  const [linhas] = (await p.execute(
    `SELECT tipo, usadoEm, (expiraEm > NOW()) AS valido FROM clienteLinksDaConta WHERE tokenHash = ? LIMIT 1`,
    [hashDoTokenDaConta(token)],
  )) as [Array<{ tipo: TipoDoLink; usadoEm: Date | null; valido: number }>, unknown];
  const l = linhas[0];
  if (!l || !tipos.includes(l.tipo)) return { ok: false, motivo: "desconhecido" };
  if (l.usadoEm) return { ok: false, motivo: "usado" };
  if (Number(l.valido) !== 1) return { ok: false, motivo: "expirado" };
  return { ok: true, tipo: l.tipo };
}

/**
 * O registo por confirmar mais recente deste email (de qualquer idade — a
 * limpeza leva-o uma semana depois de expirar). Para a entrada dizer
 * «por confirmar» a quem escreve a palavra-passe certa, e reenviar o link.
 */
export async function registoPorConfirmar(
  email: string,
): Promise<{ nome: string | null; passwordHashPendente: string } | null> {
  const p = await pool();
  const [linhas] = (await p.execute(
    `SELECT nome, passwordHashPendente FROM clienteLinksDaConta
      WHERE email = ? AND tipo = 'registo' AND passwordHashPendente IS NOT NULL
      ORDER BY id DESC LIMIT 1`,
    [normalizar(email)],
  )) as [Array<{ nome: string | null; passwordHashPendente: string }>, unknown];
  return linhas[0] ?? null;
}

/**
 * A conta, criada se ainda não existir (o registo confirmado), e o seu id.
 * Como `registarCliente`: não escreve por cima do nome que já lá está, e uma
 * conta nascida de um pedido (`loginMethod = 'pedido'`) passa ao método de
 * quem agora entrou.
 */
export async function contaConfirmada(email: string, nome: string | null): Promise<number> {
  const p = await pool();
  const norm = normalizar(email);
  await p.execute(
    `INSERT INTO users (email, name, openId, loginMethod, role, lastSignedIn, createdAt, updatedAt)
     VALUES (?, ?, NULL, 'palavra-passe', 'user', NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       name = IF(name IS NULL OR name = '', VALUES(name), name),
       loginMethod = IF(loginMethod = '${CONTA_DO_PEDIDO}', VALUES(loginMethod), loginMethod),
       lastSignedIn = NOW(),
       updatedAt = NOW()`,
    [norm, nome || norm.split("@")[0]],
  );
  const [linhas] = (await p.execute(
    "SELECT id FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1",
    [norm],
  )) as [Array<{ id: number }>, unknown];
  const id = linhas[0]?.id;
  if (!id) throw new Error("[conta-com-palavra-passe] a conta não ficou gravada");
  return Number(id);
}

/** Grava (ou troca) a palavra-passe de uma conta. O email fica confirmado. */
export async function gravarPalavraPasseDoCliente(userId: number, passwordHash: string): Promise<void> {
  const p = await pool();
  await p.execute(
    `INSERT INTO clientePalavrasPasse (userId, passwordHash, confirmadoEm, alteradaEm)
     VALUES (?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE passwordHash = VALUES(passwordHash), alteradaEm = NOW()`,
    [userId, passwordHash],
  );
}

/** Entrou: a última entrada fica gravada, como no Google. */
export async function registarEntradaDoCliente(userId: number): Promise<void> {
  try {
    const p = await pool();
    await p.execute("UPDATE users SET lastSignedIn = NOW() WHERE id = ?", [userId]);
  } catch (e) {
    console.error("[conta-com-palavra-passe] última entrada:", e instanceof Error ? e.message : e);
  }
}
