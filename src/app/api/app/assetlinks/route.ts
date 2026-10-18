import { NextResponse } from "next/server";
import { assetLinks } from "@/lib/links-da-app";

/**
 * Servido em /.well-known/assetlinks.json (ver `rewrites` no next.config.ts).
 * O Android lê-o quando a app é instalada, para saber que os links de
 * clyon.pt/profissionais podem abrir a CLYON Pro. Ver `links-da-app.ts`.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(assetLinks(process.env), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
