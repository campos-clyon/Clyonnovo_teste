import { Resend } from "resend";
import { notaDaCargaParaOCliente, precoComBase, type BaseDoPreco } from "./base-do-preco";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { e } from "./escapar-html";
import { linkDoPedido } from "./pedido-acesso";
import { urlDeAccao } from "./url-do-site";
import { comChave } from "./acesso-mvp";
import { quantoOProfissionalRecebe, type Taxas } from "./taxas-plataforma";
import type { DestinoDoValor } from "./carteira";
import { BUSINESS_EMAIL } from "./seo-data";


/**
 * O aviso de que há uma proposta à espera.
 *
 * Sem isto, a negociação só existia para quem tivesse o ecrã aberto — perder um
 * trabalho porque ninguém foi ver a página é a forma mais estúpida de o perder.
 * Desde 20-09-2026 a proposta já não morre à espera (ver `AS_PROPOSTAS_EXPIRAM`),
 * mas o aviso conta mais, não menos: é a única coisa que traz a pessoa de volta,
 * e agora não há prazo nenhum a fazer-lhe pressão por ela.
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
      // Quem responde a um aviso fala com alguém, e não com o `noreply`.
      replyTo: BUSINESS_EMAIL,
      to: para,
      subject: assunto,
      html: legivelNoResumo(html),
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
  /**
   * O PREÇO DELE — o que paga, já com a taxa CLYON, sem IVA. Ver
   * `preco-do-cliente.ts`. Chama-se `preco`, e não `valor`, para ninguém lhe
   * passar o valor do profissional sem dar por isso: era o que isto recebia
   * até 29-09-2026.
   */
  preco: number;
  /**
   * O PREÇO JÁ LEVA O IVA? — 01-10-2026, obrigatório. Com IVA incluído desde
   * `IVA_INCLUIDO_DESDE`; sem IVA nas negociações abertas antes do corte.
   */
  ivaIncluido: boolean;
  /** Pelo trabalho todo, ou por carga. Por carga, o valor leva a unidade. */
  base?: BaseDoPreco;
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
    // O preço inteiro, com os cêntimos: com a taxa lá dentro, 367,50 € a
    // arredondar para «368 €» no assunto era um número que não está em lado
    // nenhum do ecrã.
    `Tem uma proposta de ${precoComBase(euros(p.preco), p.base ?? "total")} — pedido #${p.pedidoId}`,
    moldura(`
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Pedido #${p.pedidoId}</p>
      <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0B1929;">
        ${nome ? `${e(nome)}, tem` : "Tem"} uma proposta
      </h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
        <strong>${e(p.profissionalNome)}</strong> propôs
        <strong>${precoComBase(euros(p.preco), p.base ?? "total")}</strong> para o seu trabalho,
        ${p.ivaIncluido ? "com IVA incluído" : "sem IVA"}. Pode aceitar, propor outro valor, ou esperar por mais propostas.
      </p>
      ${
        notaDaCargaParaOCliente(p.base ?? "total")
          ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#92400e;">${e(notaDaCargaParaOCliente(p.base ?? "total") as string)}</p>`
          : ""
      }
      ${botao(url, "Ver a proposta")}
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
        A proposta fica de pé até lhe responder. Pode demorar o tempo que precisar
        para decidir.
      </p>`),
  );
}

// ── O cliente propôs: avisar o profissional ─────────────────────────────────

export async function avisarProfissionalDaProposta(p: {
  para: string;
  nomeDoProfissional: string;
  pedidoId: number;
  valor: number;
  /** Pelo trabalho todo, ou por carga. Por carga, o valor leva a unidade. */
  base?: BaseDoPreco;
  /**
   * As taxas DESTA negociação — obrigatórias de propósito.
   *
   * O líquido saía das de origem (6 %) escritas no código, e a 29-09-2026 a
   * comissão passou a ser 11 % do que o cliente paga: 6,55 % ao profissional.
   * O email prometia-lhe 1,92 € a mais por cada 350 € — por escrito.
   */
  taxas: Taxas;
  /** O token da negociação dele. */
  token: string;
  baseUrl?: string;
}): Promise<boolean> {
  const base = p.baseUrl ?? urlDeAccao();
  const url = comChave(`${base}/profissionais/pedidos/${p.token}`);
  const nome = p.nomeDoProfissional?.trim().split(/\s+/)[0];
  const liquido = quantoOProfissionalRecebe(p.valor, p.taxas);

  return enviar(
    p.para,
    `Contraproposta de ${precoComBase(`${p.valor.toFixed(0)} €`, p.base ?? "total")} — pedido #${p.pedidoId}`,
    moldura(`
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Pedido #${p.pedidoId}</p>
      <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0B1929;">
        ${nome ? `${e(nome)}, o` : "O"} cliente respondeu
      </h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
        Está a propor <strong>${precoComBase(euros(p.valor), p.base ?? "total")}</strong> — recebe
        <strong>${precoComBase(euros(liquido), p.base ?? "total")}</strong>, já com a taxa CLYON descontada.
      </p>
      ${botao(url, "Responder")}
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
        A contraproposta fica à sua espera — não tem prazo. Quanto mais cedo
        responder, menos hipóteses há de o cliente fechar com outro.
      </p>`),
  );
}

/**
 * O QUE O EMAIL DO TRABALHO CONFIRMADO DIZ, conforme o dinheiro — 29-09-2026.
 *
 * Dizia sempre «ficaram disponíveis na sua carteira — pode pedir a
 * transferência quando quiser». Em três casos, só um é esse:
 *
 *   · DISPONÍVEL — pago pela plataforma e confirmado: aí sim, está na
 *     carteira e pode pedir o levantamento;
 *   · POR COBRAR — confirmado, mas o cliente ainda não pagou: prometer-lhe
 *     uma transferência era a CLYON a oferecer dinheiro que não recebeu;
 *   · EM MÃO — pago em dinheiro, no local: não há nada a transferir, e
 *     mandá-lo à carteira era mandá-lo procurar o que já tem no bolso.
 *
 * Quem decide qual dos três é `destinoDoValorConcluido`, em `carteira.ts` —
 * a mesma regra da carteira, para o email nunca dizer outra coisa do que o
 * painel. Função pura, para os três casos se poderem provar sem mandar nada.
 */
export function textoDoTrabalhoConfirmado(p: {
  pedidoId: number;
  /** O que lhe fica deste trabalho — já com as taxas DA negociação. */
  liquido: number;
  destino: DestinoDoValor;
  /**
   * EM DINHEIRO COM IVA INCLUÍDO, O QUE ELE DEVE À CLYON — 01-10-2026, e a
   * referência para o pagar, quando já foi gerada. Ver
   * `cobrar-divida-do-profissional.ts`.
   */
  divida?: DividaNoEmail | null;
}): { assunto: string; corpo: string; botao: string } {
  const valor = `<strong>${euros(p.liquido)}</strong>`;
  if (p.destino === "em_mao" && p.divida) {
    /*
     * "O cliente paga ao profissional, no local, o preço COM IVA; o
     *  profissional fica a DEVER à CLYON o IVA + a comissão, e paga essa
     *  dívida por referência, gerada quando o trabalho em dinheiro é
     *  confirmado." — decisão do dono, 01-10-2026.
     *
     * O email da confirmação é o momento em que a dívida nasce: diz o que é
     * dele, o que é da CLYON e porquê, e traz a referência quando a há.
     */
    const d = p.divida;
    const ref = d.referencia;
    const comoPagar = ref
      ? `Pague-os por Multibanco — Entidade <strong>${e(ref.entidade ?? "—")}</strong>, ` +
        `Referência <strong>${e(ref.referencia ?? "—")}</strong>, Valor <strong>${euros(d.total)}</strong>` +
        (ref.expiraEm ? `, válida até ${dataCurta(ref.expiraEm)}` : "") +
        ". Também a encontra na sua carteira, em «A pagar à CLYON», onde pode pedir uma por MB WAY."
      : "A referência para os pagar está na sua carteira, em «A pagar à CLYON» — por Multibanco ou MB WAY.";
    return {
      assunto: `Trabalho #${p.pedidoId} confirmado — entregue à CLYON o IVA e a comissão`,
      corpo:
        `Este trabalho foi pago em dinheiro no local, com IVA incluído: dos ` +
        `${euros(d.recebidoDoCliente)} que recebeu, ${valor} são seus. Os ` +
        `<strong>${euros(d.total)}</strong> restantes — ${euros(d.iva)} de IVA e ` +
        `${euros(d.comissao)} de comissão — são da CLYON. ${comoPagar}`,
      botao: "Abrir a carteira",
    };
  }
  if (p.destino === "em_mao") {
    return {
      assunto: `Trabalho #${p.pedidoId} confirmado — pago em dinheiro, no local`,
      corpo:
        `Este trabalho foi pago em dinheiro no local: os ${valor} já estão consigo, ` +
        "e não há nada a transferir.",
      botao: "Abrir o painel",
    };
  }
  if (p.destino === "por_cobrar") {
    return {
      assunto: `Trabalho #${p.pedidoId} confirmado — à espera do pagamento do cliente`,
      corpo:
        `Os ${valor} — o acordado, já com a taxa CLYON descontada — passam para a sua ` +
        "carteira assim que o pagamento do cliente entrar.",
      botao: "Abrir a carteira",
    };
  }
  return {
    assunto: `Trabalho #${p.pedidoId} confirmado — ${euros(p.liquido)} na sua carteira`,
    corpo:
      `${valor} ficaram disponíveis na sua carteira — o acordado, já com a taxa CLYON ` +
      "descontada. Pode pedir a transferência quando quiser: o pedido de levantamento é " +
      "tratado em menos de 24 horas.",
    botao: "Abrir a carteira",
  };
}

/**
 * O trabalho foi confirmado — e o que isso quer dizer ao dinheiro dele.
 *
 * É o email mais fácil de justificar do sistema inteiro: é a notícia do fim
 * do trabalho. Sem isto, a confirmação acontecia em silêncio — o painel só
 * actualiza quando ele lá volta, e voltava sem saber o que tinha mudado. Foi
 * exactamente o que aconteceu no primeiro trabalho fechado pela plataforma:
 * confirmado no backoffice, e o profissional sem nenhum sinal.
 *
 * Sem token e sem link mágico: a carteira exige entrar com a palavra-passe,
 * e um email sobre dinheiro não deve carregar credenciais.
 */
/** A dívida do dinheiro com IVA incluído, como o email a diz. */
export type DividaNoEmail = {
  recebidoDoCliente: number;
  iva: number;
  comissao: number;
  total: number;
  referencia?: { entidade: string | null; referencia: string | null; expiraEm: Date | null } | null;
};

function dataCurta(d: Date): string {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export async function avisarTrabalhoConfirmado(p: {
  para: string;
  nomeDoProfissional: string;
  pedidoId: number;
  /** O valor ACORDADO — o líquido calcula-se aqui, como nos outros. */
  valorAcordado: number;
  /**
   * As taxas DESTA negociação — obrigatórias pela mesma razão do aviso da
   * contraproposta. Em dinheiro, a comissão dele é zero: sem isto o email
   * dizia-lhe que a carteira tinha 94 % do que ele recebeu em mão.
   */
  taxas: Taxas;
  /**
   * Onde fica o valor — obrigatório de propósito. Ver
   * `textoDoTrabalhoConfirmado`: esquecê-lo era voltar a prometer a todos uma
   * transferência.
   */
  destino: DestinoDoValor;
  /** Em dinheiro com IVA incluído: o que ele deve à CLYON, e a referência. */
  divida?: DividaNoEmail | null;
  baseUrl?: string;
}): Promise<boolean> {
  const base = p.baseUrl ?? urlDeAccao();
  const url = comChave(`${base}/profissionais/painel`);
  const nome = p.nomeDoProfissional?.trim().split(/\s+/)[0];
  const liquido = quantoOProfissionalRecebe(p.valorAcordado, p.taxas);
  const t = textoDoTrabalhoConfirmado({
    pedidoId: p.pedidoId,
    liquido,
    destino: p.destino,
    divida: p.divida ?? null,
  });

  return enviar(
    p.para,
    t.assunto,
    moldura(`
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Pedido #${p.pedidoId}</p>
      <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0B1929;">
        ${nome ? `${e(nome)}, o` : "O"} trabalho foi confirmado
      </h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
        ${t.corpo}
      </p>
      ${botao(url, t.botao)}`),
  );
}
