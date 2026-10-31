/**
 * A PRESENÇA E A AGENDA DAS ASSISTENTES NA BASE — 31-10-2026.
 *
 * Duas tabelas novas, aditivas, criadas à primeira chamada (`CREATE TABLE IF
 * NOT EXISTS`, como as Conversas): nada do que existe muda.
 *
 *   · `presencaNoBackoffice` — os blocos de presença: quem, quando começou,
 *     quando acabou (a última interacção) e quando chegou o último sinal. Mais
 *     nada: nem páginas, nem o que se viu, nem o que se escreveu. Guardam-se
 *     `MESES_DA_PRESENCA_NO_BACKOFFICE` (a purga da noite, retencao.ts).
 *   · `ausenciasDosAssistentes` — a agenda pessoal: as ausências que cada
 *     assistente marca. Cada uma só se altera e apaga pela própria
 *     (`colaboradorId` em todas as escritas). O mesmo prazo da presença.
 *
 * As regras estão em `presenca-do-backoffice.ts` e `agenda-das-assistentes.ts`.
 */
import { getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import type { Marcacao, MarcacaoNova } from "./agenda-das-assistentes";
import { oQueFazerComOSinal, type AccaoDoSinal, type BlocoNaBase } from "./presenca-do-backoffice";

let tabelasProntas: Promise<boolean> | null = null;

/** Cria as duas tabelas uma vez por instância; false se a base não responder (a seguinte tenta outra vez). */
export function garantirTabelasDaPresenca(): Promise<boolean> {
  if (!tabelasProntas) {
    tabelasProntas = (async () => {
      const pool = await getPool();
      if (!pool) return false;
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS presencaNoBackoffice (
          id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          colaboradorId INT NOT NULL,
          inicioEm      DATETIME NOT NULL,
          fimEm         DATETIME NOT NULL,
          ultimoSinalEm DATETIME NOT NULL,
          KEY idx_colaborador_inicio (colaboradorId, inicioEm),
          KEY idx_fim (fimEm)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS ausenciasDosAssistentes (
          id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          colaboradorId INT NOT NULL,
          tipo          VARCHAR(10) NOT NULL,
          deDia         CHAR(10) NOT NULL,
          ateDia        CHAR(10) NOT NULL,
          deHora        CHAR(5) NULL,
          ateHora       CHAR(5) NULL,
          nota          VARCHAR(300) NULL,
          criadaEm      DATETIME NOT NULL,
          actualizadaEm DATETIME NOT NULL,
          KEY idx_colaborador_dia (colaboradorId, deDia),
          KEY idx_actualizada (actualizadaEm)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      return true;
    })().catch((e) => {
      tabelasProntas = null;
      console.error("[presenca] tabelas:", String(e).slice(0, 160));
      return false;
    });
  }
  return tabelasProntas;
}

function data(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  return instanteDaBase(v == null ? null : String(v));
}

type Linhas = [Array<Record<string, unknown>>, unknown];

// ─── A presença ──────────────────────────────────────────────────────────────

/**
 * UM SINAL DE PRESENÇA. Quem é sai do token (a rota passa o id); do navegador
 * só vem há quanto tempo foi a última interacção. O bloco é da pessoa, e não do
 * separador: dois separadores estendem o mesmo bloco (`GREATEST`), e se dois
 * sinais abrirem dois blocos no mesmo segundo as contas juntam-nos
 * (`unirBlocos`).
 */
export async function registarSinalDePresenca(
  colaboradorId: number,
  msDesdeInteraccao: number,
  agora: Date = new Date(),
): Promise<AccaoDoSinal["tipo"]> {
  if (!(await garantirTabelasDaPresenca())) return "nada";
  const pool = await getPool();
  if (!pool) return "nada";

  const [linhas] = (await pool.execute(
    `SELECT id, inicioEm, fimEm, ultimoSinalEm FROM presencaNoBackoffice
      WHERE colaboradorId = ? ORDER BY inicioEm DESC, id DESC LIMIT 1`,
    [colaboradorId],
  )) as Linhas;
  const l = linhas[0];
  const inicioEm = l ? data(l.inicioEm) : null;
  const fimEm = l ? data(l.fimEm) : null;
  const ultimoSinalEm = l ? data(l.ultimoSinalEm) : null;
  const ultimo: BlocoNaBase | null = inicioEm && fimEm && ultimoSinalEm ? { inicioEm, fimEm, ultimoSinalEm } : null;

  const accao = oQueFazerComOSinal(ultimo, { recebidoEm: agora, msDesdeInteraccao });
  if (accao.tipo === "estender" && l) {
    await pool.execute(
      `UPDATE presencaNoBackoffice
          SET fimEm = GREATEST(fimEm, ?), ultimoSinalEm = GREATEST(ultimoSinalEm, ?)
        WHERE id = ? AND colaboradorId = ?`,
      [accao.fimEm, accao.ultimoSinalEm, Number(l.id), colaboradorId],
    );
  } else if (accao.tipo === "novo") {
    await pool.execute(
      `INSERT INTO presencaNoBackoffice (colaboradorId, inicioEm, fimEm, ultimoSinalEm) VALUES (?, ?, ?, ?)`,
      [colaboradorId, accao.inicioEm, accao.fimEm, accao.ultimoSinalEm],
    );
  }
  return accao.tipo;
}

/** Os blocos que tocam [de, ate), de todas as assistentes. Só para o administrador. */
export async function blocosDePresencaEntre(
  de: Date,
  ate: Date,
): Promise<Array<BlocoNaBase & { colaboradorId: number }>> {
  if (!(await garantirTabelasDaPresenca())) throw new Error("Base de dados indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const [linhas] = (await pool.execute(
    `SELECT colaboradorId, inicioEm, fimEm, ultimoSinalEm FROM presencaNoBackoffice
      WHERE fimEm >= ? AND inicioEm < ? ORDER BY inicioEm`,
    [de, ate],
  )) as Linhas;
  const saida: Array<BlocoNaBase & { colaboradorId: number }> = [];
  for (const r of linhas) {
    const inicioEm = data(r.inicioEm);
    const fimEm = data(r.fimEm);
    const ultimoSinalEm = data(r.ultimoSinalEm);
    if (inicioEm && fimEm && ultimoSinalEm) {
      saida.push({ colaboradorId: Number(r.colaboradorId), inicioEm, fimEm, ultimoSinalEm });
    }
  }
  return saida;
}

/** As contas de assistente (não o administrador), para a vista dele. */
export async function assistentesParaAPresenca(): Promise<Array<{ id: number; nome: string; activo: boolean }>> {
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const [linhas] = (await pool.execute(
    `SELECT id, nome, active FROM colaboradores
      WHERE funcao = 'assistente' AND isAdmin = 0 ORDER BY active DESC, nome ASC`,
  )) as Linhas;
  return linhas.map((r) => ({ id: Number(r.id), nome: String(r.nome ?? ""), activo: Number(r.active ?? 0) === 1 }));
}

// ─── A agenda ────────────────────────────────────────────────────────────────

function marcacaoDaLinha(r: Record<string, unknown>): Marcacao {
  const iso = (v: unknown) => (data(v) ?? new Date(0)).toISOString();
  return {
    id: Number(r.id),
    colaboradorId: Number(r.colaboradorId),
    tipo: String(r.tipo) as Marcacao["tipo"],
    deDia: String(r.deDia),
    ateDia: String(r.ateDia),
    deHora: r.deHora == null ? null : String(r.deHora),
    ateHora: r.ateHora == null ? null : String(r.ateHora),
    nota: r.nota == null ? null : String(r.nota),
    criadaEm: iso(r.criadaEm),
    actualizadaEm: iso(r.actualizadaEm),
  };
}

const COLUNAS_DA_MARCACAO =
  "id, colaboradorId, tipo, deDia, ateDia, deHora, ateHora, nota, criadaEm, actualizadaEm";

async function poolDaAgenda() {
  if (!(await garantirTabelasDaPresenca())) throw new Error("Base de dados indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  return pool;
}

/** A agenda de UMA assistente — a dela, e só a dela. */
export async function agendaDe(colaboradorId: number): Promise<Marcacao[]> {
  const pool = await poolDaAgenda();
  const [linhas] = (await pool.execute(
    `SELECT ${COLUNAS_DA_MARCACAO} FROM ausenciasDosAssistentes
      WHERE colaboradorId = ? ORDER BY deDia DESC, deHora DESC, id DESC LIMIT 300`,
    [colaboradorId],
  )) as Linhas;
  return linhas.map(marcacaoDaLinha);
}

export async function criarMarcacao(colaboradorId: number, m: MarcacaoNova, agora: Date = new Date()): Promise<number> {
  const pool = await poolDaAgenda();
  const [r] = (await pool.execute(
    `INSERT INTO ausenciasDosAssistentes
       (colaboradorId, tipo, deDia, ateDia, deHora, ateHora, nota, criadaEm, actualizadaEm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [colaboradorId, m.tipo, m.deDia, m.ateDia, m.deHora, m.ateHora, m.nota, agora, agora],
  )) as [{ insertId?: number }, unknown];
  return Number(r?.insertId ?? 0);
}

/** Altera uma marcação DESTA assistente. Devolve false se não for dela (ou não existir). */
export async function alterarMarcacao(
  colaboradorId: number,
  id: number,
  m: MarcacaoNova,
  agora: Date = new Date(),
): Promise<boolean> {
  const pool = await poolDaAgenda();
  const [r] = (await pool.execute(
    `UPDATE ausenciasDosAssistentes
        SET tipo = ?, deDia = ?, ateDia = ?, deHora = ?, ateHora = ?, nota = ?, actualizadaEm = ?
      WHERE id = ? AND colaboradorId = ?`,
    [m.tipo, m.deDia, m.ateDia, m.deHora, m.ateHora, m.nota, agora, id, colaboradorId],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}

/** Apaga uma marcação DESTA assistente. Devolve false se não for dela (ou não existir). */
export async function apagarMarcacao(colaboradorId: number, id: number): Promise<boolean> {
  const pool = await poolDaAgenda();
  const [r] = (await pool.execute(`DELETE FROM ausenciasDosAssistentes WHERE id = ? AND colaboradorId = ?`, [
    id,
    colaboradorId,
  ])) as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}

/** As marcações de todas que tocam os dias [deDia, ateDia] — para o administrador. */
export async function agendasEntre(deDia: string, ateDia: string): Promise<Marcacao[]> {
  const pool = await poolDaAgenda();
  const [linhas] = (await pool.execute(
    `SELECT ${COLUNAS_DA_MARCACAO} FROM ausenciasDosAssistentes
      WHERE ateDia >= ? AND deDia <= ? ORDER BY deDia, deHora, id`,
    [deDia, ateDia],
  )) as Linhas;
  return linhas.map(marcacaoDaLinha);
}

/** As últimas marcadas ou mudadas, de todas — o que o selo da secção «Assistentes» conta. */
export async function ultimasMarcacoes(limite = 10): Promise<Marcacao[]> {
  const pool = await poolDaAgenda();
  const n = Math.max(1, Math.min(50, Math.floor(limite)));
  const [linhas] = (await pool.execute(
    `SELECT ${COLUNAS_DA_MARCACAO} FROM ausenciasDosAssistentes ORDER BY actualizadaEm DESC, id DESC LIMIT ${n}`,
  )) as Linhas;
  return linhas.map(marcacaoDaLinha);
}

// ─── A retenção ──────────────────────────────────────────────────────────────

/**
 * OS BLOCOS DE PRESENÇA E AS MARCAÇÕES DA AGENDA COM MAIS DE `meses` —
 * 31-10-2026. Corre na purga da noite, à parte das regras dos pedidos; a seco
 * (`aSerio: false`) só conta. A idade conta-se na base (o fim do bloco, o último
 * dia da marcação contra o NOW() dela). Aos 5000 de cada vez; o que sobrar sai
 * na noite seguinte.
 */
export async function purgarPresencaAntiga(meses: number, opcoes: { aSerio?: boolean } = {}): Promise<number> {
  const aSerio = opcoes.aSerio !== false;
  const n = Math.max(1, Math.floor(meses));
  if (!(await garantirTabelasDaPresenca())) throw new Error("Base de dados indisponível");
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const blocos = `presencaNoBackoffice WHERE fimEm < NOW() - INTERVAL ${n} MONTH`;
  const agenda = `ausenciasDosAssistentes WHERE ateDia < DATE_FORMAT(NOW() - INTERVAL ${n} MONTH, '%Y-%m-%d')`;
  if (!aSerio) {
    const [a] = (await pool.execute(`SELECT COUNT(*) AS n FROM ${blocos}`)) as Linhas;
    const [b] = (await pool.execute(`SELECT COUNT(*) AS n FROM ${agenda}`)) as Linhas;
    return Number(a[0]?.n ?? 0) + Number(b[0]?.n ?? 0);
  }
  const [a] = (await pool.execute(`DELETE FROM ${blocos} LIMIT 5000`)) as [{ affectedRows?: number }, unknown];
  const [b] = (await pool.execute(`DELETE FROM ${agenda} LIMIT 5000`)) as [{ affectedRows?: number }, unknown];
  return Number(a?.affectedRows ?? 0) + Number(b?.affectedRows ?? 0);
}
