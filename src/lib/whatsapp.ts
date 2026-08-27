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
 * Opcional, mas é o que faz a diferença em produção:
 *   WHATSAPP_TEMPLATE_NOVO_PEDIDO  — Nome de um template aprovado pela Meta.
 *   WHATSAPP_TEMPLATE_LINGUA       — Código de língua do template (ex: pt_PT).
 *
 * Se qualquer variável obrigatória estiver em falta, a função retorna
 * silenciosamente sem erro para não bloquear o fluxo principal.
 */

/** Língua assumida quando `WHATSAPP_TEMPLATE_LINGUA` não está definida. */
const LINGUA_POR_OMISSAO = "pt_PT";

export interface WhatsAppTextMessage {
  to: string;
  text: string;
}

export interface WhatsAppTemplateMessage {
  to: string;
  /** Nome do template tal como foi aprovado no WhatsApp Manager. */
  template: string;
  /** Valores que preenchem o {{1}}, {{2}}, ... do corpo, por ordem. */
  parametros?: string[];
  /** Sobrepõe a língua configurada, para um template específico. */
  lingua?: string;
}

/** Endereço do endpoint de mensagens para o número registado. */
function urlDeEnvio(phoneNumId: string): string {
  return `https://graph.facebook.com/v20.0/${phoneNumId}/messages`;
}

/** Credenciais, ou `null` se a integração não estiver configurada. */
function credenciais(): { token: string; phoneNumId: string } | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumId) {
    console.warn("[whatsapp] WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados — notificação ignorada.");
    return null;
  }
  return { token, phoneNumId };
}

/**
 * Faz o POST à Graph API e regista o resultado.
 *
 * Nunca relança: uma notificação que falha não pode derrubar o pedido do
 * cliente, que é o que realmente importa nesta altura do fluxo.
 */
async function enviar(corpo: Record<string, unknown>, destinatario: string): Promise<void> {
  const cred = credenciais();
  if (!cred) return;

  try {
    const res = await fetch(urlDeEnvio(cred.phoneNumId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cred.token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: destinatario,
        ...corpo,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[whatsapp] Erro ao enviar mensagem:", res.status, body);
    } else {
      console.log("[whatsapp] Mensagem enviada para", destinatario);
    }
  } catch (err: any) {
    console.error("[whatsapp] Excepção ao enviar mensagem:", err?.message ?? err);
  }
}

/**
 * Envia uma mensagem de texto simples.
 *
 * ⚠️ A Meta só entrega texto livre dentro das 24 h seguintes à última mensagem
 * que o destinatário nos enviou. Fora dessa janela o envio falha com o erro
 * 131047 — e, como aqui nada é relançado, falha em silêncio. Para notificações
 * que têm mesmo de chegar, use `sendWhatsAppTemplate`.
 */
export async function sendWhatsAppMessage(message: WhatsAppTextMessage): Promise<void> {
  await enviar(
    { type: "text", text: { body: message.text, preview_url: false } },
    message.to,
  );
}

/**
 * Envia um template aprovado pela Meta.
 *
 * É o único tipo de mensagem que atravessa a janela das 24 h, por isso é o que
 * serve para avisar a equipa de um pedido novo às três da manhã.
 */
export async function sendWhatsAppTemplate(message: WhatsAppTemplateMessage): Promise<void> {
  const componentes = message.parametros?.length
    ? [
        {
          type: "body",
          parameters: message.parametros.map((text) => ({ type: "text", text })),
        },
      ]
    : undefined;

  await enviar(
    {
      type: "template",
      template: {
        name: message.template,
        language: {
          code: message.lingua ?? process.env.WHATSAPP_TEMPLATE_LINGUA ?? LINGUA_POR_OMISSAO,
        },
        ...(componentes ? { components: componentes } : {}),
      },
    },
    message.to,
  );
}

export interface NovoPedido {
  id: number;
  contactName: string | null;
  serviceType: string | null;
  city: string | null;
  address: string | null;
  estimateWithVat: string | null;
  backofficeUrl: string;
}

const NOMES_DE_SERVICO: Record<string, string> = {
  recolha_moveis: "Recolha de móveis",
  recolha_monos: "Recolha de monos",
  recolha_entulho: "Recolha de entulho",
  esvaziamento_casa: "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca: "Mudança",
  outro: "Outro",
};

/**
 * Os cinco campos que descrevem um pedido, na ordem em que entram tanto no
 * texto livre como nos {{1}}..{{5}} do template. Uma só fonte para os dois
 * caminhos — senão o template aprovado e a mensagem de fallback divergem sem
 * ninguém dar por isso.
 */
export function camposDoPedido(pedido: NovoPedido): string[] {
  const servico =
    NOMES_DE_SERVICO[pedido.serviceType ?? ""] ?? pedido.serviceType ?? "Não especificado";
  const local =
    pedido.city || (pedido.address ? pedido.address.split(",")[0] : "") || "Não informado";
  const preco = pedido.estimateWithVat
    ? `≈ ${Number(pedido.estimateWithVat).toFixed(2)} € c/IVA`
    : "Em análise";

  return [
    String(pedido.id),
    pedido.contactName || "Não informado",
    servico,
    local,
    preco,
  ];
}

/** A mensagem de texto livre, usada quando não há template configurado. */
export function textoDoPedido(pedido: NovoPedido): string {
  const [id, cliente, servico, local, preco] = camposDoPedido(pedido);

  return [
    `*Novo pedido CLYON #${id}*`,
    ``,
    `Cliente: ${cliente}`,
    `Serviço: ${servico}`,
    `Local: ${local}`,
    `Estimativa: ${preco}`,
    ``,
    `Ver no backoffice:`,
    pedido.backofficeUrl,
  ].join("\n");
}

/**
 * Avisa a equipa CLYON de que entrou um pedido novo.
 *
 * Usa o template aprovado quando `WHATSAPP_TEMPLATE_NOVO_PEDIDO` está definido
 * — é o que garante entrega a qualquer hora. Sem ele, cai no texto livre, que
 * só chega se alguém da equipa tiver escrito ao número da API nas últimas 24 h.
 *
 * Assíncrono e não-bloqueante: erros não são relançados.
 */
export function notifyNewOrder(pedido: NovoPedido): void {
  const to = process.env.WHATSAPP_TO_NUMBER;
  if (!to) {
    console.warn("[whatsapp] WHATSAPP_TO_NUMBER não configurado — notificação ignorada.");
    return;
  }

  const template = process.env.WHATSAPP_TEMPLATE_NOVO_PEDIDO;

  // Fire and forget — não awaitar para não bloquear a resposta ao cliente
  const envio = template
    ? sendWhatsAppTemplate({ to, template, parametros: camposDoPedido(pedido) })
    : sendWhatsAppMessage({ to, text: textoDoPedido(pedido) });

  envio.catch(() => {});
}
