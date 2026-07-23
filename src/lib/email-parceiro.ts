/**
 * Notificações por email para parceiros CLYON.
 *
 * Enviadas quando:
 *   - Um pedido é aprovado pelo assistente e fica disponível para a zona do parceiro.
 *   - Um pedido que o parceiro aceitou passa a concluído (recibo).
 */
import { Resend } from "resend";
import { SITE_URL } from "./seo-data";

const SERVICE_LABELS: Record<string, string> = {
  recolha_moveis:           "Recolha de móveis",
  recolha_monos:            "Recolha de monos",
  recolha_entulho:          "Recolha de entulho",
  esvaziamento_casa:        "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca:                  "Mudança",
  outro:                    "Outro serviço",
};

function getResend() {
  const apiKey = process.env.RESEND_API_KEY_clyonsite;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

// ── Novo trabalho disponível ─────────────────────────────────────────────────

export interface NewJobParams {
  to: string;
  providerName: string;
  serviceType: string | null;
  city: string | null;
  precoFinalIva: number | null;
  orderId: number;
}

export async function sendNewJobEmailToProvider(params: NewJobParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email-parceiro] RESEND_API_KEY_clyonsite não configurada — email não enviado.");
    return;
  }

  const servico = SERVICE_LABELS[params.serviceType ?? ""] ?? params.serviceType ?? "Serviço";
  const preco = params.precoFinalIva ? `${Number(params.precoFinalIva).toFixed(2)} €` : "A definir";
  const dashboardUrl = `${SITE_URL}/parceiros/dashboard`;

  const html = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><title>Novo trabalho disponível — CLYON</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0D1117;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0891b2,#0369a1);padding:28px 36px;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">CLYON Parceiros</p>
            <p style="margin:4px 0 0;color:#bae6fd;font-size:13px;">Novo trabalho disponível na tua zona</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="color:#e2e8f0;font-size:16px;margin:0 0 20px;">Olá, <strong>${params.providerName.split(" ")[0]}</strong>!</p>
            <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">
              Um novo trabalho foi aprovado e está disponível para aceitação no teu dashboard.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:28px;">
              <tr>
                <td style="color:#64748b;font-size:12px;padding-bottom:6px;">Serviço</td>
                <td style="color:#e2e8f0;font-size:14px;font-weight:600;padding-bottom:6px;text-align:right;">${servico}</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:12px;padding-bottom:6px;">Zona</td>
                <td style="color:#e2e8f0;font-size:14px;font-weight:600;padding-bottom:6px;text-align:right;">${params.city ?? "Não indicada"}</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:12px;">Valor c/IVA</td>
                <td style="color:#22d3ee;font-size:16px;font-weight:700;text-align:right;">${preco}</td>
              </tr>
            </table>
            <p style="text-align:center;margin:0 0 12px;">
              <a href="${dashboardUrl}"
                style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
                Ver trabalho no dashboard →
              </a>
            </p>
            <p style="color:#475569;font-size:12px;text-align:center;margin:8px 0 0;">
              Aceita rapidamente — o primeiro a aceitar fica com o trabalho.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px 28px;border-top:1px solid #1e293b;">
            <p style="color:#475569;font-size:11px;margin:0;text-align:center;">
              CLYON · Portal de Parceiros · <a href="${dashboardUrl}" style="color:#0891b2;">${dashboardUrl}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from:    "CLYON Parceiros <noreply@clyon.pt>",
      to:      [params.to],
      subject: `🔔 Novo trabalho disponível — ${servico} em ${params.city ?? "Portugal"}`,
      html,
    });
    if (error) console.error("[email-parceiro] Resend erro (novo trabalho):", error);
    else console.log(`[email-parceiro] Notificação enviada para ${params.to} (pedido #${params.orderId})`);
  } catch (err: any) {
    console.error("[email-parceiro] Exceção ao enviar:", err?.message ?? err);
  }
}

// ── Pedido de avaliação (24h após conclusão) ─────────────────────────────────

export interface ReviewRequestParams {
  to: string;
  clienteName: string;
  serviceType: string | null;
  orderId: number;
}

export async function sendReviewRequestEmail(params: ReviewRequestParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const servico = SERVICE_LABELS[params.serviceType ?? ""] ?? params.serviceType ?? "Serviço";
  const contaUrl = `${SITE_URL}/conta`;

  const html = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><title>Como correu? — CLYON</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#0891b2;padding:28px 36px;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">CLYON</p>
            <p style="margin:4px 0 0;color:#bae6fd;font-size:13px;">Como correu o serviço?</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="color:#1e293b;font-size:16px;margin:0 0 16px;">Olá, <strong>${params.clienteName.split(" ")[0]}</strong>!</p>
            <p style="color:#475569;font-size:14px;margin:0 0 24px;line-height:1.6;">
              O teu serviço de <strong>${servico}</strong> foi concluído. Adorávamos saber a tua opinião — a tua avaliação ajuda-nos a manter a qualidade e a escolher os melhores parceiros.
            </p>
            <p style="text-align:center;margin:0 0 24px;">
              <a href="${contaUrl}"
                style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
                Deixar avaliação ★
              </a>
            </p>
            <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
              Obrigado por escolher a CLYON!
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from:    "CLYON <noreply@clyon.pt>",
      to:      [params.to],
      subject: `Como correu o teu ${servico}? Deixa uma avaliação ★`,
      html,
    });
    if (error) console.error("[email-parceiro] Resend erro (avaliação):", error);
  } catch (err: any) {
    console.error("[email-parceiro] Exceção ao enviar avaliação:", err?.message ?? err);
  }
}
