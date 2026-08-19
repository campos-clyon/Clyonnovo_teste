import { Resend } from "resend";
import { e } from "./escapar-html";
import { urlDeAccao } from "./url-do-site";
import { comChave } from "./acesso-mvp";

/**
 * O convite para se inscrever.
 *
 * É o primeiro email que este profissional recebe de nós, e chega depois de
 * uma conversa — por telefone, por WhatsApp, à porta de uma obra. Por isso não
 * começa a vender: recorda a conversa e dá o link. Quem já disse que sim não
 * precisa de ser convencido outra vez, precisa de saber onde carregar.
 *
 * Diz quanto tempo o link dura. Um link que expira sem aviso é um profissional
 * que tenta na semana seguinte, encontra uma página morta e conclui que
 * desistimos dele.
 */

export type ConviteParaEnviar = {
  para: string;
  nome: string;
  token: string;
  diasDeValidade: number;
  /** Quem o convidou, para o email não parecer anónimo. */
  deQuem?: string | null;
  baseUrl?: string;
};

export async function enviarConviteAoProfissional(p: ConviteParaEnviar): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[email-convite] RESEND_API_KEY_clyonsite em falta — convite não enviado.");
    return false;
  }
  if (!p.para || !p.para.includes("@")) return false;

  const base = p.baseUrl ?? urlDeAccao();
  const url = comChave(`${base}/profissionais/inscricao/${p.token}`);
  const primeiro = p.nome.trim().split(/\s+/)[0];

  const html = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Convite CLYON</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:#0B1929;padding:20px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">CLYON</span>
        </td></tr>

        <tr><td style="padding:28px 32px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0B1929;">
            ${e(primeiro)}, aqui está o seu registo
          </h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
            Como combinámos${p.deQuem ? ` com ${e(p.deQuem)}` : ""}, deixamos-lhe o link para
            se registar na CLYON. Leva poucos minutos: os serviços que faz, as zonas onde
            trabalha e os dados de faturação.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${url}" style="display:inline-block;background:#00B4CC;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;">
                Completar o registo
              </a>
            </td></tr>
          </table>

          <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
            Depois de enviar, confirmamos os dados e avisamo-lo por email quando a conta
            estiver activa. A partir daí começa a receber pedidos da sua zona, com
            fotografias e com o valor que o cliente quer pagar — e vê sempre quanto
            recebe antes de aceitar seja o que for.
          </p>

          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
            O link é pessoal e dura ${p.diasDeValidade} dias. Se expirar, diga-nos e
            enviamos outro.
          </p>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
            Recebeu este email porque falou connosco sobre trabalhar com a CLYON. Se não
            foi o caso, ignore-o — sem o link ninguém se inscreve.
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
      to: p.para,
      subject: "O seu registo na CLYON",
      html,
    });
    if (error) {
      console.error("[email-convite] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-convite] falha ao enviar:", err);
    return false;
  }
}
