import { createHash, timingSafeEqual } from "node:crypto";

/**
 * DOIS SEGREDOS SÃO IGUAIS? Sem dizer pelo tempo quanto do segredo acertou.
 *
 * `a !== b` desiste no primeiro carácter diferente, e a diferença de tempo
 * entre "falhou no primeiro" e "falhou no décimo" chega para adivinhar um
 * segredo carácter a carácter. Os crons comparavam assim o CRON_SECRET — e
 * são endereços públicos que apagam pedidos, creditam carteiras e mandam
 * mensagens a clientes.
 *
 * Os dois lados passam primeiro por SHA-256: ficam com o mesmo comprimento
 * (o `timingSafeEqual` rebenta com comprimentos diferentes) e o comprimento
 * do segredo também deixa de se medir. A ponte do WhatsApp faz o mesmo à
 * mão, em /api/whatsapp/ponte.
 *
 * Usa `node:crypto`: só para rotas em Node, nunca para o middleware (edge),
 * que tem o `comparaSemFuga` de acesso-mvp.ts.
 */
export function segredoIgual(
  recebido: string | null | undefined,
  esperado: string | null | undefined,
): boolean {
  if (typeof recebido !== "string" || typeof esperado !== "string" || !esperado) return false;
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

/** O cabeçalho Authorization traz `Bearer <segredo>`, e é o certo? */
export function bearerConfere(
  autorizacao: string | null | undefined,
  segredo: string | null | undefined,
): boolean {
  if (typeof autorizacao !== "string" || !autorizacao.startsWith("Bearer ")) return false;
  return segredoIgual(autorizacao.slice("Bearer ".length), segredo);
}
