import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  appendOrderHistory,
  cancelarPedido,
  getSimulatorOrderById,
  gravarMotivoDoFecho,
  negociacoesDoPedido,
  numeroBloqueadoWhatsApp,
  registarSemFalhar,
} from "@/lib/db";
import { oQueSeDesfaz } from "@/lib/cancelamento";
import { avisarDoCancelamento } from "@/lib/avisar-cancelamento";
import { foraDaZonaDoPedido } from "@/lib/fora-da-zona-na-base";
import {
  MOTIVO_FORA_DA_ZONA,
  canalDaMensagemForaDaZona,
  historicoDoCancelamentoForaDaZona,
  mensagemDoForaDaZona,
} from "@/lib/fora-da-zona";

export const runtime = "nodejs";

/**
 * «CANCELAR E AVISAR O CLIENTE» — d128 (25-11-2026, dono).
 *
 * O pedido marcado «fora da zona» cuja morada a equipa confirmou com o
 * cliente: cancela-se pelo caminho de sempre (`cancelarPedido` → `fimDoPedido`,
 * d94, com a memória para o «Desfazer» e o aviso a cada parceiro envolvido) e
 * sai UMA mensagem ao cliente — o WhatsApp, ou o email sem telemóvel. O motivo
 * fica no pedido («Sem parceiro na zona», nos motivos do fecho) e no histórico,
 * com quem carregou.
 *
 * As guardas: só um pedido que está mesmo fora da zona; nunca um já cancelado
 * (a segunda carga não repete a mensagem); nunca com um parceiro contratado ou
 * dinheiro em jogo — esse cancela-se pela Mesa, com o motivo escrito.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const pedidoId = Number(id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  let corpo: { accao?: unknown };
  try {
    corpo = await req.json();
  } catch {
    corpo = {};
  }
  if (corpo.accao !== "cancelar_e_avisar") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (pedido.status === "cancelado") {
    return NextResponse.json({ error: "Este pedido já está cancelado." }, { status: 409 });
  }
  const fora = await foraDaZonaDoPedido(pedido);
  if (!fora) {
    return NextResponse.json(
      { error: "Este pedido já não está fora da zona — siga pelo caminho normal." },
      { status: 409 },
    );
  }

  const existentes = await negociacoesDoPedido(pedidoId);
  const desfaz = oQueSeDesfaz(existentes);
  if (desfaz.temCompromisso) {
    return NextResponse.json(
      {
        error: `Este pedido está ${desfaz.ponto} com ${desfaz.profissional}. Cancele-o pela Mesa, com o motivo escrito.`,
      },
      { status: 409 },
    );
  }

  const quem = colab?.nome ?? "equipa";
  const by = colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null;
  const motivo = `Fora da zona (${Math.round(fora.km)} km de Lisboa)`;

  try {
    const r = await cancelarPedido(pedidoId, { motivo });
    if (!r) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    // Os parceiros envolvidos ficam a saber; o cliente recebe a mensagem daqui, e só esta.
    await avisarDoCancelamento({ pedidoId, negociacoes: existentes, motivo, porQuem: "clyon", semAvisoAoCliente: true });
    await gravarMotivoDoFecho(pedidoId, "sem_parceiro", null, by).catch((e) =>
      console.error("[fora-da-zona] motivo:", e instanceof Error ? e.message : e),
    );

    const telefone = String(pedido.contactPhone ?? "").trim();
    const bloqueado = telefone ? await numeroBloqueadoWhatsApp(telefone).catch(() => false) : false;
    const canal = canalDaMensagemForaDaZona({ telefone, email: pedido.contactEmail, bloqueado });
    const texto = mensagemDoForaDaZona({
      nome: pedido.contactName,
      pedidoId,
      localidade: pedido.city,
      limite: fora.limite,
    });
    let saiu = false;
    try {
      if (canal === "whatsapp") {
        const { enviarTextoManualWhatsApp } = await import("@/lib/whatsapp-cloud");
        saiu = await enviarTextoManualWhatsApp(telefone, texto);
      } else if (canal === "email") {
        const { avisarClienteForaDaZona } = await import("@/lib/email-proposta");
        saiu = await avisarClienteForaDaZona({ para: String(pedido.contactEmail).trim(), pedidoId, texto });
      }
    } catch (e) {
      console.error("[fora-da-zona] mensagem ao cliente:", e instanceof Error ? e.message : e);
    }

    const linha = historicoDoCancelamentoForaDaZona({ km: fora.km, quem, canal, saiu });
    await appendOrderHistory(pedidoId, { type: "created", by, message: linha }).catch(() => {});
    await registarSemFalhar({
      acontecimento: "pedido_cancelado",
      pedidoId,
      autorTipo: "clyon",
      autorNome: quem,
      valor: pedido.valorDesejadoCliente != null ? Number(pedido.valorDesejadoCliente) : null,
      resumo: `${MOTIVO_FORA_DA_ZONA}: ${linha}`,
    });

    return NextResponse.json({ ok: true, canal, saiu, encerradas: r.encerradas });
  } catch (error) {
    console.error("[api/admin/pedidos/fora-da-zona]", error);
    return NextResponse.json({ error: "Não foi possível cancelar." }, { status: 500 });
  }
}
