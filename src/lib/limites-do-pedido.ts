/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tamanhos máximos do que o pedido do simulador grava (d8, 23-11-2026).
 *
 * A rota é pública e escreve linhas completas na base: sem teto, um corpo
 * enorme enchia a descrição, o histórico da conversa e os nomes dos anexos.
 * Os limites são largos de propósito — um pedido legítimo nunca lá chega.
 */
export const MAX_DESCRICAO = 5000;
export const MAX_MENSAGENS_DO_HISTORICO = 200;
export const MAX_TEXTO_DE_MENSAGEM = 4000;
export const MAX_ANEXOS = 30;
export const MAX_NOME_DE_ANEXO = 200;

export function cortarTexto(valor: unknown, max: number): string | null {
  if (valor == null) return null;
  const s = typeof valor === "string" ? valor : String(valor);
  return s.length > max ? s.slice(0, max) : s;
}

/** O histórico da conversa: as últimas mensagens, cada uma com o texto cortado. */
export function limitarHistorico(historico: unknown): unknown {
  if (!Array.isArray(historico)) return historico;
  return historico.slice(-MAX_MENSAGENS_DO_HISTORICO).map((m) => {
    if (typeof m === "string") return cortarTexto(m, MAX_TEXTO_DE_MENSAGEM);
    if (m && typeof m === "object") {
      const rec = { ...(m as Record<string, unknown>) };
      for (const k of ["content", "text", "message"]) {
        if (typeof rec[k] === "string") rec[k] = cortarTexto(rec[k], MAX_TEXTO_DE_MENSAGEM);
      }
      return rec;
    }
    return m;
  });
}

/** Os anexos: no máximo MAX_ANEXOS, com o nome cortado. */
export function limitarAnexos(files: unknown): unknown {
  if (!Array.isArray(files)) return files;
  return files.slice(0, MAX_ANEXOS).map((f) => {
    if (f && typeof f === "object") {
      const rec = { ...(f as Record<string, unknown>) };
      if (rec.name != null) rec.name = cortarTexto(rec.name, MAX_NOME_DE_ANEXO);
      return rec;
    }
    return f;
  });
}

/** Aplica os três limites ao corpo do pedido, antes de qualquer outra leitura. */
export function limitarCorpoDoPedido(order: Record<string, any>, chatHistory: unknown) {
  if (order.description != null) order.description = cortarTexto(order.description, MAX_DESCRICAO);
  if (order.files != null) order.files = limitarAnexos(order.files);
  return { order, chatHistory: limitarHistorico(chatHistory) };
}
