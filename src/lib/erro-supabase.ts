import { NextResponse } from "next/server";

/**
 * Distingue "a base recusou" de "a base nem sequer está configurada".
 *
 * getSupabaseAdmin() rebenta quando faltam SUPABASE_URL ou
 * SUPABASE_SERVICE_ROLE_KEY. Esse erro caía no catch genérico e saía como
 * "Erro interno." — que manda quem está a operar procurar um problema que
 * não existe, quando o que falta é uma variável de ambiente.
 */
export function respostaDeErroSupabase(contexto: string, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[${contexto}]`, e);

  if (/SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/.test(msg)) {
    return NextResponse.json(
      { error: "A ligação à base da app não está configurada neste ambiente (faltam variáveis SUPABASE_*)." },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "Erro interno." }, { status: 500 });
}
