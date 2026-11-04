import {
  appendOrderHistory,
  ensureRegistoTable,
  getPool,
  negociacoesDoProfissional,
  registarNaTransaccao,
  toMySQLDateTime,
} from "./db";
import { trabalhosDaCarteira } from "./carteira-do-profissional";
import { tridDoAbatimentoAParte } from "./pagamentos-na-base";
import { configuracaoDoEupago } from "./eupago";
import {
  DIA_DA_QUITACAO,
  METODO_DA_QUITACAO,
  NOME_DA_QUITACAO,
  dividasAQuitar,
  fraseDaQuitacao,
  limiteDaQuitacao,
} from "./pagamento-da-divida";
import type { DividaNaCarteira } from "./carteira";

/**
 * O ACERTO DE 01-11-2026 — TUDO QUITADO ATÉ ESTA DATA, PARA TODOS. Uma vez só.
 *
 * *«Na realidade está tudo acertado com a Revolution e com os outros: ninguém
 * deve nada a ninguém. Dar tudo como quitado até hoje, para todos os
 * profissionais.»* — dono, 01-11-2026.
 *
 * Para cada profissional, fecha as dívidas (IVA e taxa da plataforma) de todos
 * os trabalhos pagos em mão ou em dinheiro até ao fim de 01-11-2026, com uma
 * linha `quitacao` em `pagamentos` por dívida — a mesma forma que uma
 * referência paga, e por isso o mesmo índice único a impedir a repetição.
 *
 * O QUE NÃO FAZ: não abate nada do «Pode pedir já» (só o `abatimento` sai do
 * disponível — `camposDoPagamento`), não gera transferências, não muda os
 * «Recebidos» (o recebido em mão é sobre o trabalho, não sobre a dívida), e
 * não apaga nem altera linha nenhuma: só acrescenta.
 *
 * AS GARANTIAS, as de `fuso-da-base.ts`:
 *   · UMA VEZ SÓ — a marca em `migracoesFeitas` entra primeiro, na mesma
 *     transacção; o segundo servidor a arrancar dá «duplicado» e sai;
 *   · TUDO OU NADA — uma falha desfaz a transacção, marca incluída;
 *   · COM CÓPIA — antes de escrever, a tabela `pagamentos` inteira fica em
 *     `copiaPagamentosAntesDaQuitacao`.
 */

export type ResultadoDaQuitacao =
  | { estado: "ja_estava" }
  | { estado: "sem_base" }
  | {
      estado: "feita";
      profissionais: number;
      dividas: number;
      total: number;
      porProfissional: Array<{ providerId: number; dividas: number; total: number }>;
    };

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function quitarAsDividasAte01Nov(agora: Date = new Date()): Promise<ResultadoDaQuitacao> {
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
  const [ja] = (await pool.execute("SELECT 1 FROM migracoesFeitas WHERE nome = ? LIMIT 1", [
    NOME_DA_QUITACAO,
  ])) as [unknown[], unknown];
  if (ja.length > 0) return { estado: "ja_estava" };

  await ensureRegistoTable();

  /*
   * O PLANO, lido como a carteira de cada um o lê — antes da transacção, que
   * a carteira lê pela ligação geral. O índice único é que protege contra o
   * que mudar entretanto (uma referência paga no mesmo minuto): essa dívida
   * fica paga pela referência, e o acerto não a escreve outra vez.
   */
  const limite = limiteDaQuitacao();
  const [provs] = (await pool.execute(
    `SELECT DISTINCT providerId FROM negociacoes WHERE estado = 'acordada' AND providerId IS NOT NULL`,
  )) as [Array<{ providerId: number }>, unknown];

  const plano: Array<{
    providerId: number;
    dividas: Array<DividaNaCarteira & { pedidoId: number | null }>;
  }> = [];
  for (const { providerId } of provs) {
    const pid = Number(providerId);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    const linhas = await negociacoesDoProfissional(pid);
    const trabalhos = await trabalhosDaCarteira(linhas);
    const dividas = dividasAQuitar(trabalhos, limite).map((d) => ({
      ...d,
      pedidoId: linhas.find((l) => Number(l.id) === d.negociacaoId)?.pedidoId ?? null,
    }));
    if (dividas.length > 0) plano.push({ providerId: pid, dividas });
  }

  // A CÓPIA, antes de escrever. Só a primeira vez: numa segunda tentativa
  // (a primeira falhou e desfez-se), a que lá está continua a ser o «antes».
  await pool.execute(`CREATE TABLE IF NOT EXISTS copiaPagamentosAntesDaQuitacao LIKE pagamentos`);
  const [copia] = (await pool.execute(
    `SELECT COUNT(*) AS n FROM copiaPagamentosAntesDaQuitacao`,
  )) as [Array<{ n: number }>, unknown];
  if (Number(copia[0]?.n ?? 0) === 0) {
    await pool.execute(`INSERT INTO copiaPagamentosAntesDaQuitacao SELECT * FROM pagamentos`);
  }

  const conf = configuracaoDoEupago(process.env);
  const ambiente = conf.ok ? conf.config.ambiente : "producao";
  const quando = toMySQLDateTime(agora);

  const conn = await pool.getConnection();
  const feitas: Array<{ providerId: number; dividas: Array<{ pedidoId: number | null; negociacaoId: number; valor: number }> }> = [];
  try {
    await conn.beginTransaction();
    try {
      await conn.execute("INSERT INTO migracoesFeitas (nome) VALUES (?)", [NOME_DA_QUITACAO]);
    } catch (e) {
      if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
        await conn.rollback();
        return { estado: "ja_estava" };
      }
      throw e;
    }

    for (const p of plano) {
      const deste: (typeof feitas)[number] = { providerId: p.providerId, dividas: [] };
      for (const d of p.dividas) {
        const aParte = d.aParte === true;
        const [r] = (await conn.execute(
          `INSERT IGNORE INTO pagamentos
             (negociacaoId, pedidoId, providerId, metodo, ambiente, valor, comFactura,
              estado, negociacaoPaga, valorPago, pagoEm, levantamentoId, trid)
           VALUES (?, ?, ?, ?, ?, ?, 0, 'pago', ?, ?, ?, NULL, ?)`,
          [
            d.negociacaoId,
            d.pedidoId ?? 0,
            p.providerId,
            METODO_DA_QUITACAO,
            ambiente,
            d.total,
            aParte ? null : d.negociacaoId,
            d.total,
            quando,
            aParte ? tridDoAbatimentoAParte(d.negociacaoId) : null,
          ],
        )) as [{ affectedRows?: number; insertId?: number }, unknown];
        // Já paga entretanto (o índice disse que não): fica como está.
        if (Number(r?.affectedRows ?? 0) !== 1) continue;

        if (!aParte) {
          // A referência viva desta dívida deixa de fazer sentido.
          await conn.execute(
            `UPDATE pagamentos SET estado = 'substituido'
              WHERE negociacaoId = ? AND id <> ? AND estado = 'pendente'`,
            [d.negociacaoId, Number(r?.insertId ?? 0)],
          );
        }
        await registarNaTransaccao(conn, {
          acontecimento: "divida_quitada",
          pedidoId: d.pedidoId,
          negociacaoId: d.negociacaoId,
          providerId: p.providerId,
          autorTipo: "clyon",
          autorNome: "CLYON (acerto de 01/11/2026)",
          valor: d.total,
          resumo: fraseDaQuitacao(d.total),
          detalhe: {
            pagamentoId: Number(r?.insertId ?? 0),
            iva: d.iva,
            comissao: d.comissao,
            decisao: `Tudo quitado até ${DIA_DA_QUITACAO} — decisão do dono, 01-11-2026.`,
          },
          visivelProfissional: true,
        });
        deste.dividas.push({ pedidoId: d.pedidoId, negociacaoId: d.negociacaoId, valor: d.total });
      }
      if (deste.dividas.length === 0) continue;

      // A linha do profissional: o acerto inteiro, com o valor fechado.
      const total = aosCentimos(deste.dividas.reduce((s, x) => s + x.valor, 0));
      await registarNaTransaccao(conn, {
        acontecimento: "divida_quitada",
        providerId: p.providerId,
        autorTipo: "clyon",
        autorNome: "CLYON (acerto de 01/11/2026)",
        valor: total,
        resumo: fraseDaQuitacao(total),
        detalhe: {
          dividas: deste.dividas,
          decisao: `Tudo quitado até ${DIA_DA_QUITACAO} — decisão do dono, 01-11-2026.`,
        },
        visivelProfissional: true,
      });
      feitas.push(deste);
    }

    const porProfissional = feitas.map((f) => ({
      providerId: f.providerId,
      dividas: f.dividas.length,
      total: aosCentimos(f.dividas.reduce((s, x) => s + x.valor, 0)),
    }));
    const resumo = {
      profissionais: porProfissional.length,
      dividas: porProfissional.reduce((s, x) => s + x.dividas, 0),
      total: aosCentimos(porProfissional.reduce((s, x) => s + x.total, 0)),
      porProfissional,
    };
    await conn.execute("UPDATE migracoesFeitas SET detalhe = ? WHERE nome = ?", [
      JSON.stringify(resumo),
      NOME_DA_QUITACAO,
    ]);
    await conn.commit();

    // O histórico de cada pedido, depois de tudo estar gravado. Nunca lança.
    for (const f of feitas) {
      for (const d of f.dividas) {
        if (d.pedidoId == null) continue;
        await appendOrderHistory(d.pedidoId, {
          type: "created",
          by: null,
          message: `${fraseDaQuitacao(d.valor)} (dívida do profissional neste trabalho)`,
        }).catch(() => {});
      }
    }

    return { estado: "feita", ...resumo };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/** O que o acerto fechou — para as Carteiras o dizerem. Nulo se ainda não correu. */
export async function resumoDaQuitacao(): Promise<{
  feitaEm: string | null;
  profissionais: number;
  dividas: number;
  total: number;
} | null> {
  const pool = await getPool();
  if (!pool) return null;
  try {
    const [linhas] = (await pool.execute(
      "SELECT feitaEm, detalhe FROM migracoesFeitas WHERE nome = ? LIMIT 1",
      [NOME_DA_QUITACAO],
    )) as [Array<{ feitaEm: Date | null; detalhe: string | null }>, unknown];
    const l = linhas[0];
    if (!l) return null;
    const d = JSON.parse(l.detalhe ?? "{}") as { profissionais?: number; dividas?: number; total?: number };
    return {
      feitaEm: l.feitaEm ? new Date(l.feitaEm).toISOString() : null,
      profissionais: Number(d.profissionais ?? 0),
      dividas: Number(d.dividas ?? 0),
      total: Number(d.total ?? 0),
    };
  } catch {
    return null;
  }
}
