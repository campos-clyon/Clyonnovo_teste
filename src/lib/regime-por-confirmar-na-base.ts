import { getPool, ensureProvidersSchema } from "./db";

/**
 * OS REGIMES DE IVA «CONFIRMADOS» SEM ESCOLHA VOLTAM A «POR CONFIRMAR» — d19,
 * 13-11-2026 (CEO e dono).
 *
 * De 12-11 a 13-11 o perfil carimbava `regimeIvaConfirmadoEm` sempre que
 * `regimeIva` vinha na gravação — e o painel e a app mandavam-no sempre, com
 * «isento» posto por omissão (a coluna nasce assim). Quem gravou só o NIF ou a
 * morada ficou «isento confirmado» sem ter respondido, e o cliente leria
 * «Fatura com isenção de IVA» e pagaria a conta do isento.
 *
 * O CRITÉRIO — não há registo de cada gravação, por isso escolhe-se o lado
 * seguro:
 *   · só «isento» (o valor por omissão). «normal» não nasce sozinho: é sempre
 *     uma resposta dele, e fica;
 *   · fica o carimbo da INSCRIÇÃO, que só existe quando ele escolheu o regime
 *     no formulário (começa sem nenhum marcado). Reconhece-se por ter sido
 *     gravado no mesmo instante da linha (`createdAt`, na hora da sessão, contra
 *     `UTC_TIMESTAMP()`; a diferença das duas é a da sessão, e desconta-se);
 *   · o resto dos «isento» carimbados volta a por confirmar. Quem o tinha
 *     escolhido de facto só tem de o escolher outra vez — e nada se perde: o
 *     regime não muda, só a data da confirmação vai a NULL, com cópia antes.
 *
 *   · UMA VEZ SÓ — a marca em `migracoesFeitas` entra na mesma transacção; o
 *     segundo servidor a arrancar dá «duplicado» e sai;
 *   · NUNCA APAGA LINHAS — actualiza uma coluna, e `updatedAt` fica como estava;
 *   · COM CÓPIA — as linhas tocadas ficam antes em `copiaDoRegimeAntesDaD19`.
 */

export const NOME_DA_REPOSICAO_DO_REGIME = "d19-regime-por-confirmar";

/** Um carimbo de «isento» que não veio da inscrição. */
export const ONDE_O_REGIME_FOI_CONFIRMADO_SEM_ESCOLHA = `regimeIvaConfirmadoEm IS NOT NULL
   AND regimeIva = 'isento'
   AND ABS(TIMESTAMPDIFF(SECOND, createdAt, regimeIvaConfirmadoEm) + TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW())) > 5`;

export type ResultadoDaReposicaoDoRegime =
  | { estado: "ja_estava" }
  | { estado: "sem_base" }
  | { estado: "feita"; contados: number; repostos: number };

export async function reporRegimesSemEscolha(): Promise<ResultadoDaReposicaoDoRegime> {
  const pool = await getPool();
  if (!pool) return { estado: "sem_base" };
  await ensureProvidersSchema();

  // DDL fora da transacção: no MySQL, um CREATE fecha a transacção aberta.
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS migracoesFeitas (
      nome     VARCHAR(80) NOT NULL PRIMARY KEY,
      feitaEm  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      detalhe  TEXT        NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [ja] = (await pool.execute("SELECT 1 FROM migracoesFeitas WHERE nome = ? LIMIT 1", [
    NOME_DA_REPOSICAO_DO_REGIME,
  ])) as [unknown[], unknown];
  if (ja.length > 0) return { estado: "ja_estava" };

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS copiaDoRegimeAntesDaD19 (
      providerId            INT UNSIGNED NOT NULL PRIMARY KEY,
      regimeIva             VARCHAR(10)  NULL,
      regimeIvaConfirmadoEm DATETIME     NULL,
      copiadaEm             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    try {
      await conn.execute("INSERT INTO migracoesFeitas (nome) VALUES (?)", [NOME_DA_REPOSICAO_DO_REGIME]);
    } catch (e) {
      if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
        await conn.rollback();
        return { estado: "ja_estava" };
      }
      throw e;
    }

    // Contar ANTES de mudar — o número que se diz ao CEO.
    const [contagem] = (await conn.execute(
      `SELECT COUNT(*) AS n FROM providers WHERE ${ONDE_O_REGIME_FOI_CONFIRMADO_SEM_ESCOLHA}`,
    )) as [Array<{ n: number | string }>, unknown];
    const contados = Number(contagem[0]?.n ?? 0);

    await conn.execute(
      `INSERT IGNORE INTO copiaDoRegimeAntesDaD19 (providerId, regimeIva, regimeIvaConfirmadoEm)
       SELECT id, regimeIva, regimeIvaConfirmadoEm FROM providers WHERE ${ONDE_O_REGIME_FOI_CONFIRMADO_SEM_ESCOLHA}`,
    );
    const [r] = (await conn.execute(
      `UPDATE providers SET regimeIvaConfirmadoEm = NULL, updatedAt = updatedAt
        WHERE ${ONDE_O_REGIME_FOI_CONFIRMADO_SEM_ESCOLHA}`,
    )) as [{ affectedRows?: number }, unknown];
    const repostos = Number(r?.affectedRows ?? 0);

    await conn.execute("UPDATE migracoesFeitas SET detalhe = ? WHERE nome = ?", [
      JSON.stringify({ contados, repostos }),
      NOME_DA_REPOSICAO_DO_REGIME,
    ]);
    await conn.commit();
    return { estado: "feita", contados, repostos };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/** O que a reposição fez — para os Profissionais o dizerem. Nulo se ainda não correu. */
export async function resumoDaReposicaoDoRegime(): Promise<{
  feitaEm: string | null;
  contados: number;
  repostos: number;
} | null> {
  const pool = await getPool();
  if (!pool) return null;
  try {
    const [linhas] = (await pool.execute(
      "SELECT feitaEm, detalhe FROM migracoesFeitas WHERE nome = ? LIMIT 1",
      [NOME_DA_REPOSICAO_DO_REGIME],
    )) as [Array<{ feitaEm: Date | null; detalhe: string | null }>, unknown];
    const l = linhas[0];
    if (!l) return null;
    const d = JSON.parse(l.detalhe ?? "{}") as { contados?: number; repostos?: number };
    return {
      feitaEm: l.feitaEm ? new Date(l.feitaEm).toISOString() : null,
      contados: Number(d.contados ?? 0),
      repostos: Number(d.repostos ?? 0),
    };
  } catch {
    return null;
  }
}
