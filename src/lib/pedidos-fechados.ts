import { ensureNegociacoesTable, ensureSimulatorOrdersTable, withConnection } from "@/lib/db";
import { instanteDaBase } from "@/lib/hora-de-lisboa";

/**
 * OS PEDIDOS FECHADOS DA PLATAFORMA, NOS TRABALHOS CLYON — 17-10-2026.
 *
 * *«Coloque também a opção dos trabalhos arquivados, mas quero que trabalhos
 * arquivados, concluídos e cancelados reúna todos os trabalhos.»* — o dono,
 * que escolheu «todos os pedidos»: os Trabalhos CLYON e também os pedidos
 * normais, os que passam pelas Negociações. Estes são os normais (sem valor
 * fixo da CLYON) já concluídos, cancelados ou arquivados; os Trabalhos CLYON
 * continuam a vir de `ofertasClyon`, com a conta e os botões deles.
 *
 * Só leitura. Os mais recentes primeiro, com um tecto para a lista não pesar.
 */

export const ESTADOS_FECHADOS = ["concluido", "cancelado", "arquivado"] as const;
export type EstadoFechado = (typeof ESTADOS_FECHADOS)[number];

export type PedidoFechado = {
  pedidoId: number;
  estado: EstadoFechado;
  servico: string | null;
  localidade: string | null;
  morada: string | null;
  cliente: string | null;
  telefone: string | null;
  /** Quem ficou com o trabalho — a negociação acordada mais recente. */
  profissional: string | null;
  providerId: number | null;
  /** Quem operou o pedido do lado da CLYON; sem responsável, o administrador. */
  operador: string;
  /** O valor acordado com o profissional, quando houve negociação. */
  valorAcordado: number | null;
  /** A conclusão, ou — cancelado ou arquivado — a última mexida no pedido. */
  quando: string | null;
};

type Linha = {
  id: number;
  status: string;
  serviceType: string | null;
  city: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  assignedToName: string | null;
  concluidoEm: Date | string | null;
  updatedAt: Date | string | null;
  valorAcordado: number | string | null;
  providerId: number | string | null;
  profissional: string | null;
};

export const LIMITE_DE_PEDIDOS_FECHADOS = 300;

/** Puro: a linha da base no formato do ecrã. */
export function pedidoFechadoDaLinha(l: Linha): PedidoFechado | null {
  const estado = (ESTADOS_FECHADOS as readonly string[]).includes(l.status) ? (l.status as EstadoFechado) : null;
  if (!estado) return null;
  const valor = l.valorAcordado == null || l.valorAcordado === "" ? null : Number(l.valorAcordado);
  const instante = instanteDaBase((estado === "concluido" ? l.concluidoEm ?? l.updatedAt : l.updatedAt) ?? null);
  return {
    pedidoId: Number(l.id),
    estado,
    servico: l.serviceType ?? null,
    localidade: l.city ?? null,
    morada: l.address ?? null,
    cliente: (l.contactName ?? "").trim() || null,
    telefone: (l.contactPhone ?? "").trim() || null,
    profissional: (l.profissional ?? "").trim() || null,
    providerId: l.providerId == null ? null : Number(l.providerId),
    operador: (l.assignedToName ?? "").trim() || "Admin",
    valorAcordado: valor != null && Number.isFinite(valor) ? valor : null,
    quando: instante ? instante.toISOString() : null,
  };
}

export async function pedidosFechadosDaPlataforma(limite = LIMITE_DE_PEDIDOS_FECHADOS): Promise<PedidoFechado[]> {
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  return withConnection(async (conn) => {
    const [linhas] = (await conn.execute(
      `SELECT o.id, o.status, o.serviceType, o.city, o.address, o.contactName, o.contactPhone,
              o.assignedToName, o.concluidoEm, o.updatedAt,
              n.valorAcordado, n.providerId, pn.name AS profissional
         FROM simulatorOrders o
         LEFT JOIN (
           SELECT pedidoId, MAX(id) AS negociacaoId
             FROM negociacoes
            WHERE estado = 'acordada'
            GROUP BY pedidoId
         ) a ON a.pedidoId = o.id
         LEFT JOIN negociacoes n ON n.id = a.negociacaoId
         LEFT JOIN providers pn ON pn.id = n.providerId
        WHERE o.status IN ('concluido', 'cancelado', 'arquivado')
          AND o.valorFixoClyon IS NULL
        ORDER BY o.id DESC
        LIMIT ${Math.max(1, Math.min(1000, Math.floor(limite)))}`,
    )) as [Linha[], unknown];
    return linhas.map(pedidoFechadoDaLinha).filter((p): p is PedidoFechado => p != null);
  });
}
