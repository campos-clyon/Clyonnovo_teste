import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { procurarFichasNoGoogle } from "@/lib/ficha-no-google";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Por conta do profissional (todas as sessões dele) — cada procura é uma chamada paga ao Google. */
const PROCURAS_POR_HORA = 20;

/**
 * PROCURAR A FICHA NO GOOGLE — 11-11-2026. Só com sessão de profissional:
 * o servidor pergunta ao Google (Text Search da Places API (New), com a chave
 * do servidor) e devolve até 5 fichas — nome, morada e link do Maps. Nada se
 * guarda aqui.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const porConta = await limitarPorConta("ficha-google-procura", `pro:${sessao.providerId}`, PROCURAS_POR_HORA, 3600);
  if (porConta.erro) return porConta.erro;
  const porMaquina = await limitarRotaPublica(req, "ficha-google-procura", PROCURAS_POR_HORA * 2, 3600);
  if (porMaquina.erro) return porMaquina.erro;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const t = (corpo as { texto?: unknown } | null)?.texto;
  const texto = typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (texto.length < 3) return NextResponse.json({ error: "Escreva pelo menos 3 letras do nome." }, { status: 400 });

  const r = await procurarFichasNoGoogle(texto);
  if (!r.ok) {
    console.warn("[ficha-google/procurar]", r.motivo);
    return NextResponse.json({ error: "A procura no Google não está disponível agora. Tente mais tarde." }, { status: 503 });
  }
  return NextResponse.json({ fichas: r.fichas }, { headers: { "Cache-Control": "no-store" } });
}
