/**
 * Rate limiting com Upstash Redis.
 * Usa uma janela deslizante simples baseada em INCR + EXPIRE por chave.
 * Cada chave tem o formato "rl:<endpoint>:<ip>" e expira após `windowSecs`.
 *
 * Se o Redis não estiver disponível (variáveis de ambiente em falta),
 * a função devolve { allowed: true } para não bloquear o serviço.
 */

import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  _redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  return _redis;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Número de pedidos feitos nesta janela */
  count: number;
  /** Limite máximo configurado */
  limit: number;
}

/**
 * Verifica e incrementa o contador de rate limit.
 *
 * @param key       Identificador único — ex: "contact:<ip>" ou "analyze:<ip>"
 * @param limit     Número máximo de pedidos permitidos na janela
 * @param windowSecs Duração da janela em segundos (padrão: 60s)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSecs = 60,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) {
    // Redis não configurado — permitir sempre (fail-open)
    return { allowed: true, count: 0, limit };
  }

  try {
    const redisKey = `rl:${key}`;
    // Pipeline: INCR + EXPIRE numa única chamada de rede
    const results = await redis.pipeline()
      .incr(redisKey)
      .expire(redisKey, windowSecs, "NX") // só define TTL na primeira vez
      .exec();

    const count = (results[0] as number) ?? 1;
    return { allowed: count <= limit, count, limit };
  } catch {
    // Em caso de erro do Redis, falhar de forma aberta
    return { allowed: true, count: 0, limit };
  }
}

/**
 * Extrai o IP do cliente a partir dos headers do Next.js (Vercel-compatible).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
