import { negociacoesDoPedido, perfilDoProfissional } from "./db";
import { avisarProfissionalSemOTrabalhoPorPush } from "./avisar-por-push";
import type { PorqueTerminou } from "./textos-dos-avisos-ao-profissional";

/**
 * QUEM FICA SEM O TRABALHO, E O AVISO QUE LHE CHEGA — 28-10-2026 (d5).
 *
 * Quando um pedido fecha com um profissional, as outras negociações passam a
 * «morta» (`encerrarOutrasNegociacoes`) sem aviso nenhum: quem tinha proposto
 * ficava à espera de uma resposta que não vinha, e não aprendia que a rapidez
 * conta. O mesmo quando o cliente desiste da negociação dele.
 *
 * A lista lê-se ANTES de encerrar — depois já não se distingue quem acabou de
 * perder de quem tinha perdido noutro dia. Nada aqui lança: o fecho já está
 * gravado quando isto corre, e um aviso que falhe não o pode desfazer.
 */

/** Ainda em aberto: o estado que `encerrarOutrasNegociacoes` passa a «morta». */
const EM_ABERTO = new Set(["aberta", "aguarda_contratacao"]);

export type QuemPerde = { negociacaoId: number; providerId: number };

/** Das negociações do pedido, as que vão ser encerradas por esta fechar. Pura. */
export function quemFicaSemOTrabalho(
  negociacoes: Array<{ id: unknown; estado: unknown; providerId: unknown }>,
  vencedora: number,
): QuemPerde[] {
  return (negociacoes ?? [])
    .filter((n) => Number(n.id) !== Number(vencedora) && EM_ABERTO.has(String(n.estado)))
    .map((n) => ({ negociacaoId: Number(n.id), providerId: Number(n.providerId) }))
    .filter((q) => Number.isInteger(q.negociacaoId) && Number.isInteger(q.providerId));
}

/** O mesmo, lendo a base — para quem ainda não tem a lista. Nunca lança. */
export async function quemVaiFicarSemOTrabalho(pedidoId: number, vencedora: number): Promise<QuemPerde[]> {
  try {
    return quemFicaSemOTrabalho(await negociacoesDoPedido(pedidoId), vencedora);
  } catch (err) {
    console.error("[avisar-quem-perdeu] não li as negociações:", err);
    return [];
  }
}

/** Avisa cada um no telemóvel (a app ou o navegador). Nunca lança. */
export async function avisarQuemFicouSemOTrabalho(p: {
  pedidoId: number;
  quem: QuemPerde[];
  porque: PorqueTerminou;
  motivo?: string | null;
}): Promise<void> {
  if (!p.quem?.length) return;
  await Promise.all(
    p.quem.map(async (q) => {
      try {
        const perfil = await perfilDoProfissional(q.providerId);
        const email = typeof perfil?.email === "string" ? perfil.email : null;
        if (!email) return;
        await avisarProfissionalSemOTrabalhoPorPush({
          email,
          pedidoId: p.pedidoId,
          negociacaoId: q.negociacaoId,
          porque: p.porque,
          motivo: p.motivo,
        });
      } catch (err) {
        console.error("[avisar-quem-perdeu] aviso não saiu:", err);
      }
    }),
  );
}
