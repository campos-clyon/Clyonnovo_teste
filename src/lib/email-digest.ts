/**
 * src/lib/email-digest.ts
 * Email de resumo semanal dos pedidos activos do cliente, via Resend.
 * Enviado pelo cron /api/cron/weekly-digest, respeita notifWeeklyDigest.
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

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", pendente: "Novo", sem_assistente: "Novo", atribuido: "Novo",
  em_analise: "Em análise", precisa_info: "Em análise", estimativa_pronta: "Em análise", presencial_recomendado: "Em análise",
  aprovado: "Aprovado", enviado_cliente: "Aprovado", confirmado: "Confirmado",
  agendado: "Agendado", em_execucao: "Em curso", em_curso: "Em curso",
};

export interface DigestOrder {
  id: number;
  serviceType: string | null;
  status: string;
}

export interface SendWeeklyDigestParams {
  to: string;
  clienteName: string | null;
  orders: DigestOrder[];
}

function buildHtml(p: SendWeeklyDigestParams): string {
  const contaUrl = `${SITE_URL}/conta`;
  const primeiroNome = (p.clienteName ?? "").split(" ")[0] || "Olá";
  const rows = p.orders
    .map((o) => {
      const servico = SERVICE_LABELS[o.serviceType ?? ""] ?? o.serviceType ?? "Serviço";
      const estado = STATUS_LABELS[o.status] ?? o.status;
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #eef2f7;font-size:14px;color:#1a2332;font-weight:600;">${servico}<span style="display:block;font-weight:400;color:#94a3b8;font-size:12px;">Pedido #${o.id}</span></td>
        <td style="padding:12px 0;border-bottom:1px solid #eef2f7;font-size:13px;color:#0077B6;text-align:right;font-weight:600;">${estado}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Resumo semanal — CLYON</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#0077B6;padding:28px 36px;">
            <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">CLYON</p>
            <p style="margin:4px 0 0;color:#90e0ef;font-size:13px;">O seu resumo semanal</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 24px;">
            <p style="margin:0 0 16px;font-size:17px;color:#1a2332;font-weight:600;">Olá, ${primeiroNome}!</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.6;">
              Tem ${p.orders.length} ${p.orders.length === 1 ? "pedido activo" : "pedidos activos"} na CLYON. Aqui está o ponto de situação:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">${rows}</table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${contaUrl}" style="display:inline-block;background:#0077B6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">
                  Ver os meus pedidos
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
              Recebe este resumo porque tem o 'Resumo semanal' activo. Pode desligá-lo na sua conta.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Envia o resumo semanal. Nunca relança erros — falha silenciosa com log. */
export async function sendWeeklyDigestEmail(params: SendWeeklyDigestParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY_clyonsite;
  if (!apiKey) {
    console.warn("[email-digest] RESEND_API_KEY_clyonsite não configurada — email não enviado.");
    return false;
  }
  if (!params.to || !params.to.includes("@") || params.orders.length === 0) return false;

  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from:    "CLYON <noreply@clyon.pt>",
      to:      [params.to],
      subject: `O seu resumo semanal CLYON — ${params.orders.length} ${params.orders.length === 1 ? "pedido activo" : "pedidos activos"}`,
      html:    buildHtml(params),
    });
    if (error) {
      console.error("[email-digest] Resend devolveu erro:", error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[email-digest] Excepção ao enviar:", err?.message ?? err);
    return false;
  }
}
