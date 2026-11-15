import { getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import {
  cruzarComOPedido,
  janelaDoPedido,
  type CruzamentoComOPedido,
  type Indisponibilidade,
  type IndisponibilidadeLida,
} from "./indisponibilidade";

/**
 * A TABELA DAS INDISPONIBILIDADES DO PROFISSIONAL — d35, 15-11-2026. As regras
 * vivem em `indisponibilidade.ts`; aqui só se lê e escreve.
 *
 * Aditiva: nasce à primeira chamada, com `CREATE TABLE IF NOT EXISTS`, e nada
 * mais muda na base. Os instantes gravam-se em UTC (o pool lê e escreve em UTC
 * — memória «a base é lida em UTC»): `fimEm` é exclusivo.
 */

let tabelaPronta = false;

export async function garantirTabelaDasIndisponibilidades(): Promise<boolean> {
  if (tabelaPronta) return true;
  const pool = await getPool();
  if (!pool) return false;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS indisponibilidades (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      providerId  INT UNSIGNED NOT NULL,
      inicioEm    DATETIME NOT NULL,
      fimEm       DATETIME NOT NULL,
      diaInteiro  TINYINT(1) NOT NULL DEFAULT 1,
      nota        VARCHAR(200) NULL DEFAULT NULL,
      origem      VARCHAR(12) NULL DEFAULT NULL,
      criadaEm    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_indisponibilidades_profissional (providerId, fimEm),
      KEY idx_indisponibilidades_periodo (inicioEm, fimEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tabelaPronta = true;
  return true;
}

function daLinha(l: Record<string, unknown>): Indisponibilidade | null {
  const inicioEm = instanteDaBase(l.inicioEm as Date | string | null);
  const fimEm = instanteDaBase(l.fimEm as Date | string | null);
  if (!inicioEm || !fimEm) return null;
  return {
    id: Number(l.id),
    providerId: Number(l.providerId),
    inicioEm,
    fimEm,
    diaInteiro: Number(l.diaInteiro) === 1,
    nota: typeof l.nota === "string" && l.nota ? l.nota : null,
  };
}

const semErroDeTabela = (e: unknown) => (e as { code?: string })?.code === "ER_NO_SUCH_TABLE";

/** As indisponibilidades de um profissional que ainda não acabaram (ou acabaram depois de `desde`). */
export async function indisponibilidadesDoProfissional(
  providerId: number,
  desde: Date = new Date(),
): Promise<Indisponibilidade[]> {
  const pool = await getPool();
  if (!pool) return [];
  try {
    const [linhas] = (await pool.execute(
      `SELECT id, providerId, inicioEm, fimEm, diaInteiro, nota
         FROM indisponibilidades
        WHERE providerId = ? AND fimEm > ?
        ORDER BY inicioEm ASC
        LIMIT 500`,
      [providerId, desde],
    )) as [Array<Record<string, unknown>>, unknown];
    return linhas.map(daLinha).filter((x): x is Indisponibilidade => x != null);
  } catch (e) {
    if (semErroDeTabela(e)) return [];
    throw e;
  }
}

/** As de vários profissionais que cruzam [inicio, fim) — para a distribuição e o backoffice. */
export async function indisponibilidadesNoPeriodo(
  providerIds: number[],
  inicio: Date,
  fim: Date,
): Promise<Map<number, Indisponibilidade[]>> {
  const mapa = new Map<number, Indisponibilidade[]>();
  const ids = [...new Set(providerIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return mapa;
  const pool = await getPool();
  if (!pool) return mapa;
  try {
    const [linhas] = (await pool.query(
      `SELECT id, providerId, inicioEm, fimEm, diaInteiro, nota
         FROM indisponibilidades
        WHERE providerId IN (?) AND inicioEm < ? AND fimEm > ?`,
      [ids, fim, inicio],
    )) as [Array<Record<string, unknown>>, unknown];
    for (const l of linhas) {
      const i = daLinha(l);
      if (!i) continue;
      if (!mapa.has(i.providerId)) mapa.set(i.providerId, []);
      mapa.get(i.providerId)!.push(i);
    }
  } catch (e) {
    if (!semErroDeTabela(e)) throw e;
  }
  return mapa;
}

/** Marca. Devolve o id da linha nova. */
export async function marcarIndisponibilidade(
  providerId: number,
  v: IndisponibilidadeLida,
  origem: "painel" | "app",
): Promise<number> {
  if (!(await garantirTabelaDasIndisponibilidades())) throw new Error("DB not available");
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    `INSERT INTO indisponibilidades (providerId, inicioEm, fimEm, diaInteiro, nota, origem)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [providerId, v.inicioEm, v.fimEm, v.diaInteiro ? 1 : 0, v.nota, origem],
  )) as [{ insertId?: number }, unknown];
  return Number(r.insertId ?? 0);
}

/**
 * Desmarca UMA marcação, só se for dele: o `providerId` vem da sessão e entra
 * no WHERE. `false` se não havia (ou não era dele).
 */
export async function desmarcarIndisponibilidade(providerId: number, id: number): Promise<boolean> {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  try {
    const [r] = (await pool.execute("DELETE FROM indisponibilidades WHERE id = ? AND providerId = ?", [
      id,
      providerId,
    ])) as [{ affectedRows?: number }, unknown];
    return Number(r?.affectedRows ?? 0) > 0;
  } catch (e) {
    if (semErroDeTabela(e)) return false;
    throw e;
  }
}

/**
 * Os trabalhos contratados e ainda por fazer deste profissional que caem em
 * [inicio, fim) — para perguntar antes de marcar em cima deles. Um trabalho
 * com hora conta 2 h (ou a duração marcada); um só com o dia, o dia inteiro.
 */
export async function trabalhosMarcadosNoPeriodo(
  providerId: number,
  inicio: Date,
  fim: Date,
): Promise<Array<{ negociacaoId: number; pedidoId: number; quando: Date; duracaoMinutos: number | null }>> {
  const pool = await getPool();
  if (!pool) return [];
  // Um dia de folga de cada lado: o cruzamento fino faz-se em `trabalhosEmCima`.
  const [linhas] = (await pool.execute(
    `SELECT n.id AS negociacaoId, n.pedidoId, COALESCE(n.dataCombinada, o.dataAgendada) AS quando, n.duracaoMinutos
       FROM negociacoes n JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.providerId = ? AND n.estado = 'acordada'
        AND n.execucaoEnviadaEm IS NULL AND n.confirmadoEm IS NULL
        AND (o.status IS NULL OR o.status NOT IN ('cancelado', 'arquivado', 'concluido'))
        AND COALESCE(n.dataCombinada, o.dataAgendada) >= DATE_SUB(?, INTERVAL 1 DAY)
        AND COALESCE(n.dataCombinada, o.dataAgendada) < DATE_ADD(?, INTERVAL 1 DAY)`,
    [providerId, inicio, fim],
  )) as [Array<Record<string, unknown>>, unknown];
  const r: Array<{ negociacaoId: number; pedidoId: number; quando: Date; duracaoMinutos: number | null }> = [];
  for (const l of linhas) {
    const quando = instanteDaBase(l.quando as Date | string | null);
    if (!quando) continue;
    r.push({
      negociacaoId: Number(l.negociacaoId),
      pedidoId: Number(l.pedidoId),
      quando,
      duracaoMinutos: l.duracaoMinutos != null ? Number(l.duracaoMinutos) : null,
    });
  }
  return r;
}

/**
 * AS INDISPONIBILIDADES DOS CANDIDATOS PARA UM PEDIDO — d35. Lê a data do
 * pedido na base (a distribuição não a traz) e cruza. Nunca lança: sem base,
 * sem tabela ou sem pedido, ninguém fica de fora por isto.
 */
export async function cruzamentosDoPedido(
  pedidoId: number,
  providerIds: number[],
  extra: { urgency?: string | null } = {},
  agora: Date = new Date(),
): Promise<Map<number, CruzamentoComOPedido>> {
  const r = new Map<number, CruzamentoComOPedido>();
  try {
    const pool = await getPool();
    if (!pool || providerIds.length === 0) return r;
    const [linhas] = (await pool.execute(
      `SELECT o.dataAgendada, o.urgency, o.createdAt,
              (SELECT n.dataCombinada FROM negociacoes n WHERE n.pedidoId = o.id AND n.estado = 'acordada' ORDER BY n.id DESC LIMIT 1) AS dataCombinada
         FROM simulatorOrders o WHERE o.id = ? LIMIT 1`,
      [pedidoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const l = Array.isArray(linhas) ? linhas[0] : undefined;
    if (!l) return r;
    const janela = janelaDoPedido(
      {
        dataCombinada: instanteDaBase(l.dataCombinada as Date | string | null),
        dataAgendada: instanteDaBase(l.dataAgendada as Date | string | null),
        urgency: (l.urgency as string | null) ?? extra.urgency ?? null,
        criadoEm: instanteDaBase(l.createdAt as Date | string | null),
      },
      agora,
    );
    const mapa = await indisponibilidadesNoPeriodo(providerIds, janela.inicio, janela.fim);
    for (const [id, lista] of mapa) {
      const c = cruzarComOPedido(janela, lista);
      if (c.estado !== "livre") r.set(id, c);
    }
  } catch (e) {
    console.error("[indisponibilidades] cruzamento do pedido:", String(e).slice(0, 160));
  }
  return r;
}
