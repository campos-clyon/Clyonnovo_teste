import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/simulador/upload-fotos
 * Temporariamente desativado - Vercel Blob store privada
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "UPLOAD_DISABLED",
      message: "Upload de fotos temporariamente indisponível.",
    },
    { status: 501 }
  );
}
