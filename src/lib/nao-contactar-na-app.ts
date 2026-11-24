/**
 * QUEM NÃO RECEBE CONVITES NEM LEMBRETES DA APP DE CLIENTE — 24-11-2026 (d106,
 * condição do Jurídico).
 *
 * Antes de cada convite, lembrete, WhatsApp ou aviso «Já pode entrar no
 * teste» da app de cliente, pergunta-se aqui. Fica de fora quem:
 *   1. tem o telefone (o da conta, ou o que quem chama já leu) na lista de
 *      «não contactar» (d93);
 *   2. tem o EMAIL nessa lista — quem cancelou e teve o pedido anonimizado na
 *      hora (`marcarEmailParaNaoContactar`, cancelar-pelo-cliente-na-base.ts);
 *   3. recusou as mensagens sobre a app («sem app», `marcarSemApp`);
 *   4. tem um pedido cancelado com esse email (`simulatorOrders.status =
 *      'cancelado'`, ainda por anonimizar).
 *
 * FALHA FECHADA: se a base não responder, a resposta é «não contactar» — um
 * convite que não sai hoje sai amanhã; um que saiu a quem não devia não se
 * desfaz.
 */

import type { Pool } from "mysql2/promise";
import { getPool } from "./db";
import { eEmailParaNaoContactar, eParaNaoContactar, eSemApp } from "./nao-contactar";

export async function naoContactarNaApp(p: { email: string; telefone?: string | null }): Promise<boolean> {
  const email = String(p.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) return true;
  try {
    const pool = (await getPool()) as Pool | null;
    if (!pool) return true;
    let telefone = p.telefone ?? null;
    if (p.telefone === undefined) {
      const [contas] = (await pool.execute(
        "SELECT phone FROM users WHERE LOWER(TRIM(email)) = ? AND deletedAt IS NULL LIMIT 1",
        [email],
      )) as [Array<{ phone: string | null }>, unknown];
      telefone = contas[0]?.phone ?? null;
    }
    if (telefone && (await eParaNaoContactar(telefone, { pool }))) return true;
    if (await eEmailParaNaoContactar(email, { pool })) return true;
    // A recusa das mensagens sobre a app (v3: {LINK_RECUSA}, «Não tenho Android», iPhone, «SEM APP»).
    if (await eSemApp({ email, telefone }, { pool })) return true;
    const [cancelados] = (await pool.execute(
      "SELECT 1 AS x FROM simulatorOrders WHERE LOWER(TRIM(contactEmail)) = ? AND status = 'cancelado' LIMIT 1",
      [email],
    )) as [Array<{ x: number }>, unknown];
    return cancelados.length > 0;
  } catch (e) {
    console.error("[nao-contactar-na-app] não se leu — não se envia:", e instanceof Error ? e.message : e);
    return true;
  }
}
