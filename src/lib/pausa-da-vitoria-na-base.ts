/**
 * O SINAL DA EQUIPA, NA BASE — 25-11-2026 (decisão d116). Ver `pausa-da-vitoria.ts`.
 *
 *   · «pausar»  → a conversa fica entregue a uma pessoa, com o motivo
 *                 «Pausada pela equipa (*)» (sem aviso à equipa: foi ela);
 *   · «retomar» → o mesmo que «Devolver ao site»: a entrega sai e fica a
 *                 marca da devolução (`retomarNumeroWhatsApp` +
 *                 `marcarDevolvidaWhatsApp`).
 *
 * Quem chama é a rota da ponte (a mensagem à mão no telemóvel) e a resposta
 * pelo backoffice — nunca as mensagens da Vitória, do sistema ou do cliente.
 */
import { MOTIVO_DA_PAUSA, textoComparavel, type SinalDaEquipa } from "./pausa-da-vitoria";

/** Aplica o sinal a esta conversa. */
export async function aplicarOSinalDaEquipa(telefone: string, sinal: SinalDaEquipa): Promise<void> {
  const db = await import("./db");
  if (sinal === "pausar") {
    await db.interromperNumeroWhatsApp(telefone, MOTIVO_DA_PAUSA, "pessoa");
    return;
  }
  await db.retomarNumeroWhatsApp(telefone);
  const { marcarDevolvidaWhatsApp } = await import("./pedido-em-curso-na-base");
  await marcarDevolvidaWhatsApp(telefone).catch(() => {});
}

/**
 * ESTA «RESPOSTA À MÃO» FOI, AFINAL, UMA MENSAGEM DO SITE? A ponte reconhece
 * as que manda (`eraNossa`), mas o aviso pode chegar antes de ela marcar a
 * mensagem — e então o texto da Vitória (com «» nas aspas) chegava aqui como
 * se fosse da equipa. Se o mesmo texto saiu pela fila deste número na última
 * hora, não é da equipa: os sinais não contam. Na dúvida (a base falhou),
 * também não contam.
 */
export async function saiuPeloSiteHaPouco(telefone: string, texto: string): Promise<boolean> {
  const alvo = textoComparavel(texto);
  if (!alvo) return false;
  try {
    const { getPool } = await import("./db");
    const pool = await getPool();
    if (!pool) return true;
    const [rows] = (await pool.execute(
      `SELECT texto FROM whatsappFila
        WHERE RIGHT(telefone, 9) = RIGHT(?, 9) AND criadoEm > NOW() - INTERVAL 60 MINUTE
        ORDER BY id DESC LIMIT 30`,
      [telefone.replace(/\D/g, "")],
    )) as [Array<{ texto: unknown }>, unknown];
    return rows.some((r) => textoComparavel(String(r.texto ?? "")) === alvo);
  } catch {
    return true;
  }
}
