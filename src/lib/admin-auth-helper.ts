import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export type AdminColab = {
  id: number;
  nome: string;
  isAdmin: number;
  funcao?: string;
};

type AuthResult =
  | { err: NextResponse; colab: null }
  | { err: null; colab: AdminColab };

export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const colab = await verifyColaboradorAuthHeader(
    req.headers.get("authorization"),
  );
  if (!colab)
    return {
      err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }),
      colab: null,
    };
  if (!colab.isAdmin)
    return {
      err: NextResponse.json({ error: "Acesso negado" }, { status: 403 }),
      colab: null,
    };
  return { err: null, colab: colab as AdminColab };
}
