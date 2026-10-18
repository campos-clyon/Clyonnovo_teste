import { NextResponse } from "next/server";
import { associacaoDaApple } from "@/lib/links-da-app";

/**
 * Servido em /.well-known/apple-app-site-association (ver `rewrites` no
 * next.config.ts). O iPhone lê-o para abrir os links de clyon.pt/profissionais
 * na CLYON Pro e para lhe oferecer as palavras-passe guardadas do site.
 * Tem de ir como JSON e sem redireccionamentos. Ver `links-da-app.ts`.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(associacaoDaApple(process.env), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
