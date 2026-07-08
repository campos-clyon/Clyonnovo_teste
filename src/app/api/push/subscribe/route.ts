import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { savePushSubscription } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/push/subscribe — guarda a subscrição Web Push do cliente autenticado.
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

  const sub = body?.subscription ?? body;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Subscrição incompleta." }, { status: 400 });
  }

  try {
    await savePushSubscription(session.user.email, { endpoint, p256dh, auth });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/push/subscribe]", err);
    return NextResponse.json({ error: "Erro ao guardar subscrição." }, { status: 500 });
  }
}
