import { getPool, ensureProvidersSchema, ensureNegociacoesTable } from "./db";
import { eContaDeTeste } from "./perfil-publico-do-profissional";
import {
  coberturaPorConcelho,
  pedidosPorConcelho,
  type CoberturaPorConcelho,
  type NegociacaoParaACobertura,
  type ParceiroParaACobertura,
  type PedidoParaACobertura,
} from "./cobertura-por-concelho";
import type { IdDoConcelho } from "./concelhos-da-cobertura";
import { inicioDoDiaEmLisboa, primeiroDoMesEmLisboa } from "./hora-de-lisboa";

/**
 * A COBERTURA POR CONCELHO, LIDA NA BASE — 04-11-2026 (d16).
 *
 * Só leitura: os parceiros, as negociações que mexeram nos últimos 30 dias e
 * os pedidos dos últimos 30 dias. A conta é a de `cobertura-por-concelho.ts`.
 * O ponto do pedido no mapa vem do JSON do pedido (`address.lat/lng`, gravado
 * no envio — ver `coordenadas-do-pedido.ts`).
 */

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

async function pedidosDesde(pool: Pool, desde: Date): Promise<PedidoParaACobertura[]> {
  const [linhas] = (await pool.execute(
    `SELECT o.id, o.createdAt, o.postalCode, o.city, o.address, o.status, o.contactName, o.propostaEnviadaEm,
            CASE WHEN JSON_VALID(o.rawOrderJson) THEN JSON_EXTRACT(o.rawOrderJson, '$.address.lat') END AS lat,
            CASE WHEN JSON_VALID(o.rawOrderJson) THEN JSON_EXTRACT(o.rawOrderJson, '$.address.lng') END AS lng
       FROM simulatorOrders o
      WHERE o.createdAt >= ?`,
    [desde],
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => ({
    id: Number(l.id),
    createdAt: l.createdAt as Date | string | null,
    postalCode: l.postalCode,
    city: l.city,
    address: l.address,
    lat: l.lat == null ? null : Number(l.lat),
    lng: l.lng == null ? null : Number(l.lng),
    status: (l.status as string | null) ?? null,
    propostaEnviadaEm: (l.propostaEnviadaEm as Date | string | null) ?? null,
    // Um pedido de teste diz-se pelo nome, como as contas de teste.
    deTeste: eContaDeTeste(typeof l.contactName === "string" ? l.contactName : null),
  }));
}

export async function coberturaNaBase(agora: Date = new Date()): Promise<CoberturaPorConcelho> {
  await ensureProvidersSchema();
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const desde = new Date(agora.getTime() - 30 * 86_400_000);

  const [parceiros] = (await pool.execute(
    `SELECT id, name, estado, isActive, raioKm, baseLat, baseLng, COALESCE(contaDeTeste, 0) AS contaDeTeste
       FROM providers
      WHERE isClyon = 0 AND (estado IS NULL OR estado <> 'apagado')`,
  )) as [Array<Record<string, unknown>>, unknown];

  const pedidos = await pedidosDesde(pool, desde);
  const ids = pedidos.map((p) => p.id);

  // As negociações que mexeram na janela (as propostas mudam o updatedAt) e as dos pedidos dela.
  const [negs] = (await pool.execute(
    `SELECT n.providerId, n.pedidoId, n.estado, n.createdAt, n.updatedAt, n.propostasJson, n.ofertaClyon,
            n.abertoProfissionalEm, n.atribuidaEm, n.dataCombinada, n.execucaoEnviadaEm, n.confirmadoEm
       FROM negociacoes n
      WHERE n.updatedAt >= ? OR n.createdAt >= ?
            ${ids.length > 0 ? `OR n.pedidoId IN (${ids.map(() => "?").join(",")})` : ""}`,
    [desde, desde, ...ids],
  )) as [Array<Record<string, unknown>>, unknown];

  return coberturaPorConcelho({
    parceiros: parceiros.map(
      (p): ParceiroParaACobertura => ({
        id: Number(p.id),
        estado: (p.estado as string | null) ?? null,
        isActive: p.isActive,
        deTeste: Number(p.contaDeTeste) === 1 || eContaDeTeste(typeof p.name === "string" ? p.name : null),
        raioKm: p.raioKm == null ? null : Number(p.raioKm),
        baseLat: p.baseLat,
        baseLng: p.baseLng,
      }),
    ),
    negociacoes: negs.map(
      (n): NegociacaoParaACobertura => ({
        providerId: Number(n.providerId),
        pedidoId: Number(n.pedidoId),
        estado: String(n.estado ?? ""),
        createdAt: n.createdAt as Date | string | null,
        updatedAt: n.updatedAt as Date | string | null,
        propostasJson: (n.propostasJson as string | null) ?? null,
        ofertaClyon: (n.ofertaClyon as string | null) ?? null,
        abertoProfissionalEm: n.abertoProfissionalEm as Date | string | null,
        atribuidaEm: n.atribuidaEm as Date | string | null,
        dataCombinada: n.dataCombinada as Date | string | null,
        execucaoEnviadaEm: n.execucaoEnviadaEm as Date | string | null,
        confirmadoEm: n.confirmadoEm as Date | string | null,
      }),
    ),
    pedidos,
    agora,
  });
}

/**
 * Os pedidos DESTE MÊS (em Lisboa) por concelho, só os que chegam ao mínimo —
 * para «há N pedidos na sua zona este mês» em /quero-ser-parceiro. Na dúvida,
 * nada: um erro devolve um objecto vazio, e a frase não aparece.
 */
export async function pedidosDoMesPorConcelho(
  minimo: number,
  agora: Date = new Date(),
): Promise<Partial<Record<IdDoConcelho, number>>> {
  try {
    const pool = await getPool();
    if (!pool) return {};
    const pedidos = await pedidosDesde(pool, inicioDoDiaEmLisboa(primeiroDoMesEmLisboa(agora)));
    // Os arquivados ficam de fora, como no número da semana (repetidos, testes).
    return pedidosPorConcelho(
      pedidos.filter((p) => p.status !== "arquivado"),
      minimo,
    );
  } catch (e) {
    console.error("[cobertura] pedidos do mês por concelho:", e instanceof Error ? e.message : e);
    return {};
  }
}
