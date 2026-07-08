/**
 * src/lib/email-status.ts
 * Envia email ao cliente quando o estado do pedido muda, via Resend.
 * Respeita a preferência notifOrderStatus do utilizador (ver updateSimulatorOrder).
 */

import { Resend } from "resend";
import { SITE_URL, BUSINESS_PHONE } from "./seo-data";

const SERVICE_LABELS: Record<string, string> = {
  recolha_moveis:           "Recolha de móveis",
  recolha_monos:            "Recolha de monos",
  recolha_entulho:          "Recolha de entulho",
  esvaziamento_casa:        "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca:                  "Mudança",
  montagem_moveis:          "Montagem de móveis",
  jardinagem:               "Jardinagem",
  manutencao_casa:          "Manutenção da casa",
  outro:                    "Serviço",
};

// Só estes estados geram email — os internos do backoffice (sem_assistente,
// atribuido, pendente…) são ruído para o cliente e não disparam nada.
const STATUS_MESSAGES: Record<string, { title: string; body: string; color: string }> = {
  em_analise:  { title: "Pedido em análise",   body: "A nossa equipa está a analisar o seu pedido e confirma os detalhes consigo em breve.", color: "#d97706" },
  aprovado:    { title: "Orçamento aprovado",  body: "O orçamento do seu pedido foi aprovado. Vamos avançar com o agendamento.",             color: "#0891b2" },
  confirmado:  { title: "Serviço confirmado",  body: "O seu serviço está confirmado. Entraremos em contacto para os detalhes finais.",       color: "#059669" },
  agendado:    { title: "Serviço agendado",    body: "O seu serviço foi agendado. Pode consultar a data na sua conta CLYON.",                color: "#7c3aed" },
  em_execucao: { title: "Serviço em curso",    body: "A nossa equipa está a tratar do seu serviço.",                                          color: "#ea580c" },
  em_curso:    { title: "Serviço em curso",    body: "A nossa equipa está a tratar do seu serviço.",                                          color: "#ea580c" },
  concluido:   { title: "Serviço concluído",   body: "O seu serviço foi concluído. Obrigado por escolher a CLYON! Pode avaliar na sua conta.", color: "#16a34a" },
  cancelado:   { title: "Pedido cancelado",    body: "O seu pedido foi cancelado. Se tiver dúvidas, fale connosco.",                          color: "#64748b" },
  rejeitado:   { title: "Pedido cancelado",    body: "O seu pedido foi cancelado. Se tiver dúvidas, fale connosco.",                          color: "#64748b" },
};

/** Indica se uma mudança para este estado deve gerar email ao cliente. */
export function statusTriggersEmail(status: string): boolean {
  return status in STATUS_MESSAGES;
}

/** Título/corto para notificação push, derivado das mesmas mensagens. */
export const STATUS_PUSH: Record<string, { title: string; body: string }> = Object.fromEntries(
  Object.entries(STATUS_MESSAGES).map(([k, v]) => [k, { title: `CLYON — ${v.title}`, body: v.body }]),
);

export interface SendStatusEmailParams {
  to: string;
  clienteName: string | null;
  serviceType: string | null;
  orderId: number;
  status: string;
}

function buildHtml(p: SendStatusEmailParams): string {
  const msg = STATUS_MESSAGES[p.status];
  const servico = SERVICE_LABELS[p.serviceType ?? ""] ?? p.serviceType ?? "Serviço";
  const contaUrl = `${SITE_URL}/conta`;
  const primeiroNome = (p.clienteName ?? "").split(" ")[0] || "Olá";

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${msg.title} — CLYON</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#0077B6;padding:28px 36px;">
            <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">CLYON</p>
            <p style="margin:4px 0 0;color:#90e0ef;font-size:13px;">Recolha · Mudança · Esvaziamento</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 24px;">
            <span style="display:inline-block;background:${msg.color}1a;color:${msg.color};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:6px 12px;border-radius:999px;margin-bottom:16px;">
              ${msg.title}
            </span>
            <p style="margin:0 0 16px;font-size:17px;color:#1a2332;font-weight:600;">Olá, ${primeiroNome}!</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.6;">${msg.body}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border-radius:10px;border:1px solid #e0f0fb;margin-bottom:28px;">
              <tr><td style="padding:18px 24px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#0077B6;">Pedido #${p.orderId}</p>
                <p style="margin:0;font-size:15px;color:#1a2332;font-weight:600;">${servico}</p>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${contaUrl}" style="display:inline-block;background:#0077B6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">
                  Ver o meu pedido
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f7fa;padding:20px 36px;border-top:1px solid #e8ecf0;">
            <p style="margin:0;font-size:12px;color:#a0aec0;text-align:center;">
              CLYON &mdash; Seixal, Portugal &nbsp;|&nbsp;
              <a href="tel:${BUSINESS_PHONE}" style="color:#a0aec0;">${BUSINESS_PHONE}</a>
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:#cbd5e0;text-align:center;">
              Recebe este email porque tem as notificações de estado activas. Pode desligá-las na sua conta.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Envia email de mudança de estado ao cliente. Nunca relança erros — falha
 * silenciosa com log, para nunca bloquear a atualização do pedido.
 */
export async function sendOrderStatusEmail(params: SendStatusEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY_clyonsite;
  if (!apiKey) {
    console.warn("[email-status] RESEND_API_KEY_clyonsite não configurada — email não enviado.");
    return;
  }
  if (!params.to || !params.to.includes("@")) return;
  const msg = STATUS_MESSAGES[params.status];
  if (!msg) return;

  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from:    "CLYON <noreply@clyon.pt>",
      to:      [params.to],
      subject: `${msg.title} — Pedido #${params.orderId} | CLYON`,
      html:    buildHtml(params),
    });
    if (error) console.error("[email-status] Resend devolveu erro:", error);
    else console.log("[email-status] Email enviado para", params.to, "pedido#", params.orderId, "estado:", params.status);
  } catch (err: any) {
    console.error("[email-status] Excepção ao enviar:", err?.message ?? err);
  }
}
