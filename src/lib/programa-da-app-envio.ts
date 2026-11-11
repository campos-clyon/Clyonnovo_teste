import { Resend } from "resend";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import {
  ASSUNTO_DO_CONVITE_DO_PROGRAMA,
  htmlDoConviteDoPrograma,
  textoDoConviteDoPrograma,
} from "./programa-da-app";

/**
 * Envia UM convite do programa de acesso antecipado, pelo mesmo serviço e
 * remetente dos outros emails do site (`convite-app-cliente-envio.ts`). Não
 * regista nada: quem chama reserva antes e desfaz se falhar
 * (`programa-da-app-na-base.ts`).
 */
export async function enviarConviteDoPrograma(p: { para: string; linkDeAdesao: string }): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[programa-da-app] RESEND_API_KEY_clyonsite em falta — email não enviado.");
    return false;
  }
  if (!p.para || !p.para.includes("@")) return false;
  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: p.para,
      subject: ASSUNTO_DO_CONVITE_DO_PROGRAMA,
      html: legivelNoResumo(htmlDoConviteDoPrograma({ email: p.para, linkDeAdesao: p.linkDeAdesao })),
      text: textoDoConviteDoPrograma({ email: p.para, linkDeAdesao: p.linkDeAdesao }),
    });
    if (error) {
      console.error("[programa-da-app] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[programa-da-app] falha ao enviar:", err);
    return false;
  }
}
