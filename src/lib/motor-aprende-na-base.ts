/**
 * OS PARES PARA O MOTOR APRENDER, LIDOS DA BASE — 03-11-2026.
 *
 * A regra está em `motor-aprende.ts`; aqui só se vai buscar o que ela precisa:
 * para cada negociação ACORDADA nos últimos `DIAS_A_OLHAR` dias, o serviço do
 * pedido, a estimativa do motor s/IVA (do `estimateJson`, que a traz pelo
 * nome — as colunas `estimateTotal`/`estimateMax` misturam com e sem IVA, ver
 * `AdminPedidoDetalheClient.tsx`) e o valor acordado, s/IVA.
 *
 * Fora: contas de teste (`providers.contaDeTeste`), e preços por carga ou por
 * hora (o número mede outra coisa).
 *
 * A leitura guarda-se em memória `CACHE_MS`: o simulador chama isto a cada
 * pedido, e o fator não muda de um minuto para o outro.
 */
import { ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "./db";
import { calibrarServico, calibrarTudo, type CalibracaoDoServico, type ParParaAprender } from "./motor-aprende";

export const DIAS_A_OLHAR = 180;
const CACHE_MS = 10 * 60 * 1000;
const ESPERA_MAXIMA_MS = 1500;

let cache: { em: number; pares: ParParaAprender[] } | null = null;

function numeroPositivo(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A estimativa do MOTOR, s/IVA, de um JSON guardado — sem rebentar com JSON
 * velho ou estragado.
 *
 * Prefere `precoDoMotorSemIva` (o preço antes da aprendizagem): comparar o
 * acordado com um preço já corrigido faria o fator corrigir-se a si próprio
 * e crescer de mês para mês. Pedidos antigos não têm o campo e usam o
 * `estimatedPriceWithoutVat`, que nessa altura era o do motor.
 */
export function estimativaSemIvaDoJson(json: string | null | undefined): number | null {
  if (!json) return null;
  try {
    const e = JSON.parse(json) as { precoDoMotorSemIva?: unknown; estimatedPriceWithoutVat?: unknown } | null;
    return numeroPositivo(e?.precoDoMotorSemIva) ?? numeroPositivo(e?.estimatedPriceWithoutVat);
  } catch {
    return null;
  }
}

export async function lerParesParaAprender(agora = Date.now()): Promise<ParParaAprender[]> {
  if (cache && agora - cache.em < CACHE_MS) return cache.pares;
  const pool = await getPool();
  if (!pool) return [];
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();

  const [linhas] = await pool.execute(
    `SELECT o.serviceType, o.estimateJson, n.valorAcordado
       FROM negociacoes n
       JOIN simulatorOrders o ON o.id = n.pedidoId
       LEFT JOIN providers p ON p.id = n.providerId
      WHERE n.estado = 'acordada'
        AND n.valorAcordado IS NOT NULL
        AND n.valorAcordado > 0
        AND o.estimateJson IS NOT NULL
        AND COALESCE(o.baseDoPreco, 'total') = 'total'
        AND COALESCE(p.contaDeTeste, 0) = 0
        AND n.updatedAt >= DATE_SUB(NOW(), INTERVAL ${DIAS_A_OLHAR} DAY)`,
  );

  const pares: ParParaAprender[] = [];
  for (const l of linhas as Array<{ serviceType: string | null; estimateJson: string | null; valorAcordado: string | number }>) {
    const estimativa = estimativaSemIvaDoJson(l.estimateJson);
    const acordado = Number(l.valorAcordado);
    if (!l.serviceType || estimativa == null || !Number.isFinite(acordado)) continue;
    pares.push({ servico: l.serviceType, estimativaSemIva: estimativa, acordadoSemIva: acordado });
  }
  cache = { em: agora, pares };
  return pares;
}

/** O fator de um serviço. Qualquer falha da base devolve null (o preço fica como o motor o deu). */
export async function calibracaoDoServico(servico: string | null | undefined): Promise<CalibracaoDoServico | null> {
  if (!servico) return null;
  try {
    // O simulador não espera pela base mais do que isto: sem resposta a tempo,
    // o preço fica o do motor e a próxima leitura tenta outra vez.
    const pares = await Promise.race([
      lerParesParaAprender(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ESPERA_MAXIMA_MS)),
    ]);
    if (!pares) return null;
    return calibrarServico(servico, pares);
  } catch (err) {
    console.error("[motor-aprende] leitura falhou:", String(err).slice(0, 160));
    return null;
  }
}

/** Para o relatório do backoffice. */
export async function relatorioDaAprendizagem(): Promise<CalibracaoDoServico[]> {
  return calibrarTudo(await lerParesParaAprender());
}

/** Só para os testes. */
export function esquecerCache() {
  cache = null;
}
