import { Resend } from "resend";
import { escaparHtml } from "./escapar-html";
import { MINUTOS_DE_VALIDADE } from "./entrada-por-link";

/**
 * O email com o link de entrada.
 *
 * Não diz o nome de ninguém e não conta nada sobre a conta. Se o endereço
 * estiver errado — alguém escreveu mal, alguém escreveu o email de outra
 * pessoa — quem o receber fica a saber apenas que houve um pedido de entrada,
 * e não que existe conta, nem de quem, nem com que pedidos.
 *
 * O link é uma credencial. Vai sozinho, sem nada à volta que valha a pena
 * reencaminhar, e diz em quanto tempo morre.
 */
export async function enviarEmailDeEntrada(params: {
  para: string;
  link: string;
}): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[email-entrada] RESEND_API_KEY_clyonsite em falta — email não enviado.");
    return false;
  }
  if (!params.para || !params.para.includes("@")) return false;

  const link = escaparHtml(params.link);

  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">

        <tr><td style="background:#00B4CC;padding:20px 24px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">CLYON</span>
        </td></tr>

        <tr><td style="padding:28px 24px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0B1929;">Entrar na sua conta</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
            Carregue no botão para entrar. O link dura ${MINUTOS_DE_VALIDADE} minutos e serve uma vez só.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
            <tr><td style="border-radius:12px;background:#00B4CC;">
              <a href="${link}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">
                Entrar na CLYON
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
            Se não foi você a pedir, ignore este email — não há nada a fazer, e
            ninguém entra sem carregar neste botão.
          </p>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:16px 24px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            Não partilhe este email. Quem tiver este link entra na conta.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: params.para,
      subject: "Entrar na CLYON",
      html,
    });
    if (error) {
      console.error("[email-entrada] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-entrada] falha ao enviar:", err);
    return false;
  }
}
