/**
 * d94 — ALINHAR AS NEGOCIAÇÕES DE PEDIDOS JÁ FECHADOS (não corre sozinho).
 *
 * Pedidos cancelados, arquivados ou rejeitados ANTES da d94 que ainda têm
 * negociações vivas e por fazer (aberta, à espera da contratação, ou acordada
 * sem trabalho feito, confirmado ou pago). O painel e a app já os lêem como
 * perdidos (`estadoParaOProfissionalSql`), mas a base diz outra coisa — e a
 * Mesa, a carteira e as contas lêem a base.
 *
 * O que faz, com `--a-serio`: passa essas negociações a «morta», guardando o
 * estado de antes em `estadoAntesDeCancelar` (o «Desfazer» / «Restaurar»
 * repõe-nas). A mesma regra de `fecharNegociacoesDeUmPedidoArrumado`. O que já
 * foi feito, confirmado ou pago NÃO se toca: é dinheiro de alguém.
 *
 * Sem `--a-serio` só CONTA (por omissão). Idempotente: uma segunda passagem
 * não encontra nada. NÃO avisa ninguém — são fins antigos, já não são notícia.
 * Não escreve nomes, contactos nem moradas: só números de pedido e contagens.
 *
 *   DATABASE_URL=... node scripts/d94-alinhar-negociacoes-de-pedidos-fechados.mjs          # conta
 *   DATABASE_URL=... node scripts/d94-alinhar-negociacoes-de-pedidos-fechados.mjs --a-serio
 *
 * Só com a decisão do CEO e do dono.
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definido.");
  process.exit(1);
}
const A_SERIO = process.argv.includes("--a-serio");

const POR_FAZER = `(n.estado IN ('aberta', 'aguarda_contratacao') OR
  (n.estado = 'acordada' AND n.execucaoEnviadaEm IS NULL AND n.confirmadoEm IS NULL AND n.pagoEm IS NULL))`;
const POR_FAZER_SEM_PREFIXO = `(estado IN ('aberta', 'aguarda_contratacao') OR
  (estado = 'acordada' AND execucaoEnviadaEm IS NULL AND confirmadoEm IS NULL AND pagoEm IS NULL))`;

const pool = mysql.createPool({ uri: DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionLimit: 2 });
try {
  const [linhas] = await pool.execute(
    `SELECT o.id AS pedidoId, o.status, COUNT(*) AS vivas,
            SUM(n.estado = 'acordada') AS contratadas
       FROM negociacoes n
       JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE o.status IN ('cancelado', 'arquivado', 'rejeitado') AND ${POR_FAZER}
      GROUP BY o.id, o.status
      ORDER BY o.id DESC`,
  );
  const total = linhas.reduce((s, l) => s + Number(l.vivas), 0);
  console.log(`Pedidos fechados com negociações vivas e por fazer: ${linhas.length} (${total} negociações).`);
  for (const l of linhas) {
    console.log(`  #${l.pedidoId} ${l.status}: ${l.vivas} viva(s)${Number(l.contratadas) ? `, ${l.contratadas} contratada(s)` : ""}`);
  }
  if (!A_SERIO) {
    console.log("Só contei. Para alinhar: --a-serio (com a decisão do CEO e do dono).");
  } else if (linhas.length > 0) {
    const ids = linhas.map((l) => Number(l.pedidoId));
    // Uma tabela só: o MySQL aplica as atribuições da esquerda para a direita
    // (o estado de antes lê-se antes de se escrever «morta»). Num UPDATE com
    // JOIN essa ordem não é garantida.
    const [r] = await pool.execute(
      `UPDATE negociacoes
          SET estadoAntesDeCancelar = estado, estado = 'morta'
        WHERE pedidoId IN (${ids.map(() => "?").join(", ")}) AND ${POR_FAZER_SEM_PREFIXO}`,
      ids,
    );
    console.log(`Alinhadas: ${r.affectedRows} negociação(ões).`);
  }
} finally {
  await pool.end();
}
