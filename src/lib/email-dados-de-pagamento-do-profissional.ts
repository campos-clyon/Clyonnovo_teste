/**
 * O EMAIL AO PROFISSIONAL QUANDO OS DADOS DE PAGAMENTO MUDAM — d1, 12-11-2026.
 *
 * O IBAN, o titular ou o MB WAY da conta mudaram. Se foi ele, fica a saber que
 * ficou gravado; se não foi, é por aqui que sabe antes de o levantamento
 * seguinte ir para outra pessoa — «se não reconhece a mudança, fale connosco».
 *
 * Sai sozinho, da rota do perfil, só quando um destes campos muda de facto.
 * Nunca leva o IBAN inteiro nem o número de MB WAY: o email fica numa caixa de
 * correio para sempre e é reencaminhado sem se pensar. Os últimos dígitos
 * chegam para ele reconhecer o que é seu.
 */

import { Resend } from "resend";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { e } from "./escapar-html";
import { BUSINESS_EMAIL } from "./seo-data";
import { TELEFONE_DA_CLYON_NACIONAL, WHATSAPP_DA_CLYON } from "./telefone-da-clyon";
import { dataEHoraEmLisboa } from "./hora-de-lisboa";
import { listaDosCampos, type CampoDePagamento } from "./dados-de-pagamento-mudados";

export interface DadosDePagamentoMudadosParams {
  para: string;
  nome: string;
  campos: CampoDePagamento[];
  /** Os últimos quatro dígitos do IBAN novo, quando o IBAN mudou e ficou um. */
  ibanFinal?: string | null;
  /** Os últimos três dígitos do MB WAY novo, quando mudou e ficou um. */
  mbwayFinal?: string | null;
  em: Date;
}

export function montarHtmlDosDadosDePagamento(p: DadosDePagamentoMudadosParams): string {
  const primeiroNome = p.nome.trim().split(/\s+/)[0] ?? p.nome;
  const oQue = listaDosCampos(p.campos);
  const detalhes: string[] = [];
  if (p.campos.includes("iban")) {
    detalhes.push(p.ibanFinal ? `IBAN novo terminado em ${e(p.ibanFinal)}` : "IBAN apagado");
  }
  if (p.campos.includes("ibanTitular")) detalhes.push("titular da conta alterado");
  if (p.campos.includes("mbway")) {
    detalhes.push(p.mbwayFinal ? `MB WAY novo terminado em ${e(p.mbwayFinal)}` : "MB WAY apagado");
  }

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Os seus dados de pagamento mudaram</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <tr><td style="background:#00B4CC;padding:24px 32px;">
          <div style="color:#ffffff;font-size:20px;font-weight:700;">CLYON</div>
        </td></tr>

        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0B1929;">
            ${e(primeiroNome)}, os seus dados de pagamento mudaram
          </h1>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
            Em ${e(dataEHoraEmLisboa(p.em))} (hora de Lisboa), mudou-se na sua conta de
            profissional da CLYON: ${e(oQue)}. É para aí que vão os seus levantamentos
            a partir de agora.
          </p>

          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
            ${detalhes.join(" · ")}
          </p>

          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0B1929;font-weight:600;">
            Se não reconhece esta mudança, fale connosco já.
          </p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
            Pelo WhatsApp <a href="${WHATSAPP_DA_CLYON}" style="color:#007A8C;">${TELEFONE_DA_CLYON_NACIONAL}</a>
            ou para <a href="mailto:${BUSINESS_EMAIL}" style="color:#007A8C;">${BUSINESS_EMAIL}</a>.
            Avise-nos para não transferirmos nada para estes dados, e mude a sua palavra-passe.
          </p>

          <p style="margin:0;font-size:13px;line-height:1.6;color:#5A6B78;">
            Reconhece a mudança? Não precisa de fazer nada.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Nunca lança: a gravação já foi feita, e um email que não sai não a desfaz. */
export async function enviarEmailDosDadosDePagamento(p: DadosDePagamentoMudadosParams): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[email-dados-de-pagamento] RESEND_API_KEY_clyonsite em falta — email não enviado.");
    return false;
  }
  if (!p.para || !p.para.includes("@")) return false;

  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: p.para,
      replyTo: BUSINESS_EMAIL,
      subject: "Os seus dados de pagamento mudaram — CLYON",
      html: legivelNoResumo(montarHtmlDosDadosDePagamento(p)),
    });
    if (error) {
      console.error("[email-dados-de-pagamento] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-dados-de-pagamento] falha ao enviar:", err);
    return false;
  }
}
