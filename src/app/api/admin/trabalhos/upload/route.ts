import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";

/**
 * POST /api/admin/trabalhos/upload
 * Temporariamente desativado - Vercel Blob store privada
 */
export async function POST(request: NextRequest) {
  // Sem isto, o armazenamento ficava aberto: qualquer pessoa podia enviar
  // ficheiros para o Blob à custa da conta da CLYON.
  const { err } = await requireAdmin(request);
  if (err) return err;

  return NextResponse.json(
    {
      error: "UPLOAD_DISABLED",
      message: "Upload de fotos temporariamente indisponível.",
    },
    { status: 501 }
  );
}
