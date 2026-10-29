import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  appendOrderHistory,
  aprovarJuncaoAConta,
  desligarDaConta,
  getSimulatorOrderById,
  recusarJuncaoAConta,
} from "@/lib/db";
import { mascararEmail } from "@/lib/mascarar-email";
import { avisarContactoDoPedido } from "@/lib/avisar-contacto-do-pedido";

export const runtime = "nodejs";

/**
 * A CONTA DE UM PEDIDO, NA MESA — 29-10-2026 (Segurança, R13).
 *
 * `{ accao: "aprovar" | "recusar" | "desligar" }`.
 *   · aprovar  — o email que pediu a junção pela app passa a ser o do pedido;
 *   · recusar  — o pedido de junção cai, e o pedido continua sem conta;
 *   · desligar — um pedido ligado a uma conta pela app volta a não ter email.
 * Cada uma fica no histórico, e o contacto do pedido é avisado na aprovação.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  let corpo: { accao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const accao = corpo?.accao;
  if (accao !== "aprovar" && accao !== "recusar" && accao !== "desligar") {
    return NextResponse.json({ error: "Acção inválida." }, { status: 400 });
  }
  const pedido = await getSimulatorOrderById(id);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  const by = { id: colab.id, nome: colab.nome, role: colab.papel };

  if (accao === "aprovar") {
    const email = await aprovarJuncaoAConta(id);
    if (!email) return NextResponse.json({ error: "Já não há nenhum pedido de junção à espera." }, { status: 409 });
    await appendOrderHistory(id, { type: "created", by, message: `Pedido juntado à conta ${mascararEmail(email)} (confirmado na Mesa).` });
    await avisarContactoDoPedido(
      { id, contactPhone: pedido.contactPhone },
      `O pedido #${id} ficou ligado à conta ${mascararEmail(email)} na app da CLYON. Não reconhece este pedido? Responda a esta mensagem.`,
    );
  } else if (accao === "recusar") {
    if (!(await recusarJuncaoAConta(id))) {
      return NextResponse.json({ error: "Já não há nenhum pedido de junção à espera." }, { status: 409 });
    }
    await appendOrderHistory(id, { type: "created", by, message: "Pedido de junção à conta recusado na Mesa." });
  } else {
    const email = await desligarDaConta(id);
    if (!email) {
      return NextResponse.json({ error: "Este pedido não foi ligado a uma conta pela app." }, { status: 409 });
    }
    await appendOrderHistory(id, { type: "created", by, message: `Pedido desligado da conta ${mascararEmail(email)} na Mesa.` });
  }
  return NextResponse.json({ ok: true, order: await getSimulatorOrderById(id) });
}
