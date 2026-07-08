import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { deletePushSubscription } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/push/unsubscribe — remove a subscrição Web Push (por endpoint).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const endpoint = body?.endpoint;
  if (!endpoint) return NextResponse.json({ error: "Endpoint em falta." }, { status: 400 });

  try {
    await deletePushSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/push/unsubscribe]", err);
    return NextResponse.json({ error: "Erro ao remover subscrição." }, { status: 500 });
  }
}
