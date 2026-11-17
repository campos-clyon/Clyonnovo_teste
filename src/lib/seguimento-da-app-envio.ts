import { Resend } from "resend";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { htmlDeTextoSimples } from "./seguimento-da-app";

/**
 * Envia UM email de texto simples (o convite que pede o Gmail e o lembrete,
 * com os textos do Marketing depois de aprovados), pelo mesmo serviço e
 * remetente dos outros emails do site. Não regista nada: quem chama reserva
 * antes e desfaz se falhar.
 */
export async function enviarEmailDoSeguimento(p: { para: string; assunto: string; texto: string }): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[seguimento-da-app] RESEND_API_KEY_clyonsite em falta — email não enviado.");
    return false;
  }
  if (!p.para || !p.para.includes("@") || !p.assunto.trim() || !p.texto.trim()) return false;
  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: p.para,
      subject: p.assunto,
      html: legivelNoResumo(htmlDeTextoSimples(p.texto)),
      text: p.texto,
    });
    if (error) {
      console.error("[seguimento-da-app] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[seguimento-da-app] falha ao enviar:", err);
    return false;
  }
}
