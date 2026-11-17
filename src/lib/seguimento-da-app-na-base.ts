/**
 * O SEGUIMENTO DA APP DE CLIENTE, NA BASE — 17-11-2026 (d59).
 *
 * Uma tabela NOVA (`seguimentoDaApp`), uma linha por EMAIL convidado: a
 * marca «Já instalou» da equipa e o lembrete (uma vez só). Nada do que já
 * existe muda. As regras puras estão em `seguimento-da-app.ts`.
 *
 * Os convidados vêm de dois sítios:
 *   · o programa (`programaDaApp`, estado `convidado`);
 *   · o convite em massa às contas (`convitesAppCliente`, com `enviadoEm`).
 * Uma pessoa nos dois conta uma vez (fica a do programa).
 *
 * APAGAR A CONTA APAGA O SEGUIMENTO: `apagarInscricaoNaTransaccao`
 * (programa-da-app-na-base.ts) chama `apagarSeguimentoNaTransaccao`.
 *
 * As datas escrevem-se com UTC_TIMESTAMP() — a base é lida em UTC.
 */

import { getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import { eGmail, precisaDoLembrete, type ComoAderiu } from "./seguimento-da-app";

let tabelaPronta = false;

export const SQL_DA_TABELA_DO_SEGUIMENTO = `
    CREATE TABLE IF NOT EXISTS seguimentoDaApp (
      email          VARCHAR(255) NOT NULL PRIMARY KEY,
      instalouEm     DATETIME NULL DEFAULT NULL,
      instalouPor    VARCHAR(120) NULL DEFAULT NULL,
      lembreteEm     DATETIME NULL DEFAULT NULL,
      lembreteCanais VARCHAR(30)  NULL DEFAULT NULL,
      criadoEm       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

async function ensureSeguimento() {
  const pool = await getPool();
  if (!pool) throw new Error("[seguimento-da-app] base de dados indisponível");
  if (!tabelaPronta) {
    await pool.execute(SQL_DA_TABELA_DO_SEGUIMENTO);
    tabelaPronta = true;
  }
  return pool;
}

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

/** Uma leitura que não rebenta se a tabela ainda não existir (nasce no primeiro uso). */
async function lerSeExistir<T>(pool: Pool, sql: string): Promise<T[]> {
  try {
    const [linhas] = (await pool.query(sql)) as [T[], unknown];
    return linhas;
  } catch (err) {
    if ((err as { code?: string })?.code === "ER_NO_SUCH_TABLE") return [];
    throw err;
  }
}

const data = (v: Date | string | null | undefined): Date | null => instanteDaBase(v ?? null);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/* ─── Quem está no programa (para o convite em massa não os repetir) ───── */

/** As contas e os emails no programa (fora quem saiu). */
export async function quemEstaNoPrograma(): Promise<{ contas: Set<number>; emails: Set<string> }> {
  const pool = await ensureSeguimento();
  const linhas = await lerSeExistir<{ userId: number | null; email: string }>(
    pool,
    "SELECT userId, email FROM programaDaApp WHERE estado <> 'saiu'",
  );
  const contas = new Set<number>();
  const emails = new Set<string>();
  for (const l of linhas) {
    if (l.userId != null) contas.add(Number(l.userId));
    emails.add(String(l.email).trim().toLowerCase());
  }
  return { contas, emails };
}

/* ─── Os convidados e se aderiram ───────────────────────────────────────── */

export type ConvidadoNoSeguimento = {
  email: string;
  origem: "programa" | "conta";
  convidadoEm: string | null;
  aderiu: ComoAderiu;
  instalouPor: string | null;
  lembreteEm: string | null;
  lembreteCanais: string | null;
  temTelefone: boolean;
  /** O email da conta é Gmail (ou, no programa, o que a pessoa indicou). */
  gmail: boolean;
  /** Quando saiu o convite NOVO (17-11-2026) — é daqui que o lembrete conta os 3 dias. */
  conviteNovoEm: string | null;
};

type Interno = ConvidadoNoSeguimento & {
  telefone: string | null;
  nome: string | null;
  convidadoEmData: Date | null;
  conviteNovoEmData: Date | null;
  lembreteEmData: Date | null;
};

async function convidadosInternos(): Promise<Interno[]> {
  const pool = await ensureSeguimento();
  const [programa, emMassa, avisos, seguimento, convitesNovos] = await Promise.all([
    lerSeExistir<{
      email: string;
      convidadoEm: Date | string | null;
      emailDaConta: string | null;
      phone: string | null;
      nome: string | null;
    }>(
      pool,
      `SELECT p.email, p.convidadoEm, u.email AS emailDaConta, u.phone, u.name AS nome
         FROM programaDaApp p LEFT JOIN users u ON u.id = p.userId AND u.deletedAt IS NULL
        WHERE p.estado = 'convidado'`,
    ),
    lerSeExistir<{ email: string; enviadoEm: Date | string | null; phone: string | null; nome: string | null }>(
      pool,
      `SELECT c.email, c.enviadoEm, u.phone, u.name AS nome
         FROM convitesAppCliente c LEFT JOIN users u ON u.id = c.userId AND u.deletedAt IS NULL
        WHERE c.enviadoEm IS NOT NULL`,
    ),
    lerSeExistir<{ e: string }>(
      pool,
      "SELECT DISTINCT LOWER(TRIM(userEmail)) AS e FROM pushSubscriptions WHERE app = 'cliente'",
    ),
    lerSeExistir<{
      email: string;
      instalouEm: Date | string | null;
      instalouPor: string | null;
      lembreteEm: Date | string | null;
      lembreteCanais: string | null;
    }>(pool, "SELECT email, instalouEm, instalouPor, lembreteEm, lembreteCanais FROM seguimentoDaApp"),
    lerSeExistir<{ email: string; enviadoEm: Date | string | null }>(
      pool,
      "SELECT email, enviadoEm FROM conviteNovoDaApp WHERE enviadoEm IS NOT NULL",
    ),
  ]);

  const comAvisos = new Set(avisos.map((a) => String(a.e)));
  const marcas = new Map(seguimento.map((s) => [String(s.email).toLowerCase(), s]));
  const novos = new Map(convitesNovos.map((c) => [String(c.email).toLowerCase(), data(c.enviadoEm)]));
  const vistos = new Set<string>();
  const saida: Interno[] = [];

  const juntar = (
    email: string,
    origem: "programa" | "conta",
    convidadoEm: Date | null,
    emailsDaPessoa: Array<string | null>,
    telefone: string | null,
    nome: string | null,
  ) => {
    const e = email.trim().toLowerCase();
    if (vistos.has(e)) return;
    vistos.add(e);
    const m = marcas.get(e);
    const instalou = data(m?.instalouEm ?? null);
    const avisosDaApp = emailsDaPessoa.some((x) => x && comAvisos.has(x.trim().toLowerCase()));
    const lembrete = data(m?.lembreteEm ?? null);
    const tel = telefone && telefone.replace(/\D/g, "").length >= 9 ? telefone : null;
    const novo = novos.get(e) ?? null;
    saida.push({
      nome,
      conviteNovoEm: iso(novo),
      conviteNovoEmData: novo,
      email: e,
      origem,
      convidadoEm: iso(convidadoEm),
      convidadoEmData: convidadoEm,
      aderiu: instalou ? "marcado" : avisosDaApp ? "avisos-da-app" : null,
      instalouPor: instalou ? (m?.instalouPor ?? null) : null,
      lembreteEm: iso(lembrete),
      lembreteEmData: lembrete,
      lembreteCanais: m?.lembreteCanais ?? null,
      temTelefone: tel !== null,
      telefone: tel,
      gmail: origem === "programa" ? true : eGmail(e),
    });
  };

  for (const p of programa) juntar(String(p.email), "programa", data(p.convidadoEm), [p.email, p.emailDaConta], p.phone, p.nome);
  for (const c of emMassa) juntar(String(c.email), "conta", data(c.enviadoEm), [c.email], c.phone, c.nome);

  return saida.sort((a, b) => (b.convidadoEmData?.getTime() ?? 0) - (a.convidadoEmData?.getTime() ?? 0));
}

/** Para o painel: sem o telefone (só se tem). */
export async function convidadosDoSeguimento(): Promise<ConvidadoNoSeguimento[]> {
  return (await convidadosInternos()).map(
    ({ telefone: _t, nome: _n, convidadoEmData: _c, conviteNovoEmData: _cn, lembreteEmData: _l, ...resto }) => resto,
  );
}

/**
 * Para o envio do lembrete: SÓ quem recebeu o convite NOVO (17-11-2026), 3
 * dias depois DELE, sem ter aderido, uma vez só. Quem só tem o convite
 * antigo de 01-11 não recebe lembrete — recebe primeiro o convite novo.
 */
export async function convidadosParaOLembrete(
  agora: Date,
  limite: number,
): Promise<Array<{ email: string; telefone: string | null; nome: string | null }>> {
  return (await convidadosInternos())
    // Uma conta sem Gmail não recebeu o link da Play pelo convite novo: o lembrete de instalar não é para ela.
    .filter((c) => c.gmail && c.conviteNovoEmData !== null)
    .filter((c) => precisaDoLembrete({ convidadoEm: c.conviteNovoEmData, aderiu: c.aderiu, lembreteEm: c.lembreteEmData }, agora))
    .slice(0, Math.max(1, Math.floor(limite)))
    .map((c) => ({ email: c.email, telefone: c.telefone, nome: c.nome }));
}

/* ─── As marcas ─────────────────────────────────────────────────────────── */

/** «Já instalou» (ou desfazer). Só para quem foi convidado. */
export async function marcarInstalou(email: unknown, sim: boolean, porQuem: string): Promise<boolean> {
  if (typeof email !== "string") return false;
  const e = email.trim().toLowerCase();
  if (!e.includes("@") || e.length > 255) return false;
  const convidados = await convidadosInternos();
  if (!convidados.some((c) => c.email === e)) return false;
  const pool = await ensureSeguimento();
  if (sim) {
    await pool.execute(
      `INSERT INTO seguimentoDaApp (email, instalouEm, instalouPor) VALUES (?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE instalouEm = UTC_TIMESTAMP(), instalouPor = VALUES(instalouPor)`,
      [e, porQuem.slice(0, 120)],
    );
  } else {
    await pool.execute("UPDATE seguimentoDaApp SET instalouEm = NULL, instalouPor = NULL WHERE email = ?", [e]);
  }
  return true;
}

/**
 * Reserva o lembrete ANTES de enviar: só passa quem ainda não o tem. Duas
 * passagens ao mesmo tempo — só uma muda a linha, e só essa envia.
 */
export async function reservarLembrete(email: string): Promise<boolean> {
  const pool = await ensureSeguimento();
  const [r] = (await pool.execute(
    `INSERT INTO seguimentoDaApp (email, lembreteEm) VALUES (?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE lembreteEm = IF(lembreteEm IS NULL, UTC_TIMESTAMP(), lembreteEm)`,
    [email],
  )) as [{ affectedRows?: number }, unknown];
  // 1 = linha nova, 2 = linha mudada, 0 = já tinha lembrete.
  return Number(r.affectedRows ?? 0) > 0;
}

/** Os canais por onde o lembrete saiu (email, whatsapp). */
export async function registarCanaisDoLembrete(email: string, canais: string[]): Promise<void> {
  const pool = await ensureSeguimento();
  await pool.execute("UPDATE seguimentoDaApp SET lembreteCanais = ? WHERE email = ?", [canais.join(",").slice(0, 30), email]);
}

/** Nada saiu: o lembrete volta a poder sair na passagem seguinte. */
export async function desfazerLembrete(email: string): Promise<void> {
  const pool = await ensureSeguimento();
  await pool.execute("UPDATE seguimentoDaApp SET lembreteEm = NULL, lembreteCanais = NULL WHERE email = ?", [email]);
}

/* ─── Apagar a conta ────────────────────────────────────────────────────── */

type Executor = Pick<import("mysql2/promise").PoolConnection, "execute">;

/**
 * Dentro da transacção de `apagarContaDeCliente`, ANTES de apagar as
 * inscrições: o seguimento do email da conta e dos emails que ela inscreveu.
 */
export async function apagarSeguimentoNaTransaccao(conn: Executor, email: string, contaIds: number[]): Promise<void> {
  const semTabela = (err: unknown) => (err as { code?: string })?.code === "ER_NO_SUCH_TABLE";
  try {
    if (contaIds.length > 0) {
      await conn.execute(
        `DELETE FROM seguimentoDaApp
          WHERE email IN (SELECT email FROM programaDaApp WHERE userId IN (${contaIds.map(() => "?").join(", ")}))`,
        contaIds,
      );
    }
  } catch (err) {
    if (!semTabela(err)) throw err;
  }
  try {
    await conn.execute("DELETE FROM seguimentoDaApp WHERE email = ?", [email.trim().toLowerCase()]);
  } catch (err) {
    if (!semTabela(err)) throw err;
  }
  // O convite novo (17-11-2026) e os WhatsApp por sair: pelo email e pelas contas.
  const { apagarConviteNovoDosEmails, apagarConviteNovoDaConta } = await import("./convite-novo-da-app-na-base");
  await apagarConviteNovoDosEmails(conn, [email]);
  for (const id of contaIds) await apagarConviteNovoDaConta(conn, id);
}

/**
 * O DELETE das contas no backoffice (chamado por `apagarInscricoesDaConta`,
 * antes de apagar as inscrições): o seguimento dos emails que esta conta
 * inscreveu no programa e do email do convite em massa.
 */
export async function apagarSeguimentoDaConta(userId: number): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  for (const origem of ["programaDaApp", "convitesAppCliente"]) {
    try {
      await pool.execute(
        `DELETE FROM seguimentoDaApp WHERE email IN (SELECT email FROM ${origem} WHERE userId = ?)`,
        [userId],
      );
    } catch (err) {
      if ((err as { code?: string })?.code !== "ER_NO_SUCH_TABLE") throw err;
    }
  }
  // O convite novo (17-11-2026) e os WhatsApp por sair desta conta.
  const { apagarConviteNovoDaConta } = await import("./convite-novo-da-app-na-base");
  await apagarConviteNovoDaConta(pool, userId);
}
