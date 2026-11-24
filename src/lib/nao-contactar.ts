/**
 * NÃO CONTACTAR — d93, ponto 2 (CEO e dono, 23-11-2026).
 *
 * O cliente que cancelou pela conversa ouve «Não voltaremos a contactá-lo e os
 * seus dados foram apagados.» — e tem de ser verdade nas duas metades. Os
 * dados saem na hora (o pedido anonimiza-se, a conversa apaga-se); o número
 * fica aqui, numa lista de «não contactar», para nenhuma rotina lhe voltar a
 * escrever: a validade dos orçamentos (d62), os lembretes do que falta
 * (d71/d88), o seguimento (d83, e o que arranca sozinho na d90), os lembretes
 * da conversa parada (d93), as propostas que a Vitória envia (d88) e as que
 * vierem. Todas perguntam antes de enviar se já saiu hoje uma mensagem
 * automática (`uma-mensagem-automatica-por-dia.ts`), e essa pergunta responde
 * «sim» a um número desta lista: nada sai.
 *
 * O NÚMERO NÃO FICA ESCRITO: guarda-se a impressão dele (SHA-256 dos últimos
 * 9 dígitos, com um prefixo fixo), que chega para o reconhecer e não o devolve
 * a quem leia a tabela. Se ele voltar a escrever por iniciativa dele, a
 * Vitória responde-lhe como a qualquer pessoa (é ele a pedir), e a Mesa mostra
 * «Não contactar» na conversa.
 */

import { createHash } from "node:crypto";
import type { Pool } from "mysql2/promise";
import { getPool } from "./db";

const PREFIXO = "clyon-nao-contactar-d93:";

/** A impressão do número (últimos 9 dígitos), ou null sem número. Pura. */
export function chaveDoNumero(telefone: string | null | undefined): string | null {
  const d = String(telefone ?? "").replace(/\D/g, "");
  if (d.length < 9) return null;
  return createHash("sha256").update(`${PREFIXO}${d.slice(-9)}`).digest("hex");
}

export const SQL_DA_TABELA_DO_NAO_CONTACTAR = `CREATE TABLE IF NOT EXISTS naoContactar (
    chave     CHAR(64) NOT NULL PRIMARY KEY,
    criadoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origem    VARCHAR(60) NULL DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let pronta = false;

async function tabela(pool?: Pool): Promise<Pool> {
  const p = pool ?? (await getPool());
  if (!p) throw new Error("[nao-contactar] base de dados indisponível");
  if (!pronta) {
    await p.execute(SQL_DA_TABELA_DO_NAO_CONTACTAR);
    pronta = true;
  }
  return p;
}

/** Marca o número: nenhuma mensagem automática lhe volta a sair. */
export async function marcarParaNaoContactar(telefone: string, origem: string): Promise<boolean> {
  const chave = chaveDoNumero(telefone);
  if (!chave) return false;
  const pool = await tabela();
  await pool.execute("INSERT IGNORE INTO naoContactar (chave, origem) VALUES (?, ?)", [chave, origem.slice(0, 60)]);
  return true;
}

/** Este número está na lista? Lança se a base falhar (quem chama não envia). */
export async function eParaNaoContactar(telefone: string | null | undefined, opcoes: { pool?: Pool } = {}): Promise<boolean> {
  const chave = chaveDoNumero(telefone);
  if (!chave) return false;
  const pool = await tabela(opcoes.pool);
  const [rows] = (await pool.execute("SELECT 1 AS x FROM naoContactar WHERE chave = ? LIMIT 1", [chave])) as [Array<{ x: number }>, unknown];
  return Array.isArray(rows) && rows.length > 0;
}

/** Os números desta lista que estão na de «não contactar» — para a Mesa. Uma falha devolve vazio. */
export async function numerosParaNaoContactar(telefones: readonly string[]): Promise<Set<string>> {
  const fora = new Set<string>();
  const porChave = new Map<string, string[]>();
  for (const t of telefones) {
    const c = chaveDoNumero(t);
    if (c) porChave.set(c, [...(porChave.get(c) ?? []), t]);
  }
  if (porChave.size === 0) return fora;
  try {
    const pool = await tabela();
    const chaves = [...porChave.keys()];
    for (let i = 0; i < chaves.length; i += 200) {
      const lote = chaves.slice(i, i + 200);
      const [rows] = (await pool.execute(
        `SELECT chave FROM naoContactar WHERE chave IN (${lote.map(() => "?").join(",")})`,
        lote,
      )) as [Array<{ chave: string }>, unknown];
      for (const r of rows) for (const t of porChave.get(String(r.chave)) ?? []) fora.add(t);
    }
  } catch (e) {
    console.error("[nao-contactar] a lista não se leu:", e instanceof Error ? e.message : e);
  }
  return fora;
}

/* ─── O EMAIL TAMBÉM — 24-11-2026 (d106, condição do Jurídico) ─────────────
 *
 * Quem cancelou pela conversa (ou pelo painel, pela app) tem o pedido
 * anonimizado na hora: depois disso o email já não está em lado nenhum que
 * ligue a pessoa ao cancelamento. Para os convites e lembretes da app de
 * cliente (que saem por email) também não lhe escreverem, guarda-se a
 * impressão do EMAIL na mesma tabela, com outro prefixo (as duas impressões
 * nunca se confundem). Como o número, o email não fica escrito.
 */

const PREFIXO_DO_EMAIL = "clyon-nao-contactar-email-d106:";

/** A impressão do email (minúsculas, sem espaços), ou null sem email. Pura. */
export function chaveDoEmailNaoContactar(email: string | null | undefined): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return createHash("sha256").update(`${PREFIXO_DO_EMAIL}${e}`).digest("hex");
}

/** Marca o email: nenhum convite nem lembrete da app lhe volta a sair. */
export async function marcarEmailParaNaoContactar(email: string, origem: string): Promise<boolean> {
  const chave = chaveDoEmailNaoContactar(email);
  if (!chave) return false;
  const pool = await tabela();
  await pool.execute("INSERT IGNORE INTO naoContactar (chave, origem) VALUES (?, ?)", [chave, origem.slice(0, 60)]);
  return true;
}

/** Este email está na lista? Lança se a base falhar (quem chama não envia). */
export async function eEmailParaNaoContactar(email: string | null | undefined, opcoes: { pool?: Pool } = {}): Promise<boolean> {
  const chave = chaveDoEmailNaoContactar(email);
  if (!chave) return false;
  const pool = await tabela(opcoes.pool);
  const [rows] = (await pool.execute("SELECT 1 AS x FROM naoContactar WHERE chave = ? LIMIT 1", [chave])) as [Array<{ x: number }>, unknown];
  return Array.isArray(rows) && rows.length > 0;
}

/* ─── «SEM APP» — 24-11-2026 (d106, v3 da d107) ────────────────────────────
 *
 * A recusa das mensagens SOBRE A APP ({LINK_RECUSA}, o botão «Não me
 * interessa», «Não tenho Android», a página aberta num iPhone, o «SEM APP» na
 * conversa). Trava tudo o que é sobre a app — convite, lembrete, «Já pode
 * instalar», a linha no aviso de propostas — e NÃO as mensagens do pedido:
 * por isso tem a sua chave (outro prefixo), que só `naoContactarNaApp` lê.
 * Fica na mesma tabela (não sai com a purga do percurso, que é de 90 dias):
 * uma recusa não caduca. Pelo email e/ou pelo telefone; nenhum fica escrito.
 */

const PREFIXO_SEM_APP_EMAIL = "clyon-sem-app-email-d106:";
const PREFIXO_SEM_APP_TELEFONE = "clyon-sem-app-tel-d106:";

/** As impressões «sem app» desta pessoa (pelo email e pelo telefone). Pura. */
export function chavesSemApp(p: { email?: string | null; telefone?: string | null }): string[] {
  const chaves: string[] = [];
  const e = String(p.email ?? "").trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) chaves.push(createHash("sha256").update(`${PREFIXO_SEM_APP_EMAIL}${e}`).digest("hex"));
  const d = String(p.telefone ?? "").replace(/\D/g, "");
  if (d.length >= 9) chaves.push(createHash("sha256").update(`${PREFIXO_SEM_APP_TELEFONE}${d.slice(-9)}`).digest("hex"));
  return chaves;
}

/** Grava a recusa das mensagens sobre a app (o ponto de escrita para a Vitória também). */
export async function marcarSemApp(p: { email?: string | null; telefone?: string | null }, origem: string): Promise<boolean> {
  const chaves = chavesSemApp(p);
  if (chaves.length === 0) return false;
  const pool = await tabela();
  for (const chave of chaves) {
    await pool.execute("INSERT IGNORE INTO naoContactar (chave, origem) VALUES (?, ?)", [chave, origem.slice(0, 60)]);
  }
  return true;
}

/** Recusou as mensagens sobre a app? Lança se a base falhar (quem chama não envia). */
export async function eSemApp(p: { email?: string | null; telefone?: string | null }, opcoes: { pool?: Pool } = {}): Promise<boolean> {
  const chaves = chavesSemApp(p);
  if (chaves.length === 0) return false;
  const pool = await tabela(opcoes.pool);
  const [rows] = (await pool.execute(
    `SELECT 1 AS x FROM naoContactar WHERE chave IN (${chaves.map(() => "?").join(",")}) LIMIT 1`,
    chaves,
  )) as [Array<{ x: number }>, unknown];
  return Array.isArray(rows) && rows.length > 0;
}
