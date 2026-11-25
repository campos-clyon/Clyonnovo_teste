import { getPool, getSimulatorSettings } from "./db";
import {
  BASE_DA_ZONA,
  CHAVE_DO_LIMITE_DA_ZONA,
  KM_DA_ZONA_POR_OMISSAO,
  foraDaZona,
  limiteDaZona,
  type ForaDaZona,
} from "./fora-da-zona";
import { ESTADOS_DE_PEDIDO_FECHADO_SQL } from "./pedido-arrumado";
import type { Ponto } from "./distancia-entre-pontos";

/**
 * FORA DA ZONA, NO SERVIDOR — d128 (25-11-2026). A regra está em
 * `fora-da-zona.ts`; aqui lê-se o limite das Configs (uma fonte para todos) e
 * os pedidos da base. Nunca lança: sem base, nada fica marcado.
 */

/** A base CLYON — as variáveis de ambiente mandam, como no motor de custos. */
export function baseDaZona(): Ponto {
  return {
    lat: Number(process.env.CLYON_BASE_LAT) || BASE_DA_ZONA.lat,
    lng: Number(process.env.CLYON_BASE_LNG) || BASE_DA_ZONA.lng,
  };
}

let guardado: { limite: number; ate: number } | null = null;

/** O limite da zona nas Configs (`zona_km_maximo`), guardado um minuto. */
export async function limiteDaZonaKm(): Promise<number> {
  const agora = Date.now();
  if (guardado && guardado.ate > agora) return guardado.limite;
  let limite = KM_DA_ZONA_POR_OMISSAO;
  try {
    const linha = (await getSimulatorSettings()).find((s) => s.key === CHAVE_DO_LIMITE_DA_ZONA);
    limite = limiteDaZona(linha?.value);
  } catch (e) {
    console.error("[fora-da-zona] limite das Configs:", e instanceof Error ? e.message : e);
  }
  guardado = { limite, ate: agora + 60_000 };
  return limite;
}

/** Um pedido já lido (`getSimulatorOrderById`): está fora da zona? */
export async function foraDaZonaDoPedido(
  pedido: { serviceType?: unknown; status?: unknown; rawOrderJson?: unknown } | null | undefined,
): Promise<ForaDaZona | null> {
  if (!pedido) return null;
  try {
    return foraDaZona(
      {
        serviceType: typeof pedido.serviceType === "string" ? pedido.serviceType : null,
        status: typeof pedido.status === "string" ? pedido.status : null,
        rawOrderJson: pedido.rawOrderJson,
      },
      await limiteDaZonaKm(),
      baseDaZona(),
    );
  } catch {
    return null;
  }
}

type LinhaDaZona = { id: number; serviceType: string | null; status: string | null; rawOrderJson: unknown };

async function lerLinhas(ids: readonly number[] | null): Promise<LinhaDaZona[]> {
  const pool = await getPool();
  if (!pool) return [];
  const limpos = ids ? [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : null;
  if (limpos && limpos.length === 0) return [];
  /*
   * Só os campos que a regra lê (as coordenadas, a medida do simulador, a
   * edição) — o rawOrderJson inteiro de todos os pedidos abertos era pesado
   * para o selo, que corre a cada minuto. Um JSON partido não parte a lista.
   */
  const j = (caminho: string) => `JSON_EXTRACT(rawOrderJson, '${caminho}')`;
  const resumo = `CASE WHEN JSON_VALID(rawOrderJson) THEN JSON_OBJECT(
      'address', JSON_OBJECT('lat', ${j("$.address.lat")}, 'lng', ${j("$.address.lng")}),
      'originAddress', JSON_OBJECT('lat', ${j("$.originAddress.lat")}, 'lng', ${j("$.originAddress.lng")}),
      'distanceFromBase', JSON_OBJECT(
        'distanceKm', ${j("$.distanceFromBase.distanceKm")},
        'durationSeconds', ${j("$.distanceFromBase.durationSeconds")},
        'distanceMeters', ${j("$.distanceFromBase.distanceMeters")},
        'isEstimate', ${j("$.distanceFromBase.isEstimate")}),
      'editadoPelaClyonEm', ${j("$.editadoPelaClyonEm")}
    ) END AS resumo`;
  const [rows] = (await pool.execute(
    limpos
      ? `SELECT id, serviceType, status, ${resumo} FROM simulatorOrders WHERE id IN (${limpos.map(() => "?").join(", ")})`
      : `SELECT id, serviceType, status, ${resumo} FROM simulatorOrders
          WHERE status NOT IN ${ESTADOS_DE_PEDIDO_FECHADO_SQL} AND rawOrderJson IS NOT NULL`,
    limpos ?? [],
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.map((r) => ({
    id: Number(r.id),
    serviceType: r.serviceType == null ? null : String(r.serviceType),
    status: r.status == null ? null : String(r.status),
    rawOrderJson: r.resumo ?? null,
  }));
}

/** Os pedidos destes ids que estão fora da zona (abertos e acima do limite). */
export async function foraDaZonaDosPedidos(ids: readonly number[]): Promise<Map<number, ForaDaZona>> {
  const m = new Map<number, ForaDaZona>();
  try {
    const limite = await limiteDaZonaKm();
    const base = baseDaZona();
    for (const l of await lerLinhas(ids)) {
      const f = foraDaZona(l, limite, base);
      if (f) m.set(l.id, f);
    }
  } catch (e) {
    console.error("[fora-da-zona] pedidos:", e instanceof Error ? e.message : e);
  }
  return m;
}

/** Os ids parados (para as rotinas da Vitória e da distribuição saltarem por cima). */
export async function idsForaDaZona(ids: readonly number[]): Promise<Set<number>> {
  return new Set((await foraDaZonaDosPedidos(ids)).keys());
}

/** Todos os pedidos abertos fora da zona — o selo e a lista da Mesa. */
export async function todosOsForaDaZona(): Promise<Map<number, ForaDaZona>> {
  const m = new Map<number, ForaDaZona>();
  try {
    const limite = await limiteDaZonaKm();
    const base = baseDaZona();
    for (const l of await lerLinhas(null)) {
      const f = foraDaZona(l, limite, base);
      if (f) m.set(l.id, f);
    }
  } catch (e) {
    console.error("[fora-da-zona] todos:", e instanceof Error ? e.message : e);
  }
  return m;
}

/**
 * A recusa das rotas que levam o pedido aos parceiros (redistribuir, oferecer,
 * voltar a oferecer, atribuir): o texto, ou nulo quando pode seguir.
 */
export async function recusaSeForaDaZona(pedidoOuId: number | { serviceType?: unknown; status?: unknown; rawOrderJson?: unknown } | null | undefined): Promise<string | null> {
  try {
    const f =
      typeof pedidoOuId === "number"
        ? ((await foraDaZonaDosPedidos([pedidoOuId])).get(pedidoOuId) ?? null)
        : await foraDaZonaDoPedido(pedidoOuId);
    if (!f) return null;
    const { recusaForaDaZona } = await import("./fora-da-zona");
    return recusaForaDaZona(f);
  } catch {
    return null;
  }
}
