import { darPorEntreguePelaClyon, retirarEntregaDadaPelaClyon } from "@/lib/db";

/**
 * «ESTÁ FEITO» SEM PROVA: OU FICA CONFIRMADO, OU NÃO FICA ENTREGUE — 10-11-2026 (d27).
 *
 * Confirmar sem a prova do parceiro são duas escritas: a CLYON dá o trabalho
 * por entregue em nome dele (`darPorEntreguePelaClyon`) e a seguir confirma.
 * Quando a confirmação era recusada — as horas de um trabalho à hora ainda
 * por confirmar, ou uma falha a meio — a primeira escrita ficava: o trabalho
 * aparecia «entregue» sem ninguém o ter entregue, e o prazo da libertação
 * automática começava a contar a partir de uma data que não aconteceu.
 *
 * Aqui as duas andam juntas. Se a confirmação não gravou (ou estoirou), a
 * entrega que NÓS escrevemos é retirada; a que o parceiro enviou, com a
 * prova dele, nunca é tocada — `retirarEntregaDadaPelaClyon` só desfaz o que
 * não tem prova nem confirmação.
 */
export async function confirmarDandoPorEntregue(
  negociacaoId: number,
  pedidoId: number,
  semProva: boolean,
  confirmar: () => Promise<boolean>,
): Promise<boolean> {
  const demosPorEntregue = semProva ? await darPorEntreguePelaClyon(negociacaoId, pedidoId) : false;
  let gravou = false;
  try {
    gravou = await confirmar();
  } finally {
    if (demosPorEntregue && !gravou) {
      await retirarEntregaDadaPelaClyon(negociacaoId, pedidoId).catch((e) =>
        console.error("[confirmar-sem-prova] a entrega dada pela CLYON não foi retirada:", negociacaoId, e),
      );
    }
  }
  return gravou;
}
