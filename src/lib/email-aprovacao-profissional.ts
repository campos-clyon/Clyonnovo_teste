/**
 * O email que diz ao profissional que foi aprovado, e o leva a criar a
 * palavra-passe.
 *
 * O link é de uso único e leva um token, em vez de uma palavra-passe gerada por
 * nós. A diferença importa: uma palavra-passe enviada por email fica na caixa
 * de correio para sempre, é reencaminhada sem se pensar, e aparece em cópias de
 * segurança de servidores de mail que não são nossos. Um token que se queima ao
 * ser usado não tem esse problema.
 */

import { Resend } from "resend";
import { e } from "./escapar-html";
import { urlDeAccao } from "./url-do-site";
import { comChave } from "./acesso-mvp";

export interface AprovacaoParams {
  para: string;
  nome: string;
  token: string;
  /** O endereço deste deployment, tirado do pedido HTTP. */
  baseUrl?: string;
  /** Dias de validade do link, para o dizer ao próprio. */
  diasDeValidade: number;
}

function montarHtml(p: AprovacaoParams): string {
  // O caminho de definir a palavra-passe está aberto pelo token, mas assim
  // que ele a define cai no painel — que está atrás da chave. Levá-la no link
  // é o que evita que a conta seja criada e a porta seguinte dê 404.
  const url = comChave(
    `${p.baseUrl ?? urlDeAccao()}/profissionais/definir-senha/${p.token}`,
  );
  const primeiroNome = p.nome.trim().split(/\s+/)[0] ?? p.nome;

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>A sua inscrição na CLYON foi aprovada</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <tr><td style="background:#00B4CC;padding:24px 32px;">
          <div style="color:#ffffff;font-size:20px;font-weight:700;">CLYON</div>
        </td></tr>

        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0B1929;">
            ${e(primeiroNome)}, está aprovado
          </h1>

          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
            A sua inscrição foi verificada. A partir de agora recebe os pedidos da sua
            zona nas categorias que escolheu.
          </p>

          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
            Falta uma coisa: <strong>criar a sua palavra-passe</strong>. É com ela que
            entra no painel e vê todos os pedidos num sítio só.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td align="center">
              <a href="${url}"
                 style="display:inline-block;background:#00B4CC;color:#ffffff;text-decoration:none;
                        padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;">
                Criar palavra-passe
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
            Este link serve uma vez e expira em ${p.diasDeValidade} dias. Não o
            reencaminhe — quem o abrir fica com o acesso à sua conta. Se expirar, peça
            outro na página de entrada.
          </p>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
            Inscrever-se e responder a pedidos é gratuito. Só há comissão quando fecha
            um trabalho.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Nunca lança: a aprovação já foi gravada quando isto corre. */
export async function enviarEmailDeAprovacao(p: AprovacaoParams): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[email-aprovacao] RESEND_API_KEY_clyonsite em falta — email não enviado.");
    return false;
  }
  if (!p.para || !p.para.includes("@")) return false;

  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: p.para,
      subject: "Está aprovado — crie a sua palavra-passe",
      html: montarHtml(p),
    });
    if (error) {
      console.error("[email-aprovacao] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-aprovacao] falha ao enviar:", err);
    return false;
  }
}
