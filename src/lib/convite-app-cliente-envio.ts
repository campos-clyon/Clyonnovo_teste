import { Resend } from "resend";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { ASSUNTO_DO_CONVITE, htmlDoConvite, textoDoConvite } from "./convite-app-cliente";

/**
 * Envia UM convite pelo mesmo serviço e remetente dos links de entrada do site
 * (`email-entrada.ts`). Não regista nada: quem chama reserva antes e marca
 * depois (`convite-app-cliente-na-base.ts`).
 */
export async function enviarConviteDaApp(params: {
  para: string;
  nome: string | null;
  link: string;
}): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[convite-app-cliente] RESEND_API_KEY_clyonsite em falta — email não enviado.");
    return false;
  }
  if (!params.para || !params.para.includes("@")) return false;

  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: params.para,
      subject: ASSUNTO_DO_CONVITE,
      html: legivelNoResumo(htmlDoConvite({ nome: params.nome, link: params.link })),
      text: textoDoConvite({ nome: params.nome, link: params.link }),
    });
    if (error) {
      console.error("[convite-app-cliente] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[convite-app-cliente] falha ao enviar:", err);
    return false;
  }
}
