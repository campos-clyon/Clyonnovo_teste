import { Resend } from "resend";
import { e } from "./escapar-html";
import { linkDoPedido } from "./pedido-acesso";
import { urlDeAccao } from "./url-do-site";
import { comChave } from "./acesso-mvp";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";
import { PRAZO_DA_PROPOSTA_HORAS } from "./negociacao";

/**
 * O aviso de que há uma proposta à espera.
 *
 * Sem isto, a negociação só existia para quem tivesse o ecrã aberto. Uma
 * proposta tem 48 horas e depois expira sozinha — perder um trabalho porque
 * ninguém foi ver a página é a forma mais estúpida de o perder.
 *
 * O email diz o valor e leva um botão. Não pede resposta por email nem explica
 * o modelo: quem recebe isto já negociou uma vez, e o que precisa é de chegar
 * ao sítio onde carrega em "aceitar".
 *
 * Nunca lança. Um aviso que falha não pode desfazer a proposta que acabou de
 * ser gravada — ela existe, e o outro lado vê-a assim que abrir a conta.
 */

function euros(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}

function moldura(corpo: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:#0B1929;padding:18px 28px;">
          <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.5px;">CLYON</span>
        </td></tr>
        <tr><td style="padding:26px 28px;">${corpo}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function botao(url: string, texto: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <a href="${url}" style="display:inline-block;background:#00B4CC;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:10px;font-size:15px;font-weight:600;">${texto}</a>
  </td></tr></table>`;
}

async function enviar(para: string, assunto: string, html: string): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave || !para || !para.includes("@")) return false;
  try {
    const resend = new Resend(chave);
    const { error } = await resend.emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: para,
      subject: assunto,
      html,
    });
    if (error) {
      console.error("[email-proposta] Resend recusou:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email-proposta] falha ao enviar:", err);
    return false;
  }
}

// ── O profissional propôs: avisar o cliente ─────────────────────────────────

export async function avisarClienteDaProposta(p: {
  para: string;
  nomeDoCliente: string | null;
  pedidoId: number;
  profissionalNome: string;
  valor: number;
  /**
   * O link do pedido, para quem não tem conta.
   *
   * Vazio quando o cliente tem conta: aí o email aponta para /conta, e o link
   * que ele guardou continua a valer. Cada token novo mata o anterior, por
   * isso só se emite um quando não há outro caminho.
   */
  token: string;
  baseUrl?: string;
}): Promise<boolean> {
  const base = p.baseUrl ?? urlDeAccao();
  const url = p.token ? linkDoPedido(base, p.token) : `${base}/conta`;
  const nome = p.nomeDoCliente?.trim().split(/\s+/)[0];

  return enviar(
    p.para,
    `Tem uma proposta de ${p.valor.toFixed(0)} € — pedido #${p.pedidoId}`,
    moldura(`
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Pedido #${p.pedidoId}</p>
      <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0B1929;">
        ${nome ? `${e(nome)}, tem` : "Tem"} uma proposta
      </h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
        <strong>${e(p.profissionalNome)}</strong> propôs
        <strong>${euros(p.valor)}</strong> para o seu trabalho. Pode aceitar, propor
        outro valor, ou esperar por mais propostas.
      </p>
      ${botao(url, "Ver a proposta")}
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
        A proposta dura ${PRAZO_DA_PROPOSTA_HORAS} horas. Se não responder, expira e ele
        pode fazer outra.
      </p>`),
  );
}

// ── O cliente propôs: avisar o profissional ─────────────────────────────────

export async function avisarProfissionalDaProposta(p: {
  para: string;
  nomeDoProfissional: string;
  pedidoId: number;
  valor: number;
  /** O token da negociação dele. */
  token: string;
  baseUrl?: string;
}): Promise<boolean> {
  const base = p.baseUrl ?? urlDeAccao();
  const url = comChave(`${base}/profissionais/pedidos/${p.token}`);
  const nome = p.nomeDoProfissional?.trim().split(/\s+/)[0];
  const liquido = quantoOProfissionalRecebe(p.valor);

  return enviar(
    p.para,
    `Contraproposta de ${p.valor.toFixed(0)} € — pedido #${p.pedidoId}`,
    moldura(`
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Pedido #${p.pedidoId}</p>
      <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0B1929;">
        ${nome ? `${e(nome)}, o` : "O"} cliente respondeu
      </h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
        Está a propor <strong>${euros(p.valor)}</strong> — recebe
        <strong>${euros(liquido)}</strong>, já com a taxa CLYON descontada.
      </p>
      ${botao(url, "Responder")}
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
        Tem ${PRAZO_DA_PROPOSTA_HORAS} horas para responder. Depois disso a proposta
        expira — e uma proposta expirada não gasta nenhuma das suas.
      </p>`),
  );
}

/**
 * O trabalho foi confirmado — o dinheiro dele ficou disponível.
 *
 * É o email mais fácil de justificar do sistema inteiro: é a notícia de que
 * ele recebeu. Sem isto, a confirmação acontecia em silêncio — o painel só
 * actualiza quando ele lá volta, e voltava sem saber que tinha dinheiro à
 * espera. Foi exactamente o que aconteceu no primeiro trabalho fechado pela
 * plataforma: confirmado no backoffice, e o profissional sem nenhum sinal.
 *
 * Sem token e sem link mágico: a carteira exige entrar com a palavra-passe,
 * e um email sobre dinheiro não deve carregar credenciais.
 */
export async function avisarTrabalhoConfirmado(p: {
  para: string;
  nomeDoProfissional: string;
  pedidoId: number;
  /** O valor ACORDADO — o líquido calcula-se aqui, como nos outros. */
  valorAcordado: number;
  baseUrl?: string;
}): Promise<boolean> {
  const base = p.baseUrl ?? urlDeAccao();
  const url = comChave(`${base}/profissionais/painel`);
  const nome = p.nomeDoProfissional?.trim().split(/\s+/)[0];
  const liquido = quantoOProfissionalRecebe(p.valorAcordado);

  return enviar(
    p.para,
    `Trabalho #${p.pedidoId} confirmado — ${euros(liquido)} na sua carteira`,
    moldura(`
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Pedido #${p.pedidoId}</p>
      <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0B1929;">
        ${nome ? `${e(nome)}, o` : "O"} trabalho foi confirmado
      </h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
        <strong>${euros(liquido)}</strong> ficaram disponíveis na sua carteira —
        o acordado, já com a taxa CLYON descontada. Pode pedir a transferência
        quando quiser.
      </p>
      ${botao(url, "Abrir a carteira")}`),
  );
}
