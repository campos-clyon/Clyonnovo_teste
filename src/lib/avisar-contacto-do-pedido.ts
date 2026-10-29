import { Resend } from "resend";
import { e } from "./escapar-html";
import { BUSINESS_EMAIL } from "./seo-data";

/**
 * O AVISO AO CONTACTO DO PEDIDO — 29-10-2026 (Segurança, R13, R21, R23).
 *
 * Quando alguém age num pedido pelo link (juntá-lo a uma conta, e mais tarde
 * alterá-lo), quem o fez — o contacto GUARDADO no pedido — fica a saber. Por
 * WhatsApp quando o pedido tem telefone, e por email quando tem email. O
 * destino é sempre o do pedido, nunca um que venha do corpo da chamada.
 *
 * Nunca lança: o que o provocou já está gravado. Devolve se saiu por algum lado.
 */
export async function avisarContactoDoPedido(
  pedido: { id: number; contactPhone?: string | null; contactEmail?: string | null },
  texto: string,
): Promise<boolean> {
  let saiu = false;
  const telefone = (pedido.contactPhone ?? "").trim();
  if (telefone) {
    try {
      const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
      saiu = (await enviarAvisoWhatsApp(telefone, texto)) || saiu;
    } catch (err) {
      console.error("[avisar-contacto] WhatsApp falhou no pedido", pedido.id, err instanceof Error ? err.message : err);
    }
  }
  const email = (pedido.contactEmail ?? "").trim();
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (email.includes("@") && chave) {
    try {
      const { error } = await new Resend(chave).emails.send({
        from: "CLYON <noreply@clyon.pt>",
        // Responder a este email fala com a equipa.
        replyTo: BUSINESS_EMAIL,
        to: email,
        subject: `O seu pedido #${pedido.id} na CLYON`,
        html: `<p style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a">${e(texto)}</p>`,
      });
      if (!error) saiu = true;
    } catch (err) {
      console.error("[avisar-contacto] email falhou no pedido", pedido.id, err instanceof Error ? err.message : err);
    }
  }
  return saiu;
}

/* A junção à conta pedida pela app (R13): o que a app mostra e o aviso ao contacto. */
export const A_ESPERA_DA_MESA =
  "Pedimos à CLYON que confirme que este pedido é seu. Quando confirmar, o pedido aparece na sua conta.";

/** O aviso ao contacto do pedido quando alguém pede para o ligar a uma conta. */
export function avisoDeJuncao(id: number, emailMascarado: string): string {
  return (
    `Pediram para ligar o pedido #${id} à conta ${emailMascarado}, na app da CLYON. ` +
    "A CLYON confirma antes de o ligar. Não reconhece este pedido? Responda a esta mensagem."
  );
}


/*
 * O QUE SE FEZ PELO LINK AVISA O CONTACTO DO PEDIDO — 29-10-2026 (Segurança,
 * R21 e R23). Quem tem o link manda no pedido; o limite de telemóveis só trava
 * a app. A defesa é o contacto saber, no máximo um aviso de 30 em 30 minutos.
 */
const ACCOES_PELO_LINK: Readonly<Record<string, string>> = {
  contratar: "foi contratado um profissional",
  aceitar: "foi aceite uma proposta",
  recusar: "foi recusada uma proposta",
  cancelar_pedido: "o pedido foi cancelado",
  aceitar_preco_clyon: "foi aceite o preço da CLYON",
};

export async function avisarAccaoPeloLink(
  pedido: { id: number; contactPhone?: string | null; contactEmail?: string | null },
  accao: unknown,
): Promise<void> {
  const oQue = typeof accao === "string" ? ACCOES_PELO_LINK[accao] : undefined;
  if (!oQue) return;
  try {
    const { limitarPorConta } = await import("./limite-rota-publica");
    const travao = await limitarPorConta("aviso-ao-contacto", `pedido:${pedido.id}`, 1, 1800);
    if (travao.erro) return;
    await avisarContactoDoPedido(
      pedido,
      `No pedido #${pedido.id}, pelo link, ${oQue}. Não reconhece esta alteração? Responda a esta mensagem.`,
    );
  } catch (err) {
    console.error("[avisar-contacto] acção pelo link:", err instanceof Error ? err.message : err);
  }
}
