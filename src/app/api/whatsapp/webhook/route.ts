import { NextRequest, NextResponse } from "next/server";
import { registarMensagemWhatsApp } from "@/lib/db";
import { assinaturaValida, whatsappConfigurado } from "@/lib/whatsapp-cloud";
import { tratarFotoDoCliente, tratarMensagemDoCliente } from "@/lib/whatsapp-negociacao";

export const runtime = "nodejs";

/**
 * O webhook do WhatsApp — por onde as respostas dos clientes entram.
 *
 * GET é o aperto de mão da Meta ao configurar (devolve o hub.challenge se o
 * verify_token bater); POST são as mensagens. Cada POST vem assinado com
 * HMAC-SHA256 do corpo cru — SEM assinatura válida, 401 e nada acontece:
 * um webhook aberto deixava qualquer pessoa que descobrisse o endereço
 * "responder" pelos clientes e fechar negociações alheias.
 *
 * Responde-se 200 depressa e sempre que a assinatura confere, mesmo que a
 * mensagem não se perceba — a Meta reenvia tudo o que não for 200, e um
 * erro nosso num caso raro viraria uma tempestade de retentativas.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN &&
    process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  if (!whatsappConfigurado()) {
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }

  const corpoCru = await req.text();
  if (!assinaturaValida(corpoCru, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  try {
    const corpo = JSON.parse(corpoCru) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              from?: string;
              type?: string;
              text?: { body?: string };
              interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
              image?: { id?: string; mime_type?: string };
            }>;
          };
        }>;
      }>;
    };

    for (const entry of corpo.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          if (!msg.from) continue;
          if (msg.type === "interactive" && msg.interactive?.button_reply?.id) {
            // O registo guarda o TÍTULO ("Fechar 300 €"), não o id — a
            // conversa no painel tem de se ler como uma conversa.
            await registarMensagemWhatsApp(
              msg.from,
              "in",
              `[carregou: ${msg.interactive.button_reply.title ?? msg.interactive.button_reply.id}]`,
            ).catch(() => {});
            await tratarMensagemDoCliente(msg.from, {
              tipo: "botao",
              id: msg.interactive.button_reply.id,
            });
          } else if (msg.type === "text" && msg.text?.body) {
            await registarMensagemWhatsApp(msg.from, "in", msg.text.body).catch(() => {});
            await tratarMensagemDoCliente(msg.from, { tipo: "texto", texto: msg.text.body });
          } else if (msg.type === "image" && msg.image?.id) {
            await registarMensagemWhatsApp(msg.from, "in", "[fotografia]").catch(() => {});
            await tratarFotoDoCliente(msg.from, msg.image.id, msg.image.mime_type ?? null);
          }
          // Estados de entrega, reacções, outros media: ignoram-se em silêncio.
        }
      }
    }
  } catch (e) {
    // Já validámos a assinatura: o corpo é da Meta. Um formato inesperado
    // regista-se e responde-se 200 na mesma — reenviar não o vai consertar.
    console.error("[whatsapp/webhook]", e);
  }

  return NextResponse.json({ ok: true });
}
