import { NextRequest, NextResponse } from "next/server";
import { limitarPorConta } from "@/lib/limite-rota-publica";
import { lerPrimeiraAbertura } from "@/lib/sinais-da-app-de-cliente";
import { registarPrimeiraAbertura } from "@/lib/sinais-da-app-de-cliente-na-base";

export const runtime = "nodejs";

const MAXIMO_DO_CORPO = 512;

/**
 * A APP DE CLIENTE ABRIU PELA PRIMEIRA VEZ NESTE TELEMÓVEL — 24-11-2026 (d108).
 *
 * Corpo: `{ "versao": "0.1.0 (01a1741b)", "plataforma": "android" }` →
 * `{ ok: true }`. SEM IDENTIFICADOR E SEM SESSÃO (Jurídico, 24-11-2026, Lei
 * 41/2004, art. 5.º): a app manda isto uma vez e guarda só para si que já o
 * mandou. Não se guarda o endereço: o travão é um só para toda a gente (não
 * por endereço), largo o bastante para um dia de instalações. Campos a mais
 * não passam de `lerPrimeiraAbertura`. Sem CORS.
 */
export async function POST(req: NextRequest) {
  // Um travão só para toda a gente (a «conta» é a mesma para todos): nunca o endereço.
  const travao = await limitarPorConta("app-cliente-primeira-abertura", "todos", 500, 3600);
  if (travao.erro) return travao.erro;

  let texto = "";
  try {
    texto = await req.text();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (texto.length > MAXIMO_DO_CORPO) return NextResponse.json({ error: "Pedido inválido." }, { status: 413 });
  let corpo: unknown = {};
  try {
    corpo = texto ? JSON.parse(texto) : {};
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    await registarPrimeiraAbertura(lerPrimeiraAbertura(corpo));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cliente/primeira-abertura]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui guardar." }, { status: 500 });
  }
}
