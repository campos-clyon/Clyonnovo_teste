import { getPool } from "@/lib/db";
import { normalize } from "@/lib/coverage";
import { instanteDaBase } from "@/lib/hora-de-lisboa";
import { eContaDeTeste } from "@/lib/perfil-publico-do-profissional";

/*
 * TRABALHOS CONCLUÍDOS NUMA TERRA — 14-10-2026 (auditoria de SEO, 30 dias).
 *
 * As 102 páginas de cidade diziam o mesmo, com o nome da terra trocado. O que
 * só a CLYON tem — e o Google não encontra noutro sítio — são os trabalhos
 * que se fizeram lá. Mostra-se o serviço, a terra e o mês: sem nome, sem
 * morada, sem preço. Contas de teste (do cliente ou do profissional) ficam de
 * fora, como nas comissões.
 *
 * Uma consulta para todas as páginas, guardada um minuto: as páginas de
 * cidade geram-se de uma vez no build e voltam a gerar-se uma vez por dia.
 */

export type TrabalhoConcluido = {
  servico: string;
  /** A terra como ficou no pedido — a da morada escolhida. */
  cidade: string;
  quando: Date;
};

let emCache: { quando: number; lista: TrabalhoConcluido[] } | null = null;
const VALIDADE = 60_000;

export async function trabalhosConcluidosRecentes(): Promise<TrabalhoConcluido[]> {
  if (emCache && Date.now() - emCache.quando < VALIDADE) return emCache.lista;
  try {
    const pool = await getPool();
    if (!pool) return [];
    const [linhas] = (await pool.execute(
      `SELECT o.serviceType, o.city, o.contactName,
              COALESCE(o.concluidoEm, c.confirmadoEm, o.updatedAt) AS quando
         FROM simulatorOrders o
         LEFT JOIN (
           SELECT x.pedidoId, MAX(x.confirmadoEm) AS confirmadoEm,
                  MAX(COALESCE(p.contaDeTeste, 0)) AS deTeste
             FROM negociacoes x
             LEFT JOIN providers p ON p.id = x.providerId
            WHERE x.confirmadoEm IS NOT NULL
            GROUP BY x.pedidoId
         ) c ON c.pedidoId = o.id
        WHERE o.status = 'concluido'
          AND COALESCE(c.deTeste, 0) = 0
          AND o.city IS NOT NULL AND o.city <> ''
          AND COALESCE(o.concluidoEm, c.confirmadoEm, o.updatedAt) >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 180 DAY)
        ORDER BY quando DESC
        LIMIT 1000`,
    )) as [Array<Record<string, unknown>>, unknown];
    const lista = linhas
      .filter((l) => !eContaDeTeste(typeof l.contactName === "string" ? l.contactName : null))
      .flatMap((l) => {
        const quando = instanteDaBase(l.quando as string | Date | null);
        const servico = typeof l.serviceType === "string" ? l.serviceType : "";
        const cidade = typeof l.city === "string" ? l.city.trim() : "";
        return quando && servico && cidade ? [{ servico, cidade, quando }] : [];
      });
    emCache = { quando: Date.now(), lista };
    return lista;
  } catch {
    // Uma base em baixo não parte a página: o bloco simplesmente não aparece.
    return [];
  }
}

/** Os desta terra — a morada do pedido diz o nome dela —, os mais recentes primeiro. */
export function concluidosNaTerra(lista: TrabalhoConcluido[], terra: string, limite = 6): TrabalhoConcluido[] {
  const alvo = normalize(terra);
  if (!alvo) return [];
  return lista.filter((t) => normalize(t.cidade).split(/[,\-–]/).map((p) => p.trim()).includes(alvo)).slice(0, limite);
}
