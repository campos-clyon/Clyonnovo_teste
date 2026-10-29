import { NextRequest, NextResponse } from "next/server";
import { sessaoDoCliente } from "@/lib/cliente-auth";
import { getPool, getSimulatorOrderById } from "@/lib/db";
import { responderAClyon } from "@/lib/conversa-com-a-clyon";
import { historicoParaOCliente } from "@/lib/historico-para-o-cliente";

export const runtime = "nodejs";

/**
 * POST /api/users/me/orders/[id]/reply
 * Body: { message: string }
 *
 * Cliente autenticado responde a um pedido de informação da assistente.
 * A resposta é anexada ao historyJson com type="client_reply" e mostrada
 * ao assistente no backoffice.
 *
 * Grava pela mesma função da R14 da app (`responderAClyon`, S18, 29-10-2026).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessaoDoCliente(req);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const message = String(body?.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Mensagem obrigatória." }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Mensagem demasiado longa." }, { status: 400 });

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "DB indisponível." }, { status: 500 });

  // Validar propriedade do pedido pelo email do cliente
  const [rows] = await pool.execute(
    `SELECT id, (valorFixoClyon IS NOT NULL) AS trabalhoClyon
       FROM simulatorOrders WHERE id = ? AND LOWER(TRIM(contactEmail)) = ? LIMIT 1`,
    [orderId, email.trim().toLowerCase()]
  ) as any[];
  if (!(rows as any[])[0]) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const r = await responderAClyon(orderId, { nome: session!.user!.name ?? email }, { mensagem: message });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  /*
   * Devolvia o `historyJson` inteiro, com as notas da equipa, a quem acabava
   * de responder. Agora só a lista fechada, como a lista da conta (d33,
   * 26-10-2026) — ver `historico-para-o-cliente.ts`.
   */
  const updated = await getSimulatorOrderById(orderId);
  return NextResponse.json({
    ok: true,
    historyJson: historicoParaOCliente((updated as any)?.historyJson ?? null, {
      trabalhoClyon: (rows as any[])[0]?.trabalhoClyon,
    }),
  });
}
