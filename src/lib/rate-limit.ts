/**
 * Rate limiting com Upstash Redis.
 * Usa uma janela deslizante simples baseada em INCR + EXPIRE por chave.
 * Cada chave tem o formato "rl:<endpoint>:<ip>" e expira após `windowSecs`.
 *
 * Se o Redis não estiver disponível (variáveis de ambiente em falta), há um
 * contador em memória por instância. Não é global, mas é melhor do que não
 * haver limite nenhum — sobretudo nas rotas de login.
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
/**
 * Contador em memória, para quando o Redis não está configurado.
 *
 * Antes disto, sem Redis o limite simplesmente não existia — e é assim que
 * uma página de login fica aberta a tentativas à força bruta sem ninguém dar
 * por nada. Isto não substitui o Redis: em serverless cada instância tem a
 * sua memória, por isso o limite real é por instância e não global. Mas
 * transforma "sem limite nenhum" em "limite parcial", o que num ataque de
 * palavra-passe faz diferença.
 */
const memoria = new Map<string, { count: number; expiraEm: number }>();

function limitarEmMemoria(key: string, limit: number, windowSecs: number): RateLimitResult {
  const agora = Date.now();
  const registo = memoria.get(key);

  if (!registo || registo.expiraEm <= agora) {
    memoria.set(key, { count: 1, expiraEm: agora + windowSecs * 1000 });
    // Limpeza oportunista: sem isto o Map cresce sem fim numa instância
    // de vida longa.
    if (memoria.size > 5000) {
      for (const [k, v] of memoria) if (v.expiraEm <= agora) memoria.delete(k);
    }
    return { allowed: true, count: 1, limit };
  }

  registo.count += 1;
  return { allowed: registo.count <= limit, count: registo.count, limit };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSecs = 60,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) {
    return limitarEmMemoria(key, limit, windowSecs);
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
