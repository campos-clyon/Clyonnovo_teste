/**
 * O email com o link para o profissional escolher uma palavra-passe nova.
 *
 * O mesmo link de uso único do convite (`/profissionais/definir-senha/<token>`)
 * — e não uma palavra-passe escrita por nós. Uma palavra-passe mandada por
 * email fica na caixa de correio para sempre e é reencaminhada sem se pensar;
 * um token que se queima ao ser usado não tem esse problema.
 *
 * Sai por dois caminhos, e o texto diz qual: o próprio pediu-o na página de
 * entrada, ou a CLYON enviou-lho do backoffice porque ele ligou a dizer que
 * não conseguia entrar. Em nenhum dos dois o link aparece noutro sítio que não
 * seja a caixa de correio dele — foi a escolha do dono, 01-10-2026: «Só por
 * email».
 */

import { Resend } from "resend";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { e } from "./escapar-html";
import { urlDeAccao } from "./url-do-site";
import { comChave } from "./acesso-mvp";

export type QuemPediu = "proprio" | "clyon";

export interface ReporParams {
  para: string;
  nome: string;
  token: string;
  /** O endereço deste deployment, tirado do pedido HTTP. */
  baseUrl?: string;
  /** Horas de validade do link, para o dizer ao próprio. */
  horasDeValidade: number;
  pedidoPor: QuemPediu;
}

export function montarHtmlDeRepor(p: ReporParams): string {
  // A chave no link pela mesma razão do email de aprovação: definida a
  // palavra-passe, ele cai no painel, que está atrás dela.
  const url = comChave(`${p.baseUrl ?? urlDeAccao()}/profissionais/definir-senha/${p.token}`);
  const primeiroNome = p.nome.trim().split(/\s+/)[0] ?? p.nome;
  const porque =
    p.pedidoPor === "proprio"
      ? "Recebemos um pedido para repor a palavra-passe da sua conta de profissional na CLYON."
      : "A equipa da CLYON enviou-lhe este link, como combinado, para voltar a entrar na sua conta de profissional.";

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Escolha uma palavra-passe nova</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <tr><td style="background:#00B4CC;padding:24px 32px;">
          <div style="color:#ffffff;font-size:20px;font-weight:700;">CLYON</div>
        </td></tr>

        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0B1929;">
            ${e(primeiroNome)}, escolha uma palavra-passe nova
          </h1>

          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
            ${porque} Carregue no botão, escreva a palavra-passe que quer e entra logo no
            painel.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td align="center">
              <a href="${url}"
                 style="display:inline-block;background:#007A8C;color:#ffffff;text-decoration:none;
                        padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;">
                Escolher palavra-passe nova
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#5A6B78;">
            Este link serve uma vez e expira em ${p.horasDeValidade} horas. Não o
            reencaminhe — quem o abrir fica com o acesso à sua conta.
          </p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#5A6B78;">
            Não pediu isto? Ignore este email. A sua palavra-passe actual continua a
            funcionar até alguém usar o link.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Nunca lança: quem chama decide o que dizer quando o email não sai. */
export async function enviarEmailDeRepor(p: ReporParams): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[email-repor] RESEND_API_KEY_clyonsite em falta — email não enviado.");
    return false;
  }
  if (!p.para || !p.para.includes("@")) return false;

  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: p.para,
      subject: "Escolha uma palavra-passe nova — CLYON",
      html: legivelNoResumo(montarHtmlDeRepor(p)),
    });
    if (error) {
      console.error("[email-repor] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-repor] falha ao enviar:", err);
    return false;
  }
}
