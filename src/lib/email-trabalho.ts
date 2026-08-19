/**
 * Os emails da fase em que já há dinheiro em jogo.
 *
 * Dois momentos, e nenhum deles pode depender de alguém se lembrar de abrir o
 * site: o profissional saber que foi contratado — com a morada, que só agora
 * pode sair — e o cliente saber que o trabalho está feito e que falta
 * confirmá-lo.
 *
 * O segundo é o que liberta o dinheiro. Sem ele, o prazo de sete dias corria
 * sem o cliente saber sequer que estava a correr, e a libertação automática
 * deixava de ser um prazo para passar a ser uma surpresa.
 *
 * Como nos outros emails: o que vem de um formulário é escapado antes de
 * entrar no HTML — ver escapar-html.ts.
 */

import { Resend } from "resend";
import { e } from "./escapar-html";
import { linkDoPedido } from "./pedido-acesso";
import { urlDeAccao } from "./url-do-site";
import { comChave } from "./acesso-mvp";

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

function euros(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}

function moldura(titulo: string, corpo: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:#0B1929;padding:20px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">CLYON</span>
        </td></tr>
        <tr><td style="padding:28px 32px;">${corpo}</td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
            A CLYON liga clientes a profissionais independentes. Quem executa o trabalho
            e emite a fatura é o profissional.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function chave(): string | null {
  // Mesmo nome que o resto do projecto usa — ver a nota em email-pedido.ts.
  return process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY ?? null;
}

async function enviar(para: string, assunto: string, html: string, etiqueta: string) {
  const k = chave();
  if (!k) {
    console.warn(`[${etiqueta}] RESEND_API_KEY_clyonsite em falta — email não enviado.`);
    return false;
  }
  if (!para || !para.includes("@")) return false;
  try {
    const resend = new Resend(k);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: para,
      subject: assunto,
      html,
    });
    if (error) {
      console.error(`[${etiqueta}] Resend recusou:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[${etiqueta}] falha ao enviar:`, err);
    return false;
  }
}

// ── 1. O profissional foi contratado ────────────────────────────────────────

export type AvisoDeContratacao = {
  paraEmail: string;
  paraNome: string;
  pedidoId: number;
  serviceType: string | null;
  /** Agora pode sair: o trabalho é dele. */
  morada: string | null;
  contactoNome: string | null;
  contactoTelefone: string | null;
  recebeLiquido: number | null;
  baseUrl?: string;
};

export async function avisarQueFoiContratado(p: AvisoDeContratacao): Promise<boolean> {
  const base = p.baseUrl ?? urlDeAccao();
  const servico = ETIQUETAS_DE_SERVICO[p.serviceType ?? ""] ?? p.serviceType ?? "Serviço";

  const corpo = `
    <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Pedido #${p.pedidoId}</p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0B1929;">
      O trabalho é seu${p.paraNome ? `, ${e(p.paraNome.split(/\s+/)[0])}` : ""}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
      O cliente contratou-o para <strong>${e(servico)}</strong>. O valor está retido na
      CLYON e é libertado assim que ele confirmar que está feito.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#047857;">Recebe</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#047857;">${euros(p.recebeLiquido)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#059669;">já com a taxa CLYON descontada</p>
      </td></tr>
    </table>

    ${
      p.morada
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;margin-bottom:20px;">
             <tr><td style="padding:16px 18px;">
               <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Onde</p>
               <p style="margin:0;font-size:15px;line-height:1.5;color:#0B1929;">${e(p.morada)}</p>
               ${
                 p.contactoNome || p.contactoTelefone
                   ? `<p style="margin:10px 0 0;font-size:15px;color:#0B1929;">
                        ${p.contactoNome ? e(p.contactoNome) : ""}${
                          p.contactoTelefone
                            ? ` · <a href="tel:${e(p.contactoTelefone)}" style="color:#0077B6;">${e(p.contactoTelefone)}</a>`
                            : ""
                        }
                      </p>`
                   : ""
               }
             </td></tr>
           </table>`
        : ""
    }

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${comChave(`${base}/profissionais/painel?ecra=trabalhos`)}" style="display:inline-block;background:#00B4CC;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:10px;font-size:15px;font-weight:600;">
          Ver o trabalho
        </a>
      </td></tr>
    </table>

    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
      Quando estiver feito, fotografe o resultado e marque como feito na sua conta. É a
      fotografia que permite ao cliente confirmar — e é a confirmação que liberta o
      pagamento.
    </p>`;

  return enviar(
    p.paraEmail,
    `Foi contratado — pedido #${p.pedidoId}`,
    moldura("O trabalho é seu", corpo),
    "email-contratado",
  );
}

// ── 2. O cliente tem de confirmar ───────────────────────────────────────────

export type PedidoDeConfirmacao = {
  paraEmail: string;
  paraNome: string | null;
  pedidoId: number;
  profissionalNome: string;
  /** Um link novo: o anterior deixa de servir. */
  token: string;
  quantasFotos: number;
  diasParaConfirmar: number;
  baseUrl?: string;
};

export async function pedirConfirmacaoAoCliente(p: PedidoDeConfirmacao): Promise<boolean> {
  const url = linkDoPedido(p.baseUrl ?? urlDeAccao(), p.token);
  const nome = p.paraNome?.trim().split(/\s+/)[0] ?? null;

  const corpo = `
    <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Pedido #${p.pedidoId}</p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0B1929;">
      ${nome ? `${e(nome)}, o` : "O"} trabalho está feito
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
      <strong>${e(p.profissionalNome)}</strong> marcou o trabalho como feito e enviou
      ${p.quantasFotos === 1 ? "uma fotografia" : `${p.quantasFotos} fotografias`}.
      Veja e confirme — é a confirmação que liberta o pagamento.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${url}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:10px;font-size:15px;font-weight:600;">
          Ver e confirmar
        </a>
      </td></tr>
    </table>

    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
      Se não disser nada, o pagamento é libertado sozinho daqui a
      ${p.diasParaConfirmar} dias. Se alguma coisa estiver mal, responda a este email
      antes disso — tratamos do assunto.
    </p>

    <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
      Este link substitui o anterior, por segurança. Guarde-o: é por aqui que volta ao
      seu pedido.
    </p>`;

  return enviar(
    p.paraEmail,
    `O trabalho está feito — confirme o pedido #${p.pedidoId}`,
    moldura("Confirme o trabalho", corpo),
    "email-confirmacao",
  );
}
