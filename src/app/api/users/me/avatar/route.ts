import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptionsCliente } from "@/auth-cliente";

/**
 * POST /api/users/me/avatar
 * 
 * Temporariamente desativado.
 * Vercel Blob store configurada como privada — não pode usar access: "public".
 * Upload de avatar será reativado quando a store for reconfigurada ou alternative implementado.
 * 
 * Por enquanto, utilizadores veem a foto da conta Google.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptionsCliente);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Endpoint desativado — retornar 501 com mensagem amigável
  return NextResponse.json(
    {
      ok: false,
      error: "AVATAR_UPLOAD_DISABLED",
      message: "Alteração de foto temporariamente indisponível. A foto da tua conta Google continuará a ser usada.",
    },
    { status: 501 }
  );
}
