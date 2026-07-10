/**
 * src/lib/whatsapp.ts
 * Integração com a WhatsApp Business Cloud API (Meta).
 *
 * Variáveis de ambiente necessárias:
 *   WHATSAPP_TOKEN           — Bearer token (System User Token) gerado no
 *                              Meta Business Suite → System Users → Generate Token
 *   WHATSAPP_PHONE_NUMBER_ID — ID do número de telefone registado no painel
 *                              Meta for Developers → WhatsApp → API Setup
 *   WHATSAPP_TO_NUMBER       — Número da empresa que recebe as notificações,
 *                              formato internacional sem '+' (ex: 351931632622)
 *
 * Se qualquer variável estiver em falta, a função retorna silenciosamente sem
 * erro para não bloquear o fluxo principal.
 */

export interface WhatsAppTextMessage {
  to: string;
  text: string;
}

/**
 * Envia uma mensagem de texto simples via WhatsApp Business Cloud API.
 * Falhas são registadas no console mas nunca relançadas — chamada é
 * sempre "fire and forget" para não bloquear o fluxo principal.
 */
export async function sendWhatsAppMessage(message: WhatsAppTextMessage): Promise<void> {
  const token        = process.env.WHATSAPP_TOKEN;
  const phoneNumId   = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumId) {
    console.warn("[whatsapp] WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados — notificação ignorada.");
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type:    "individual",
        to:                message.to,
        type:              "text",
        text: { body: message.text, preview_url: false },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[whatsapp] Erro ao enviar mensagem:", res.status, body);
    } else {
      console.log("[whatsapp] Mensagem enviada para", message.to);
    }
  } catch (err: any) {
    console.error("[whatsapp] Excepção ao enviar mensagem:", err?.message ?? err);
  }
}

/**
 * Envia notificação WhatsApp para a equipa CLYON quando um novo pedido
 * é criado no simulador.
 * Assíncrono e não-bloqueante — erros não são relançados.
 */
export function notifyNewOrder(params: {
  id: number;
  contactName: string | null;
  serviceType: string | null;
  city: string | null;
  address: string | null;
  estimateWithVat: string | null;
  backofficeUrl: string;
}): void {
  const to = process.env.WHATSAPP_TO_NUMBER;
  if (!to) {
    console.warn("[whatsapp] WHATSAPP_TO_NUMBER não configurado — notificação ignorada.");
    return;
  }

  const servicoMap: Record<string, string> = {
    recolha_moveis:            "Recolha de móveis",
    recolha_monos:             "Recolha de monos",
    recolha_entulho:           "Recolha de entulho",
    esvaziamento_casa:         "Esvaziamento de casa",
    esvaziamento_apartamento:  "Esvaziamento de apartamento",
    mudanca:                   "Mudança",
    outro:                     "Outro",
  };

  const servico   = servicoMap[params.serviceType ?? ""] ?? params.serviceType ?? "Não especificado";
  const cliente   = params.contactName || "Não informado";
  const local     = params.city || (params.address ? params.address.split(",")[0] : "Não informado");
  const preco     = params.estimateWithVat
    ? `≈ ${Number(params.estimateWithVat).toFixed(2)} € c/IVA`
    : "Em análise";

  const text = [
    `*Novo pedido CLYON #${params.id}*`,
    ``,
    `Cliente: ${cliente}`,
    `Serviço: ${servico}`,
    `Local: ${local}`,
    `Estimativa: ${preco}`,
    ``,
    `Ver no backoffice:`,
    params.backofficeUrl,
  ].join("\n");

  // Fire and forget — não awaitar para não bloquear a resposta ao cliente
  sendWhatsAppMessage({ to, text }).catch(() => {});
}
