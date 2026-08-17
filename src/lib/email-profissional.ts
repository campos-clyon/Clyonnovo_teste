/**
 * O email que avisa um profissional de que há um pedido para ele.
 *
 * Duas coisas não podem sair daqui, e são as mesmas que não podem sair da API:
 *
 *   · **o valor máximo** que o cliente indicou. Se ele o visse, não proporia
 *     abaixo dele;
 *   · **a morada exacta**. Antes de o trabalho estar fechado o profissional vê
 *     a zona. No sistema antigo encontrámos esta fuga — moradas de casa a
 *     chegarem a quem ainda não tinha aceitado nada.
 *
 * Por isso este ficheiro não recebe o pedido inteiro. Recebe um objecto já
 * reduzido, e o que ele mostra é só o que lá vier. Passar a linha da base
 * directamente para aqui seria dar-lhe tudo e confiar que ninguém escreveria
 * o campo errado no template.
 */

import { Resend } from "resend";
import { e } from "./escapar-html";
import { urlDeAccao } from "./url-do-site";

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

const URGENCIA: Record<string, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  this_week: "Esta semana",
  flexible: "Sem pressa",
};

/** O que se pode dizer a um profissional sobre um pedido ainda não fechado. */
export type AvisoDePedido = {
  paraEmail: string;
  paraNome: string;
  pedidoId: number;
  /** O link dele para este pedido. Não tem conta — o token é o acesso. */
  token: string;
  serviceType: string | null;
  /** Zona, nunca a morada. */
  zona: string | null;
  urgencia: string | null;
  descricao: string | null;
  quantidadeDeFotos: number;
  /** O que o cliente quer pagar. O mínimo — o máximo não existe deste lado. */
  valorMinimoCliente: number | null;
  /** Quanto ele recebe se fechar por esse valor, já líquido. */
  recebeLiquido: number | null;
  distanciaKm: number | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  /** O endereço deste deployment, tirado do pedido HTTP. */
  baseUrl?: string;
};

function euros(valor: number | null): string | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  return valor.toFixed(2).replace(".", ",") + " €";
}

function linha(rotulo: string, valor: string | null): string {
  if (!valor) return "";
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#94a3b8;width:130px;">${e(rotulo)}</td>
    <td style="padding:6px 0;font-size:14px;color:#0B1929;font-weight:600;">${e(valor)}</td>
  </tr>`;
}

function montarHtml(p: AvisoDePedido): string {
  const url = `${p.baseUrl ?? urlDeAccao()}/profissionais/pedidos/${p.token}`;
  const servico = ETIQUETAS_DE_SERVICO[p.serviceType ?? ""] ?? p.serviceType ?? "Serviço";
  const quer = euros(p.valorMinimoCliente);
  const recebe = euros(p.recebeLiquido);

  const documentos = [
    p.precisaFatura ? "fatura" : null,
    p.precisaGuiaTransporte ? "guia de transporte" : null,
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pedido #${p.pedidoId} na sua zona</title></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <tr><td style="background:#00B4CC;padding:20px 32px;">
          <div style="color:#ffffff;font-size:18px;font-weight:700;">CLYON</div>
        </td></tr>

        <tr><td style="padding:28px 32px;">
          <h1 style="margin:0 0 6px;font-size:20px;color:#0B1929;">${e(servico)}</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#64748b;">
            Pedido #${p.pedidoId}${p.zona ? ` · ${e(p.zona)}` : ""}
          </p>

          ${
            quer && recebe
              ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #e2e8f0;border-radius:10px;">
                   <tr>
                     <td style="padding:14px;text-align:center;border-right:1px solid #e2e8f0;">
                       <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;">Cliente quer pagar</div>
                       <div style="margin-top:4px;font-size:22px;font-weight:700;color:#0B1929;">${quer}</div>
                     </td>
                     <td style="padding:14px;text-align:center;">
                       <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;">Recebe</div>
                       <div style="margin-top:4px;font-size:22px;font-weight:700;color:#059669;">${recebe}</div>
                       <div style="margin-top:2px;font-size:11px;color:#94a3b8;">já inclui a taxa CLYON</div>
                     </td>
                   </tr>
                 </table>`
              : ""
          }

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
            ${linha("Quando", p.urgencia ? (URGENCIA[p.urgencia] ?? p.urgencia) : null)}
            ${linha("Distância", p.distanciaKm != null ? `~${p.distanciaKm} km da sua base` : null)}
            ${linha("Fotografias", p.quantidadeDeFotos > 0 ? String(p.quantidadeDeFotos) : "sem fotografias")}
            ${linha("Precisa de", documentos.length ? documentos.join(" e ") : null)}
          </table>

          ${
            p.descricao
              ? `<div style="background:#f8fafc;border-radius:10px;padding:14px;margin:0 0 20px;">
                   <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;white-space:pre-line;">${e(
                     p.descricao.slice(0, 600),
                   )}</p>
                 </div>`
              : ""
          }

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${url}" style="display:inline-block;background:#00B4CC;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:10px;font-size:15px;font-weight:600;">
                Ver e responder
              </a>
            </td></tr>
          </table>

          <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
            A morada exacta aparece depois de o cliente o contratar. Pode aceitar o valor
            pedido ou propor outro — só valores, sem mensagens.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Avisa um profissional. Nunca lança — um email que falhe não pode derrubar a
 * criação do pedido nem impedir que os outros sejam avisados.
 */
export async function avisarProfissional(p: AvisoDePedido): Promise<boolean> {
  // Mesmo nome que o resto do projecto usa — ver a nota em email-pedido.ts.
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("[email-profissional] RESEND_API_KEY_clyonsite em falta — aviso não enviado.");
    return false;
  }
  if (!p.paraEmail || !p.paraEmail.includes("@")) return false;

  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: p.paraEmail,
      subject: `Novo pedido${p.zona ? ` em ${p.zona}` : ""} — ${
        ETIQUETAS_DE_SERVICO[p.serviceType ?? ""] ?? "serviço"
      }`,
      html: montarHtml(p),
    });
    if (error) {
      console.error("[email-profissional] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-profissional] falha ao enviar:", err);
    return false;
  }
}
