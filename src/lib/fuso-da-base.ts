import { getPool } from "./db";
import { instanteEmLisboa } from "./hora-de-lisboa";

/**
 * AS MARCAÇÕES ANTIGAS, DE HORA DE LISBOA PARA UTC — UMA VEZ, NO ARRANQUE.
 *
 * *«Deve estar sempre no horário de Lisboa… tudo deve ser num único
 * horário.»* — 01-10-2026. Cópia de segurança completa feita pelo dono antes
 * desta mudança.
 *
 * A ligação à base passou a ler e escrever em UTC (`FUSO_DA_BASE` em
 * `db.ts`). Quase tudo já estava em UTC — `NOW()`, `CURRENT_TIMESTAMP`,
 * `toMySQLDateTime`. Duas colunas não: o mysql2 gravava-as a partir de um
 * `Date`, no fuso do processo, que é Lisboa. São as marcações de trabalhos,
 * as únicas que alguém lê à hora certa:
 *
 *   · `negociacoes.dataCombinada` — o dia e hora combinados com o pro;
 *   · `simulatorOrders.dataAgendada` — o dia e hora que o cliente pediu.
 *
 * Sem converter, com a leitura nova, cada uma aparecia uma hora DEPOIS no
 * Verão. Converte-se o que está lá, para o ecrã continuar a dizer o mesmo.
 *
 * AS GARANTIAS:
 *
 *   · UMA VEZ SÓ. A marca em `migracoesFeitas` entra PRIMEIRO, dentro da
 *     mesma transacção que as alterações. Dois servidores a arrancar ao
 *     mesmo tempo: o segundo fica à espera da chave do primeiro, e quando
 *     ela chega dá «duplicado» e não faz nada. Converter duas vezes atrasava
 *     cada trabalho duas horas.
 *   · TUDO OU NADA. Uma falha a meio desfaz a transacção inteira, marca
 *     incluída, e a próxima vez que o servidor arrancar tenta de novo.
 *   · COM VOLTA. Cada valor alterado fica em `copiaAntesDoFuso`, o antes e o
 *     depois, linha a linha.
 *   · SEM MEXER NO `updatedAt`. As duas tabelas actualizam-no sozinhas, e a
 *     purga dos 60 dias e as novidades do backoffice contam a partir dele.
 *     `updatedAt = updatedAt` impede-o.
 *
 * O QUE NÃO SE CONVERTE, de propósito: as validades de links e convites
 * (ficam uma hora mais longas, uma vez) e `movimentosDaCarteira.disponivelEm`
 * (os antigos ficam uma hora mais cedo). Nenhum se mostra a ninguém.
 */
export const NOME_DA_CONVERSAO = "marcacoes-de-lisboa-para-utc-2026-10-01";

export const COLUNAS_EM_HORA_DE_LISBOA: ReadonlyArray<{ tabela: string; coluna: string }> = [
  { tabela: "negociacoes", coluna: "dataCombinada" },
  { tabela: "simulatorOrders", coluna: "dataAgendada" },
];

/**
 * `2026-09-28 15:00:00` lido como hora de Lisboa → `2026-09-28 14:00:00` em
 * UTC. `null` para o que não se ler — e essa linha fica como estava.
 */
export function deLisboaParaUtc(texto: string): string | null {
  // Só o formato da base, e só datas a sério: um `0000-00-00 00:00:00` virava
  // um ano negativo, e não se escreve isso por cima de nada.
  const m = /^(\d{4})-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.exec(texto);
  if (!m || Number(m[1]) < 2000) return null;
  const d = instanteEmLisboa(texto);
  return d ? d.toISOString().slice(0, 19).replace("T", " ") : null;
}

const POR_LOTE = 200;

export type ResultadoDaConversao =
  | { estado: "ja_estava" }
  | { estado: "sem_base" }
  | { estado: "feita"; alteradas: Record<string, number> };

export async function converterMarcacoesParaUtc(): Promise<ResultadoDaConversao> {
  const pool = await getPool();
  if (!pool) return { estado: "sem_base" };

  // DDL fora da transacção: no MySQL, um CREATE fecha a transacção aberta.
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS migracoesFeitas (
      nome     VARCHAR(80) NOT NULL PRIMARY KEY,
      feitaEm  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      detalhe  TEXT        NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // O caminho de todos os arranques depois do primeiro: uma leitura e sai.
  const [ja] = (await pool.execute(
    "SELECT 1 FROM migracoesFeitas WHERE nome = ? LIMIT 1",
    [NOME_DA_CONVERSAO],
  )) as [unknown[], unknown];
  if (ja.length > 0) return { estado: "ja_estava" };

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS copiaAntesDoFuso (
      tabela  VARCHAR(40) NOT NULL,
      linha   INT         NOT NULL,
      coluna  VARCHAR(40) NOT NULL,
      antes   VARCHAR(19) NOT NULL,
      depois  VARCHAR(19) NOT NULL,
      PRIMARY KEY (tabela, linha, coluna)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // A MARCA PRIMEIRO — é ela que faz o segundo servidor esperar e desistir.
    try {
      await conn.execute("INSERT INTO migracoesFeitas (nome) VALUES (?)", [NOME_DA_CONVERSAO]);
    } catch (e) {
      if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
        await conn.rollback();
        return { estado: "ja_estava" };
      }
      throw e;
    }

    const alteradas: Record<string, number> = {};
    for (const { tabela, coluna } of COLUNAS_EM_HORA_DE_LISBOA) {
      // Lido como TEXTO, para a conta não depender do fuso da ligação.
      const [linhas] = (await conn.execute(
        `SELECT id, DATE_FORMAT(${coluna}, '%Y-%m-%d %H:%i:%s') AS valor
           FROM ${tabela}
          WHERE ${coluna} IS NOT NULL
          FOR UPDATE`,
      )) as [Array<{ id: number; valor: string }>, unknown];

      const mudar = linhas
        .map((l) => ({ id: Number(l.id), antes: String(l.valor), depois: deLisboaParaUtc(String(l.valor)) }))
        .filter((m): m is { id: number; antes: string; depois: string } => !!m.depois && m.depois !== m.antes);

      for (let i = 0; i < mudar.length; i += POR_LOTE) {
        const lote = mudar.slice(i, i + POR_LOTE);
        await conn.execute(
          `INSERT INTO copiaAntesDoFuso (tabela, linha, coluna, antes, depois) VALUES ${lote
            .map(() => "(?, ?, ?, ?, ?)")
            .join(", ")}`,
          lote.flatMap((m) => [tabela, m.id, coluna, m.antes, m.depois]),
        );
        await conn.execute(
          `UPDATE ${tabela}
              SET ${coluna} = CASE id ${lote.map(() => "WHEN ? THEN ?").join(" ")} END,
                  updatedAt = updatedAt
            WHERE id IN (${lote.map(() => "?").join(", ")})`,
          [...lote.flatMap((m) => [m.id, m.depois]), ...lote.map((m) => m.id)],
        );
      }
      alteradas[`${tabela}.${coluna}`] = mudar.length;
    }

    await conn.execute("UPDATE migracoesFeitas SET detalhe = ? WHERE nome = ?", [
      JSON.stringify(alteradas),
      NOME_DA_CONVERSAO,
    ]);
    await conn.commit();
    return { estado: "feita", alteradas };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
