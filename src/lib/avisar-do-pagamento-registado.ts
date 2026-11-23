import { Resend } from "resend";
import { perfilDoProfissional } from "./db";
import { sendPushToUser } from "./webpush";
import { urlDeAccao } from "./url-do-site";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { e } from "./escapar-html";
import { BUSINESS_EMAIL } from "./seo-data";
import { perguntaAoParceiro } from "./pagamento-registado";
import type { ComoPagarAoParceiro } from "./pagar-ao-parceiro";

/**
 * AO PARCEIRO: «O cliente diz que lhe pagou {total} por {forma}. Recebeu?» — d3
 * (23-11-2026). Push na app Pro e email, depois de o «Já paguei» estar gravado.
 * NUNCA LANÇA: um aviso que falha não desfaz o registo. Sem dados de pessoas: só
 * o número do pedido, o valor e a forma.
 */
export async function avisarOParceiroQueOClienteDizQuePagou(d: {
  providerId: number;
  pedidoId: number;
  negociacaoId: number;
  total: number | null;
  forma: ComoPagarAoParceiro | null;
}): Promise<{ push: boolean; email: boolean }> {
  const saida = { push: false, email: false };
  try {
    const perfil = await perfilDoProfissional(d.providerId);
    const email = typeof perfil?.email === "string" ? perfil.email.trim() : "";
    const pergunta = perguntaAoParceiro(d.total, d.forma);
    if (!email) return saida;
    let ligacao = "/profissionais/painel";
    try {
      ligacao = new URL("/profissionais/painel", urlDeAccao()).toString();
    } catch {
      /* fica o caminho */
    }
    try {
      const n = await sendPushToUser(
        email,
        {
          title: `Pedido #${d.pedidoId}: o cliente diz que pagou`,
          body: pergunta,
          url: ligacao,
          tag: `cliente-diz-que-pagou-${d.pedidoId}`,
          negociacaoId: d.negociacaoId,
        },
        "pro",
      );
      saida.push = n > 0;
    } catch (err) {
      console.error("[pagamento-registado] push:", err instanceof Error ? err.message : err);
    }
    const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
    if (chave && email.includes("@")) {
      try {
        const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>O cliente diz que pagou</title></head>
<body style="margin:0;padding:24px;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
<div style="color:#007A8C;font-size:18px;font-weight:700;margin-bottom:12px;">CLYON</div>
<h1 style="margin:0 0 12px;font-size:20px;color:#0B1929;">Pedido #${e(String(d.pedidoId))}: o cliente diz que pagou</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">${e(pergunta)}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">Abra o trabalho no painel ou na app CLYON Pro e responda «Sim, recebi» ou «Ainda não recebi». A CLYON só regista: o dinheiro vai diretamente para si.</p>
<p style="margin:0;font-size:13px;color:#5A6B78;"><a href="${e(ligacao)}" style="color:#007A8C;">Abrir o painel</a> · <a href="mailto:${e(BUSINESS_EMAIL)}" style="color:#007A8C;">${e(BUSINESS_EMAIL)}</a></p>
</div></body></html>`;
        const { error } = await new Resend(chave).emails.send({
          from: "CLYON <noreply@clyon.pt>",
          to: email,
          replyTo: BUSINESS_EMAIL,
          subject: `Pedido #${d.pedidoId}: o cliente diz que lhe pagou — CLYON`,
          html: legivelNoResumo(html),
        });
        if (error) console.error("[pagamento-registado] Resend recusou:", error);
        else saida.email = true;
      } catch (err) {
        console.error("[pagamento-registado] email:", err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error("[pagamento-registado] aviso:", err instanceof Error ? err.message : err);
  }
  return saida;
}
