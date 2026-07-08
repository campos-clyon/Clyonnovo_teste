import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getSimulatorOrderById, updateSimulatorOrder, appendOrderHistory } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Avaliação inválida (1 a 5)." }, { status: 400 });
  }
  const comment: string | null = typeof body?.comment === "string" && body.comment.trim() ? body.comment.trim() : null;

  const order = await getSimulatorOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const emailNorm = session.user.email.trim().toLowerCase();
  if ((order.contactEmail ?? "").trim().toLowerCase() !== emailNorm) {
    return NextResponse.json({ error: "Este pedido não pertence à sua conta." }, { status: 403 });
  }

  if (order.status !== "concluido") {
    return NextResponse.json({ error: "Só é possível avaliar pedidos concluídos." }, { status: 400 });
  }

  if (order.clientRating != null) {
    return NextResponse.json({ error: "Este pedido já foi avaliado." }, { status: 409 });
  }

  await updateSimulatorOrder(id, { clientRating: rating, clientRatingComment: comment });
  await appendOrderHistory(id, {
    type: "client_rating",
    by: null,
    message: `Cliente avaliou o serviço com ${rating} estrela(s).${comment ? ` Comentário: "${comment}"` : ""}`,
  });

  return NextResponse.json({ ok: true, rating, comment });
}
