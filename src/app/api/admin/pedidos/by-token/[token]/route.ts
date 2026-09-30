import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/db";
import { requireAdminGeral } from "@/lib/admin-auth-helper";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Confirmado na base, e não só pela assinatura — ver `conta-do-painel.ts`.
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  return NextResponse.json({ order });
}
