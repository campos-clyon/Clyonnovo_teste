/**
 * src/lib/email-orcamento.ts
 * Envia email de orçamento ao cliente via Resend após aprovação do pedido.
 * Inclui link para página personalizada clyon.pt/orcamento/[token].
 */

import { Resend } from "resend";
import { SITE_URL, BUSINESS_PHONE } from "./seo-data";

const SERVICE_LABELS: Record<string, string> = {
  recolha_moveis:            "Recolha de móveis",
  recolha_monos:             "Recolha de monos",
  recolha_entulho:           "Recolha de entulho",
  esvaziamento_casa:         "Esvaziamento de casa",
  esvaziamento_apartamento:  "Esvaziamento de apartamento",
  mudanca:                   "Mudança",
  outro:                     "Outro serviço",
};

export interface SendOrcamentoEmailParams {
  to: string;
  clienteName: string;
  serviceType: string | null;
  address: string | null;
  description: string | null;
  precoFinalIva: number;
  dataAgendada: string | null;   // ISO date string or null
  token: string;
  orderId: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "A definir";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function buildHtml(p: SendOrcamentoEmailParams): string {
  const confirmarUrl = `${SITE_URL}/orcamento/${p.token}?action=confirmar`;
  const cancelarUrl  = `${SITE_URL}/orcamento/${p.token}?action=cancelar`;
  const pageUrl      = `${SITE_URL}/orcamento/${p.token}`;
  const servico      = SERVICE_LABELS[p.serviceType ?? ""] ?? p.serviceType ?? "Serviço";
  const data         = formatDate(p.dataAgendada);
  const preco        = p.precoFinalIva.toFixed(2).replace(".", ",") + " €";

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>O seu orçamento CLYON</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#0077B6;padding:28px 36px;">
            <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">CLYON</p>
            <p style="margin:4px 0 0;color:#90e0ef;font-size:13px;">Recolha · Mudança · Esvaziamento</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 24px;">
            <p style="margin:0 0 16px;font-size:17px;color:#1a2332;font-weight:600;">
              Olá, ${p.clienteName.split(" ")[0]}!
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.6;">
              Analisámos o seu pedido e preparámos um orçamento personalizado. Consulte os detalhes abaixo e confirme ou cancele a sua reserva.
            </p>

            <!-- Resumo -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f0f9ff;border-radius:10px;border:1px solid #e0f0fb;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#0077B6;">
                    Resumo do pedido #${p.orderId}
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:5px 0;font-size:14px;color:#4a5568;width:40%;">Serviço</td>
                      <td style="padding:5px 0;font-size:14px;color:#1a2332;font-weight:600;">${servico}</td>
                    </tr>
                    ${p.address ? `<tr>
                      <td style="padding:5px 0;font-size:14px;color:#4a5568;">Morada</td>
                      <td style="padding:5px 0;font-size:14px;color:#1a2332;">${p.address}</td>
                    </tr>` : ""}
                    ${p.description ? `<tr>
                      <td style="padding:5px 0;font-size:14px;color:#4a5568;vertical-align:top;">Descrição</td>
                      <td style="padding:5px 0;font-size:14px;color:#1a2332;">${p.description}</td>
                    </tr>` : ""}
                    <tr>
                      <td style="padding:5px 0;font-size:14px;color:#4a5568;">Data</td>
                      <td style="padding:5px 0;font-size:14px;color:#1a2332;">${data}</td>
                    </tr>
                  </table>
                  <!-- Preço destaque -->
                  <div style="margin-top:20px;padding-top:16px;border-top:1px solid #cce7f5;">
                    <p style="margin:0;font-size:12px;color:#0077B6;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">
                      Valor total (c/ IVA)
                    </p>
                    <p style="margin:4px 0 0;font-size:30px;font-weight:700;color:#00B4D8;">
                      ${preco}
                    </p>
                  </div>
                </td>
              </tr>
            </table>

            <!-- CTA buttons -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <a href="${confirmarUrl}"
                    style="display:inline-block;background:#06D6A0;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 36px;border-radius:8px;letter-spacing:0.02em;">
                    Confirmar orçamento
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <a href="${cancelarUrl}"
                    style="display:inline-block;background:#ffffff;color:#e53e3e;text-decoration:none;font-size:14px;font-weight:600;padding:10px 28px;border-radius:8px;border:1.5px solid #e53e3e;">
                    Cancelar pedido
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#718096;text-align:center;">
              Ou aceda à página do seu orçamento:
              <a href="${pageUrl}" style="color:#0077B6;">${pageUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f7fa;padding:20px 36px;border-top:1px solid #e8ecf0;">
            <p style="margin:0;font-size:12px;color:#a0aec0;text-align:center;">
              CLYON &mdash; Seixal, Portugal &nbsp;|&nbsp;
              <a href="tel:${BUSINESS_PHONE}" style="color:#a0aec0;">${BUSINESS_PHONE}</a>
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:#cbd5e0;text-align:center;">
              Este email foi enviado automaticamente. Por favor não responda directamente.
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
 * Envia email de orçamento ao cliente via Resend.
 * Não relança erros — falha silenciosa com log no console.
 */
export async function sendOrcamentoEmail(params: SendOrcamentoEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY_clyonsite;
  if (!apiKey) {
    console.warn("[email-orcamento] RESEND_API_KEY_clyonsite não configurada — email não enviado.");
    return;
  }
  if (!params.to || !params.to.includes("@")) {
    console.warn("[email-orcamento] Email do cliente inválido ou em falta:", params.to);
    return;
  }

  const resend = new Resend(apiKey);
  const servico = SERVICE_LABELS[params.serviceType ?? ""] ?? params.serviceType ?? "Serviço";

  try {
    const { error } = await resend.emails.send({
      from:    "CLYON <noreply@clyon.pt>",
      to:      [params.to],
      subject: `O seu orçamento CLYON — ${servico}`,
      html:    buildHtml(params),
    });
    if (error) {
      console.error("[email-orcamento] Resend devolveu erro:", error);
    } else {
      console.log("[email-orcamento] Email enviado para", params.to, "pedido#", params.orderId);
    }
  } catch (err: any) {
    console.error("[email-orcamento] Excepção ao enviar:", err?.message ?? err);
  }
}
