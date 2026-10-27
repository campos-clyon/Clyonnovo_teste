/**
 * AS SESSÕES DO BACKOFFICE NA BASE — 27-10-2026 (decisão d15).
 *
 * Três tabelas novas, aditivas, criadas à primeira chamada como as outras do
 * `db.ts` (`CREATE TABLE IF NOT EXISTS`): nada do que existe muda.
 *
 *   · `sessoesDoBackoffice` — uma linha por separador (navegador + separador),
 *     actualizada a cada batimento. Sem IP: só a cidade e o país aproximados.
 *   · `sessoesTerminadas` — o resumo (sha-256) dos tokens que o administrador
 *     terminou, até eles caducarem. É o que `requireAdmin` consulta.
 *   · `entradasNoBackoffice` — o registo de entradas (quem, quando, onde),
 *     guardado 90 dias. Sem dados de clientes.
 *
 * Ver `sessoes-do-backoffice.ts` para as regras.
 */
import { getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import {
  RETENCAO_DAS_ENTRADAS_DIAS,
  arrumarSessoes,
  type PessoaComSessoes,
  type SeparadorNaBase,
} from "./sessoes-do-backoffice";

let tabelasProntas: Promise<boolean> | null = null;

/**
 * Cria as tabelas uma vez por instância. Devolve false se a base não
 * responder — e a chamada seguinte volta a tentar.
 */
export function garantirTabelasDasSessoes(): Promise<boolean> {
  if (!tabelasProntas) {
    tabelasProntas = (async () => {
      const pool = await getPool();
      if (!pool) return false;
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS sessoesDoBackoffice (
          id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          colaboradorId INT NOT NULL,
          nome          VARCHAR(120) NOT NULL,
          papel         VARCHAR(20) NOT NULL,
          navegadorId   VARCHAR(64) NOT NULL,
          separadorId   VARCHAR(64) NOT NULL,
          tokenHash     CHAR(64) NOT NULL,
          sessaoDesde   DATETIME NULL,
          expiraEm      DATETIME NULL,
          navegador     VARCHAR(40) NOT NULL,
          sistema       VARCHAR(40) NOT NULL,
          cidade        VARCHAR(80) NULL,
          pais          VARCHAR(8) NULL,
          inicioEm      DATETIME NOT NULL,
          ultimaEm      DATETIME NOT NULL,
          fechadaEm     DATETIME NULL,
          UNIQUE KEY uq_navegador_separador (navegadorId, separadorId),
          KEY idx_token (tokenHash),
          KEY idx_ultima (ultimaEm)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS sessoesTerminadas (
          tokenHash     CHAR(64) NOT NULL PRIMARY KEY,
          colaboradorId INT NOT NULL,
          terminadaEm   DATETIME NOT NULL,
          terminadaPor  VARCHAR(120) NOT NULL,
          expiraEm      DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS entradasNoBackoffice (
          id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          colaboradorId INT NOT NULL,
          nome          VARCHAR(120) NOT NULL,
          papel         VARCHAR(20) NOT NULL,
          em            DATETIME NOT NULL,
          navegador     VARCHAR(40) NOT NULL,
          sistema       VARCHAR(40) NOT NULL,
          cidade        VARCHAR(80) NULL,
          pais          VARCHAR(8) NULL,
          KEY idx_em (em)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      return true;
    })().catch((e) => {
      tabelasProntas = null;
      console.error("[sessoes-do-backoffice] tabelas:", String(e).slice(0, 160));
      return false;
    });
  }
  return tabelasProntas;
}

function data(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  return instanteDaBase(v == null ? null : String(v));
}

function segundosParaData(s: number | undefined): Date | null {
  return typeof s === "number" && Number.isFinite(s) ? new Date(s * 1000) : null;
}

export type Batimento = {
  colaboradorId: number;
  nome: string;
  papel: string;
  navegadorId: string;
  separadorId: string;
  tokenHash: string;
  iat?: number;
  exp?: number;
  navegador: string;
  sistema: string;
  cidade: string | null;
  pais: string | null;
};

/** Um batimento: a janela está aberta agora. */
export async function registarBatimento(b: Batimento, agora: Date = new Date()): Promise<void> {
  if (!(await garantirTabelasDasSessoes())) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `INSERT INTO sessoesDoBackoffice
       (colaboradorId, nome, papel, navegadorId, separadorId, tokenHash, sessaoDesde, expiraEm,
        navegador, sistema, cidade, pais, inicioEm, ultimaEm, fechadaEm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
       colaboradorId = VALUES(colaboradorId), nome = VALUES(nome), papel = VALUES(papel),
       tokenHash = VALUES(tokenHash), sessaoDesde = VALUES(sessaoDesde), expiraEm = VALUES(expiraEm),
       navegador = VALUES(navegador), sistema = VALUES(sistema),
       cidade = VALUES(cidade), pais = VALUES(pais),
       ultimaEm = VALUES(ultimaEm), fechadaEm = NULL`,
    [
      b.colaboradorId,
      b.nome.slice(0, 120),
      b.papel.slice(0, 20),
      b.navegadorId,
      b.separadorId,
      b.tokenHash,
      segundosParaData(b.iat),
      segundosParaData(b.exp),
      b.navegador.slice(0, 40),
      b.sistema.slice(0, 40),
      b.cidade,
      b.pais,
      agora,
      agora,
    ],
  );
}

/**
 * A janela fechou: deixa de contar já, sem esperar pelos dois minutos.
 *
 * Ao RECARREGAR, o aviso de fecho da página velha pode chegar depois do
 * primeiro batimento da nova (é o mesmo separador). Por isso não se fecha um
 * separador que bateu há menos de 3 segundos — se fechou mesmo, sai da lista
 * pelos dois minutos.
 */
export async function fecharSeparador(
  navegadorId: string,
  separadorId: string,
  tokenHash: string,
  agora: Date = new Date(),
): Promise<void> {
  if (!(await garantirTabelasDasSessoes())) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `UPDATE sessoesDoBackoffice SET fechadaEm = ?
      WHERE navegadorId = ? AND separadorId = ? AND tokenHash = ? AND ultimaEm < ?`,
    [agora, navegadorId, separadorId, tokenHash, new Date(agora.getTime() - 3000)],
  );
}

/** Uma entrada no backoffice (o login). Aproveita para limpar as de há mais de 90 dias. */
export async function registarEntrada(
  e: {
    colaboradorId: number;
    nome: string;
    papel: string;
    navegador: string;
    sistema: string;
    cidade: string | null;
    pais: string | null;
  },
  agora: Date = new Date(),
): Promise<void> {
  if (!(await garantirTabelasDasSessoes())) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `INSERT INTO entradasNoBackoffice (colaboradorId, nome, papel, em, navegador, sistema, cidade, pais)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.colaboradorId, e.nome.slice(0, 120), e.papel.slice(0, 20), agora, e.navegador.slice(0, 40), e.sistema.slice(0, 40), e.cidade, e.pais],
  );
  await pool.execute(`DELETE FROM entradasNoBackoffice WHERE em < ?`, [
    new Date(agora.getTime() - RETENCAO_DAS_ENTRADAS_DIAS * 86400000),
  ]);
}

export type EntradaNoBackoffice = {
  colaboradorId: number;
  nome: string;
  papel: string;
  em: string;
  navegador: string;
  sistema: string;
  cidade: string | null;
  pais: string | null;
};

/**
 * O que o cartão das Configs mostra: as pessoas com sessões de pé e as
 * últimas entradas. Limpa pelo caminho o que já não serve (separadores de
 * sessões caducadas, tokens terminados que já caducaram).
 */
export async function sessoesParaOAdministrador(
  meuNavegadorId: string | null,
  agora: Date = new Date(),
): Promise<{ pessoas: PessoaComSessoes[]; entradas: EntradaNoBackoffice[] }> {
  if (!(await garantirTabelasDasSessoes())) throw new Error("Base de dados indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");

  const umDiaAtras = new Date(agora.getTime() - 86400000);
  const trintaEUmDias = new Date(agora.getTime() - 31 * 86400000);
  await pool.execute(
    `DELETE FROM sessoesDoBackoffice WHERE (expiraEm IS NOT NULL AND expiraEm < ?) OR ultimaEm < ?`,
    [umDiaAtras, trintaEUmDias],
  );
  await pool.execute(`DELETE FROM sessoesTerminadas WHERE expiraEm IS NOT NULL AND expiraEm < ?`, [umDiaAtras]);
  await pool.execute(`DELETE FROM entradasNoBackoffice WHERE em < ?`, [
    new Date(agora.getTime() - RETENCAO_DAS_ENTRADAS_DIAS * 86400000),
  ]);

  const [linhas] = (await pool.execute(
    `SELECT s.* FROM sessoesDoBackoffice s
      WHERE NOT EXISTS (SELECT 1 FROM sessoesTerminadas t WHERE t.tokenHash = s.tokenHash)
        AND (s.expiraEm IS NULL OR s.expiraEm > ?)`,
    [agora],
  )) as [Array<Record<string, unknown>>, unknown];

  const separadores: SeparadorNaBase[] = [];
  for (const r of linhas) {
    const inicioEm = data(r.inicioEm);
    const ultimaEm = data(r.ultimaEm);
    if (!inicioEm || !ultimaEm) continue;
    separadores.push({
      colaboradorId: Number(r.colaboradorId),
      nome: String(r.nome ?? ""),
      papel: String(r.papel ?? ""),
      navegadorId: String(r.navegadorId),
      separadorId: String(r.separadorId),
      tokenHash: String(r.tokenHash),
      sessaoDesde: data(r.sessaoDesde),
      expiraEm: data(r.expiraEm),
      navegador: String(r.navegador ?? ""),
      sistema: String(r.sistema ?? ""),
      cidade: r.cidade == null ? null : String(r.cidade),
      pais: r.pais == null ? null : String(r.pais),
      inicioEm,
      ultimaEm,
      fechadaEm: data(r.fechadaEm),
    });
  }

  const [entradas] = (await pool.execute(
    `SELECT colaboradorId, nome, papel, em, navegador, sistema, cidade, pais
       FROM entradasNoBackoffice ORDER BY em DESC LIMIT 60`,
  )) as [Array<Record<string, unknown>>, unknown];

  return {
    pessoas: arrumarSessoes(separadores, agora, new Set(), meuNavegadorId),
    entradas: entradas.map((r) => ({
      colaboradorId: Number(r.colaboradorId),
      nome: String(r.nome ?? ""),
      papel: String(r.papel ?? ""),
      em: (data(r.em) ?? agora).toISOString(),
      navegador: String(r.navegador ?? ""),
      sistema: String(r.sistema ?? ""),
      cidade: r.cidade == null ? null : String(r.cidade),
      pais: r.pais == null ? null : String(r.pais),
    })),
  };
}

/**
 * «Terminar esta sessão»: todos os tokens vistos neste navegador, desta
 * pessoa, passam a ser recusados. Devolve quantos tokens ficaram terminados.
 */
export async function terminarSessaoDoNavegador(
  colaboradorId: number,
  navegadorId: string,
  terminadaPor: string,
  agora: Date = new Date(),
): Promise<number> {
  if (!(await garantirTabelasDasSessoes())) throw new Error("Base de dados indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const [linhas] = (await pool.execute(
    `SELECT tokenHash, MAX(expiraEm) AS expiraEm FROM sessoesDoBackoffice
      WHERE colaboradorId = ? AND navegadorId = ? GROUP BY tokenHash`,
    [colaboradorId, navegadorId],
  )) as [Array<Record<string, unknown>>, unknown];
  for (const l of linhas) {
    await pool.execute(
      `INSERT IGNORE INTO sessoesTerminadas (tokenHash, colaboradorId, terminadaEm, terminadaPor, expiraEm)
       VALUES (?, ?, ?, ?, ?)`,
      [String(l.tokenHash), colaboradorId, agora, terminadaPor.slice(0, 120), data(l.expiraEm)],
    );
  }
  await pool.execute(
    `UPDATE sessoesDoBackoffice SET fechadaEm = ? WHERE colaboradorId = ? AND navegadorId = ?`,
    [agora, colaboradorId, navegadorId],
  );
  return linhas.length;
}
