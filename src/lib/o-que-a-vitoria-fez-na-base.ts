/**
 * O QUE A VITÓRIA FEZ, lido da base — d102 (CEO e dono, 24-11-2026).
 *
 * Só leitura: um SELECT a `passagensDasRotinas`, às fatias de 1000 pelo `id`
 * (as 24 h são umas 1 500 passagens; os 7 dias, umas 10 000), e a soma em
 * `o-que-a-vitoria-fez.ts`. `comecouEm` está em UTC (escrito com
 * `toISOString`), por isso o «desde» vai em UTC e os dias contam-se em
 * Lisboa do lado de cá. Sem tabela (ainda nenhuma rotina carimbou) dá zero.
 */

import { getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import { lerDesde, oQueAVitoriaFez, type PassagemCrua } from "./o-que-a-vitoria-fez";

/** Quantas linhas por consulta, e o tecto — uma tabela anómala não deita a função abaixo. */
const FATIA = 1000;
const TECTO = 30000;

export async function lerOQueAVitoriaFez(agora: Date, dias: number) {
  const desde = lerDesde(agora, dias);
  const passagens: PassagemCrua[] = [];
  let incompleto = false;
  const pool = await getPool();
  if (pool) {
    const desdeTexto = desde.toISOString().slice(0, 19).replace("T", " ");
    let depoisDe = 0;
    try {
      for (;;) {
        const [rows] = (await pool.execute(
          `SELECT id, rotina, comecouEm, ok, detalhe FROM passagensDasRotinas
            WHERE comecouEm >= ? AND id > ? ORDER BY id LIMIT ${FATIA}`,
          [desdeTexto, depoisDe],
        )) as [Array<Record<string, unknown>>, unknown];
        for (const r of rows) {
          const comecouEm = instanteDaBase(r.comecouEm as string | Date | null);
          if (!comecouEm) continue;
          passagens.push({
            rotina: String(r.rotina),
            comecouEm,
            ok: Number(r.ok) === 1,
            detalhe: r.detalhe == null ? null : String(r.detalhe),
          });
        }
        if (rows.length < FATIA) break;
        depoisDe = Number(rows[rows.length - 1].id);
        if (passagens.length >= TECTO) {
          incompleto = true;
          break;
        }
      }
    } catch (e) {
      // Sem a tabela ainda: nenhuma rotina carimbou — zero passagens, não um erro.
      if ((e as { code?: string })?.code !== "ER_NO_SUCH_TABLE") throw e;
    }
  }
  return { ...oQueAVitoriaFez(passagens, agora, dias), dias, incompleto };
}
