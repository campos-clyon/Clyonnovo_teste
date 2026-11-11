import { NextResponse } from "next/server";
import { precoPublicoDasMudancas } from "@/lib/ler-preco-publico-das-mudancas";

export const runtime = "nodejs";
/** A mesma cache de 1 h do preço público. */
export const revalidate = 3600;

/**
 * O PREÇO PÚBLICO DAS MUDANÇAS — 11-11-2026.
 *
 * Público, sem dados de ninguém: só o «desde» (o preço por hora mais baixo
 * com 2 pessoas entre os parceiros da lista, como o cliente o paga), ou
 * `{ tipo: "referencia" }`. Quantos parceiros há não sai daqui. O simulador lê-o para a
 * estimativa e a cabeça da tabela dizerem o mesmo que as páginas.
 */
export async function GET() {
  const preco = await precoPublicoDasMudancas();
  const corpo =
    preco.tipo === "parceiros"
      ? { tipo: preco.tipo, desde: preco.desde, ...(preco.desde3 ? { desde3: preco.desde3 } : {}) }
      : { tipo: preco.tipo };
  return NextResponse.json(corpo, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } });
}
