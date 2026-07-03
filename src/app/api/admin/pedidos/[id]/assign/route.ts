import { NextRequest, NextResponse } from "next/server";
import { assignSimulatorOrder, getSimulatorOrderById, getActiveAssistants } from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };
  if (!colab.isAdmin) return { err: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), colab: null };
  return { err: null, colab };
}

// POST /api/admin/pedidos/[id]/assign  — { assistenteId: number | null }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json();
  const { assistenteId } = body as { assistenteId?: number | null };

  let assignee: { id: number; nome: string } | null = null;
  if (assistenteId != null) {
    const all = await getActiveAssistants();
    const found = all.find((a) => a.id === Number(assistenteId));
    if (!found) return NextResponse.json({ error: "Assistente não encontrado" }, { status: 404 });
    assignee = { id: found.id, nome: found.nome };
  }

  await assignSimulatorOrder(
    Number(id),
    assignee,
    { id: colab!.id, nome: colab!.nome, role: "admin" }
  );

  const order = await getSimulatorOrderById(Number(id));
  return NextResponse.json({ ok: true, order, assignedToId: assignee?.id ?? null, assignedToName: assignee?.nome ?? null });
}
