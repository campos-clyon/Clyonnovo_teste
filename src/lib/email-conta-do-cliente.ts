import { Resend } from "resend";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { escaparHtml } from "./escapar-html";
import { HORAS_DA_CONFIRMACAO, HORAS_DO_REPOR } from "./palavra-passe-do-cliente";

/**
 * OS EMAILS DA CONTA COM PALAVRA-PASSE — 01-11-2026.
 *
 * Como o email do link de entrada: não dizem o nome de ninguém nem contam nada
 * sobre a conta além do que é preciso para a pessoa saber o que fazer. Se o
 * endereço estiver errado, quem o recebe só fica a saber que alguém o escreveu.
 *
 *   · confirmar — registo novo: o link confirma o email e abre a conta;
 *   · definir   — o email já tinha conta (Google, link ou pedido), sem
 *                 palavra-passe: o link deixa escolher uma;
 *   · ja-tem    — registaram-se com um email que já tem palavra-passe: diz-se
 *                 que a conta existe e dá-se o link para escolher outra;
 *   · repor     — «Esqueci-me da palavra-passe».
 */
export type EmailDaConta = "confirmar" | "definir" | "ja-tem" | "repor";

const TEXTOS: Record<EmailDaConta, { assunto: string; titulo: string; corpo: string; botao: string }> = {
  confirmar: {
    assunto: "Confirme o seu email na CLYON",
    titulo: "Confirme o seu email",
    corpo: `Para terminar o registo na CLYON, carregue no botão. O link dura ${HORAS_DA_CONFIRMACAO} horas e serve uma vez. Depois entra com o seu email e a palavra-passe que escolheu.`,
    botao: "Confirmar o email",
  },
  definir: {
    assunto: "Escolha a sua palavra-passe na CLYON",
    titulo: "Este email já tem conta na CLYON",
    corpo: `A sua conta já existe (entrou antes com o Google ou com um link por email). Para passar a entrar também com uma palavra-passe, carregue no botão e escolha-a. O link dura ${HORAS_DA_CONFIRMACAO} horas e serve uma vez.`,
    botao: "Escolher a palavra-passe",
  },
  "ja-tem": {
    assunto: "A sua conta na CLYON",
    titulo: "Este email já tem conta na CLYON",
    corpo: `Alguém tentou criar uma conta com este email, mas ela já existe e tem palavra-passe. Pode entrar normalmente. Se não se lembra da palavra-passe, carregue no botão para escolher outra. O link dura ${HORAS_DO_REPOR} hora e serve uma vez.`,
    botao: "Escolher outra palavra-passe",
  },
  repor: {
    assunto: "Escolher uma palavra-passe nova na CLYON",
    titulo: "Palavra-passe nova",
    corpo: `Recebemos um pedido para escolher uma palavra-passe nova para esta conta. Carregue no botão para a escolher. O link dura ${HORAS_DO_REPOR} hora e serve uma vez. A palavra-passe actual continua a valer até usar o link.`,
    botao: "Escolher a palavra-passe nova",
  },
};

export async function enviarEmailDaConta(params: {
  tipo: EmailDaConta;
  para: string;
  link: string;
}): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[email-conta-do-cliente] RESEND_API_KEY_clyonsite em falta — email não enviado.");
    return false;
  }
  if (!params.para || !params.para.includes("@")) return false;

  const t = TEXTOS[params.tipo];
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
          <h1 style="margin:0 0 12px;font-size:20px;color:#0B1929;">${t.titulo}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
            ${t.corpo}
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
            <tr><td style="border-radius:12px;background:#00B4CC;">
              <a href="${link}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">
                ${t.botao}
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
            Se não pediu este email, pode ignorá-lo: sem carregar no botão, nada muda na conta.
          </p>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:16px 24px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            Não partilhe este email. O link é pessoal e só serve uma vez.
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
      subject: t.assunto,
      html: legivelNoResumo(html),
    });
    if (error) {
      console.error("[email-conta-do-cliente] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-conta-do-cliente] falha ao enviar:", err);
    return false;
  }
}
