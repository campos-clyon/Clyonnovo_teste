/**
 * AS AVALIAÇÕES QUE O CLIENTE RECEBEU (29-10-2026) — a forma da rota
 * `GET /api/cliente/avaliacoes` lida com tolerância: o que não vier não
 * aparece. Puro de propósito: os testes do site importam-no.
 */
export const ROTA_DAS_AVALIACOES = "/api/cliente/avaliacoes";

export type AvaliacaoRecebida = { estrelas: number; comentario: string | null; quandoTexto: string | null; servico: string | null; parceiro: string | null };
export type AvaliacoesRecebidas = { avaliacoes: AvaliacaoRecebida[]; total: number; mediaTexto: string | null };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function avaliacoesRecebidas(r: unknown): AvaliacoesRecebidas {
  const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
  const lista = Array.isArray(o.avaliacoes) ? o.avaliacoes : [];
  const avaliacoes = lista.flatMap((x): AvaliacaoRecebida[] => {
    const a = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const estrelas = Math.round(Number(a.estrelas));
    if (!Number.isFinite(estrelas) || estrelas < 1 || estrelas > 5) return [];
    return [{ estrelas, comentario: texto(a.comentario), quandoTexto: texto(a.quandoTexto), servico: texto(a.servico), parceiro: texto(a.parceiro) }];
  });
  return { avaliacoes, total: avaliacoes.length, mediaTexto: avaliacoes.length > 0 ? texto(o.mediaTexto) : null };
}
