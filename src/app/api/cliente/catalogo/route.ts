import { NextRequest, NextResponse } from "next/server";
import { catalogoDaApp } from "@/lib/catalogo-da-app";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * R7 — O CATÁLOGO DA APP DE CLIENTE (d8 fase 2, S4, 28-10-2026).
 *
 * Público (o primeiro ecrã da app abre sem sessão) e em cache curta. Não lê
 * sessão nenhuma e não tem preços: ver `catalogo-da-app.ts`.
 */
export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-catalogo", 120, 300);
  if (limite.erro) return limite.erro;
  return NextResponse.json(catalogoDaApp(), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
