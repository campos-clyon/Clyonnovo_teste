/**
 * O email que leva o link do pedido ao cliente.
 *
 * É o email mais importante da plataforma: sem ele, quem não criou conta fica
 * sem forma de voltar ao próprio pedido. Por isso não vai junto com nenhum
 * outro assunto e diz uma coisa só — aqui está o teu pedido, é por aqui que
 * respondes às propostas.
 *
 * O texto que vem do cliente é escapado antes de entrar no HTML. Não é
 * paranoia: os emails são montados com template strings, o nome e a descrição
 * vêm de um formulário público, e sem escapar qualquer pessoa conseguia que a
 * CLYON lhe enviasse um botão "Confirmar pagamento" apontado para outro sítio,
 * a partir do nosso domínio e com o nosso aspecto. Ver escapar-html.ts.
 */

import { Resend } from "resend";
import { SITE_URL } from "./seo-data";
import { e } from "./escapar-html";
import { linkDoPedido } from "./pedido-acesso";

const ETIQUETAS_DE_SERVICO: Record<string, string> = {
  recolha_moveis: "Recolha de móveis",
  recolha_monos: "Recolha de monos",
  recolha_entulho: "Recolha de entulho",
  esvaziamento_casa: "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca: "Mudança",
  montagem_moveis: "Montagem e desmontagem de móveis",
  jardinagem: "Jardinagem",
  manutencao_casa: "Manutenção da casa",
  outro: "Outro serviço",
};

export interface LinkDoPedidoParams {
  para: string;
  nomeDoCliente: string | null;
  pedidoId: number;
  serviceType: string | null;
  token: string;
  valorMinimoCliente: number | null;
}

function euros(valor: number | null): string | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  return valor.toFixed(2).replace(".", ",") + " €";
}

function montarHtml(p: LinkDoPedidoParams): string {
  const url = linkDoPedido(SITE_URL, p.token);
  const servico = ETIQUETAS_DE_SERVICO[p.serviceType ?? ""] ?? p.serviceType ?? "Serviço";
  const nome = p.nomeDoCliente?.trim().split(/\s+/)[0] ?? null;
  const minimo = euros(p.valorMinimoCliente);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>O seu pedido CLYON #${p.pedidoId}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <tr><td style="background:#00B4CC;padding:24px 32px;">
          <div style="color:#ffffff;font-size:20px;font-weight:700;">CLYON</div>
        </td></tr>

        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0B1929;">
            ${nome ? `${e(nome)}, o seu pedido está criado` : "O seu pedido está criado"}
          </h1>

          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
            Pedido <strong>#${p.pedidoId}</strong> — ${e(servico)}.
            Os profissionais da sua zona vão vê-lo e responder com valores.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td align="center">
              <a href="${url}"
                 style="display:inline-block;background:#00B4CC;color:#ffffff;text-decoration:none;
                        padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;">
                Ver o meu pedido
              </a>
            </td></tr>
          </table>

          ${
            minimo
              ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
                   Disse que quer pagar a partir de <strong>${minimo}</strong>. É este o
                   valor que os profissionais vêem — o máximo que indicou fica só do
                   nosso lado.
                 </p>`
              : ""
          }

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:0 0 24px;">
            <p style="margin:0;font-size:14px;line-height:1.6;color:#166534;">
              <strong>Não precisa de criar conta.</strong> Este link abre o pedido
              directamente. Se preferir ter todos os pedidos no mesmo sítio, pode
              entrar com a conta Google a qualquer momento.
            </p>
          </div>

          <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
            Guarde este email — o link é pessoal e é a sua forma de voltar ao pedido.
            Não o reencaminhe: quem o tiver consegue ver e responder às propostas.
            Expira ao fim de 30 dias.
          </p>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
            A CLYON liga clientes a profissionais independentes. Quem executa o
            trabalho e emite a fatura é o profissional que escolher.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Envia o link. Nunca relança — o pedido já está gravado quando isto corre, e
 * rebentar aqui dava ao cliente um erro de criação por causa de um email que
 * falhou. A falha fica no log, e o link continua a existir na base.
 */
export async function enviarLinkDoPedido(p: LinkDoPedidoParams): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[email-pedido] RESEND_API_KEY em falta — link não enviado.");
    return false;
  }
  if (!p.para || !p.para.includes("@")) {
    console.warn("[email-pedido] pedido", p.pedidoId, "sem email válido — link não enviado.");
    return false;
  }

  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: p.para,
      subject: `O seu pedido #${p.pedidoId} está criado`,
      html: montarHtml(p),
    });
    if (error) {
      console.error("[email-pedido] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-pedido] falha ao enviar:", err);
    return false;
  }
}
