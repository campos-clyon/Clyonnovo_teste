/**
 * OS SINAIS DA APP DE CLIENTE, NA BASE — 24-11-2026 (d108). As regras puras
 * estão em `sinais-da-app-de-cliente.ts`.
 *
 * Duas tabelas novas, sem pessoas:
 *   · `primeirasAberturasDaAppCliente` — uma linha por primeira abertura: só a
 *     versão, a plataforma e quando chegou. Nem identificador, nem endereço.
 *   · `problemasDaAppCliente` — o «Algo não funciona?»: o texto que a pessoa
 *     escreveu, onde aconteceu, a versão, o modelo, o sistema e, se tinha
 *     sessão, o email da conta (para a equipa responder).
 * As duas guardam `DIAS_QUE_SE_GUARDAM`: o que for mais antigo sai quando
 * entra uma linha nova (sem rotina à parte).
 */

import { getPool } from "./db";
import {
  DIAS_QUE_SE_GUARDAM,
  type PrimeiraAbertura,
  type ProblemaDaApp,
  type ResumoDasAberturas,
} from "./sinais-da-app-de-cliente";

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

let prontas = false;
async function tabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  if (prontas) return pool;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS primeirasAberturasDaAppCliente (
      id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      versao     VARCHAR(20)  NOT NULL DEFAULT '?',
      plataforma VARCHAR(10)  NOT NULL DEFAULT 'outra',
      recebidoEm DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_recebido (recebidoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS problemasDaAppCliente (
      id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
      texto      VARCHAR(1000) NOT NULL,
      onde       VARCHAR(20)   NOT NULL DEFAULT 'outro',
      versao     VARCHAR(20)   NOT NULL DEFAULT '?',
      modelo     VARCHAR(60)   NULL DEFAULT NULL,
      sistema    VARCHAR(30)   NULL DEFAULT NULL,
      email      VARCHAR(255)  NULL DEFAULT NULL,
      recebidoEm DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_recebido (recebidoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  prontas = true;
  return pool;
}

const DIAS = Math.max(1, Math.floor(DIAS_QUE_SE_GUARDAM));

export async function registarPrimeiraAbertura(a: PrimeiraAbertura): Promise<void> {
  const pool = await tabelas();
  await pool.execute("INSERT INTO primeirasAberturasDaAppCliente (versao, plataforma) VALUES (?, ?)", [a.versao, a.plataforma]);
  await pool.execute(`DELETE FROM primeirasAberturasDaAppCliente WHERE recebidoEm < NOW() - INTERVAL ${DIAS} DAY LIMIT 500`);
}

export async function registarProblema(p: ProblemaDaApp, email: string | null): Promise<void> {
  const pool = await tabelas();
  await pool.execute(
    "INSERT INTO problemasDaAppCliente (texto, onde, versao, modelo, sistema, email) VALUES (?, ?, ?, ?, ?, ?)",
    [p.texto, p.onde, p.versao, p.modelo, p.sistema, email],
  );
  await pool.execute(`DELETE FROM problemasDaAppCliente WHERE recebidoEm < NOW() - INTERVAL ${DIAS} DAY LIMIT 500`);
}

export type ProblemaGuardado = {
  id: number;
  texto: string;
  onde: string;
  versao: string;
  modelo: string | null;
  sistema: string | null;
  email: string | null;
  recebidoEm: Date | string;
};

/** O que o separador «Programa da app» mostra: as contas dos últimos `dias` e os problemas recentes. */
export async function sinaisParaOBackoffice(
  dias: number,
): Promise<{ aberturas: ResumoDasAberturas; problemas: ProblemaGuardado[] }> {
  const pool = await tabelas();
  const n = Math.max(1, Math.floor(dias));
  const [primeiras] = (await pool.execute(
    `SELECT COUNT(*) AS n FROM primeirasAberturasDaAppCliente WHERE recebidoEm > NOW() - INTERVAL ${n} DAY`,
  )) as [Array<{ n: number | string }>, unknown];
  let comSessao = 0;
  try {
    const [contas] = (await pool.execute(
      `SELECT COUNT(*) AS n FROM users WHERE deletedAt IS NULL AND appClienteAbertaEm > NOW() - INTERVAL ${n} DAY`,
    )) as [Array<{ n: number | string }>, unknown];
    comSessao = Number(contas[0]?.n ?? 0);
  } catch (e) {
    // Sem a coluna ainda (nenhuma abertura com sessão desde que existe): conta 0.
    console.error("[sinaisParaOBackoffice:users]", e instanceof Error ? e.message : e);
  }
  const [problemas] = (await pool.execute(
    `SELECT id, texto, onde, versao, modelo, sistema, email, recebidoEm
       FROM problemasDaAppCliente
      WHERE recebidoEm > NOW() - INTERVAL ${n} DAY
      ORDER BY id DESC
      LIMIT 50`,
  )) as [ProblemaGuardado[], unknown];
  return {
    aberturas: { dias: n, primeirasAberturas: Number(primeiras[0]?.n ?? 0), aberturasComSessao: comSessao },
    problemas,
  };
}
