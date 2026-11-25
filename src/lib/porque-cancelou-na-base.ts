/**
 * DEPOIS DE CANCELAR, O PORQUÊ, NA BASE — d126 (CEO e dono, 25-11-2026). As
 * regras puras estão em `porque-cancelou.ts`.
 *
 * A conversa apaga-se e o pedido anonimiza-se no momento do cancelamento
 * (d93), por isso a pergunta do porquê fica aqui, numa tabela própria, sem o
 * número: a chave é a impressão dele (a mesma do «não contactar»), com os
 * pedidos cancelados e quando se perguntou. A resposta dele (uma, nas 48 h
 * seguintes) grava o motivo do fecho em cada pedido e uma linha no histórico.
 */

import type { Pool } from "mysql2/promise";
import { appendOrderHistory, getPool, gravarMotivoDoFecho } from "./db";
import { chaveDoNumero } from "./nao-contactar";
import { HORAS_PARA_O_PORQUE, MOTIVO_DO_FECHO_DO_PORQUE, ROTULO_DO_PORQUE, lerOPorque, type PorqueCancelou } from "./porque-cancelou";

export const SQL_DA_TABELA_DO_PORQUE = `CREATE TABLE IF NOT EXISTS porqueDoCancelamento (
    chave        CHAR(64) NOT NULL PRIMARY KEY,
    pedidos      VARCHAR(200) NOT NULL,
    perguntadoEm DATETIME NOT NULL,
    respondidoEm DATETIME NULL DEFAULT NULL,
    resposta     VARCHAR(20) NULL DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let pronta = false;

async function tabela(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[porque-cancelou] base de dados indisponível");
  if (!pronta) {
    await pool.execute(SQL_DA_TABELA_DO_PORQUE);
    pronta = true;
  }
  return pool;
}

/** A pergunta saiu: fica à espera da resposta dele (a última pergunta manda). */
export async function registarAPerguntaDoPorque(telefone: string, pedidos: readonly number[]): Promise<boolean> {
  const chave = chaveDoNumero(telefone);
  const ids = pedidos.filter((n) => Number.isInteger(n) && n > 0);
  if (!chave || ids.length === 0) return false;
  const pool = await tabela();
  await pool.execute(
    `INSERT INTO porqueDoCancelamento (chave, pedidos, perguntadoEm) VALUES (?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE pedidos = VALUES(pedidos), perguntadoEm = UTC_TIMESTAMP(), respondidoEm = NULL, resposta = NULL`,
    [chave, ids.join(",").slice(0, 200)],
  );
  return true;
}

/** Os pedidos da pergunta do porquê por responder deste número (nas 48 h), ou null. */
export async function porqueEmAberto(telefone: string): Promise<number[] | null> {
  const chave = chaveDoNumero(telefone);
  if (!chave) return null;
  const pool = await tabela();
  const [rows] = (await pool.execute(
    `SELECT pedidos FROM porqueDoCancelamento
      WHERE chave = ? AND respondidoEm IS NULL AND perguntadoEm > UTC_TIMESTAMP() - INTERVAL ${HORAS_PARA_O_PORQUE} HOUR LIMIT 1`,
    [chave],
  )) as [Array<{ pedidos: string }>, unknown];
  const ids = String(rows?.[0]?.pedidos ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length > 0 ? ids : null;
}

export type RespostaAoPorque =
  /** Não é a resposta ao porquê (não há pergunta, ou é outra conversa): segue a de sempre. */
  | null
  /** Um «obrigada» sozinho: não pede resposta, e a pergunta continua aberta. */
  | { tipo: "silencio" }
  | { tipo: "respondeu"; pedidos: number[]; porque: PorqueCancelou };

/**
 * A MENSAGEM DELE É A RESPOSTA AO PORQUÊ? Se é, grava (uma vez só) o motivo em
 * cada pedido e devolve-o; quem chama responde. O que se lê como outra coisa —
 * uma pergunta, um serviço novo — não é a resposta: segue a conversa de sempre.
 */
export async function lerARespostaAoPorque(
  telefone: string,
  texto: string,
  opcoes: { eSoUmObrigado: (t: string) => boolean; pedeUmServico: (t: string) => boolean },
): Promise<RespostaAoPorque> {
  const cru = String(texto ?? "").trim();
  if (!cru || cru.length > 400) return null;
  const pedidos = await porqueEmAberto(telefone);
  if (!pedidos) return null;
  if (opcoes.eSoUmObrigado(cru)) return { tipo: "silencio" };
  let porque = lerOPorque(cru);
  if (!porque) {
    // Por palavras, sem as nossas: «outro motivo» — salvo uma pergunta ou um pedido novo.
    if (/\?/.test(cru) || opcoes.pedeUmServico(cru)) return null;
    porque = "outro";
  }
  const chave = chaveDoNumero(telefone);
  const pool = await tabela();
  const [r] = (await pool.execute(
    `UPDATE porqueDoCancelamento SET respondidoEm = UTC_TIMESTAMP(), resposta = ?
      WHERE chave = ? AND respondidoEm IS NULL`,
    [porque, chave],
  )) as [{ affectedRows: number }, unknown];
  if (Number(r.affectedRows) !== 1) return null;
  for (const id of pedidos) {
    await gravarMotivoDoFecho(id, MOTIVO_DO_FECHO_DO_PORQUE[porque], null, null).catch(() => {});
    await appendOrderHistory(id, {
      type: "note",
      by: null,
      message: `O cliente disse porque cancelou, pelo WhatsApp (d126): ${ROTULO_DO_PORQUE[porque]}.`,
    }).catch(() => {});
  }
  return { tipo: "respondeu", pedidos, porque };
}
