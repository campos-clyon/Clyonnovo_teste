import { Resend } from "resend";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { htmlDeTextoSimples } from "./seguimento-da-app";
import { REMETENTE_DA_APP_DE_CLIENTE } from "./convite-app-cliente";

/**
 * Envia UM email de texto simples (o lembrete, com o texto aprovado a
 * 17-11-2026), pelo mesmo serviço dos outros emails do site, de geral@clyon.pt.
 * Não regista nada: quem chama reserva antes e desfaz se falhar.
 */
export async function enviarEmailDoSeguimento(p: {
  para: string;
  assunto: string;
  texto: string;
  /** d106: o HTML já montado (os emails da app, com botões); sem ele, o do texto simples. */
  html?: string;
}): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[seguimento-da-app] RESEND_API_KEY_clyonsite em falta — email não enviado.");
    return false;
  }
  if (!p.para || !p.para.includes("@") || !p.assunto.trim() || !p.texto.trim()) return false;
  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: REMETENTE_DA_APP_DE_CLIENTE,
      to: p.para,
      subject: p.assunto,
      html: legivelNoResumo(p.html ?? htmlDeTextoSimples(p.texto)),
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
