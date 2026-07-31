/**
 * Email de pedido de avaliação ao cliente, depois do trabalho concluído.
 *
 * Este ficheiro chamava-se email-parceiro.ts e tinha também o aviso de
 * trabalho novo para os parceiros, com link para /parceiros/dashboard. O
 * portal dos parceiros foi descontinuado; o que restou não tem nada a ver
 * com parceiros, e o nome antigo só ia enganar quem viesse a seguir.
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
