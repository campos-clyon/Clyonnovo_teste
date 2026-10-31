import { comoTratar } from "./whatsapp-recolha";
import { oSeuServico } from "./servico-em-palavras";
import { enviarAvisoWhatsApp, telemovelParaWhatsApp } from "./whatsapp-cloud";
import { sendPushToUser } from "./webpush";
import { gerarTokenDeAcesso } from "./pedido-acesso";
import { substituirTokenDoPedido, type NegociacaoNoTerreno } from "./db";
import { taxasDaNegociacao } from "./taxas-plataforma";
import { precoDoCliente } from "./preco-do-cliente";
import { modeloDaNegociacao } from "./iva-incluido";
import type { Ajuste } from "./ajuste-no-local";

/**
 * O QUE O CLIENTE E O PROFISSIONAL OUVEM DO TRABALHO NO TERRENO — 18-10-2026.
 *
 * «A caminho» e «Cheguei» (decisão do dono: os dois avisam o cliente, na hora)
 * e o ajuste no local (o cliente tem de saber em minutos — a carrinha está à
 * porta). Saem por WhatsApp com `enviarAvisoWhatsApp`, a porta dos avisos
 * imediatos: respeita quem pediu para não ser avisado e não repete.
 *
 * NUNCA NUM TRABALHO CLYON DE VALOR FIXO: o cliente desses é tratado pela
 * CLYON e não recebe mensagens automáticas — a mesma regra do «está feito».
 *
 * NUNCA LANÇA: um aviso que falha não desfaz o que o profissional registou.
 */

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export function eTrabalhoClyon(n: Pick<NegociacaoNoTerreno, "ofertaClyon" | "valorFixoClyon">): boolean {
  return n.ofertaClyon != null || n.valorFixoClyon != null;
}

function sujeito(n: Pick<NegociacaoNoTerreno, "serviceType" | "pedidoId">): string {
  const s = oSeuServico(n.serviceType);
  return s === "o seu pedido" ? `o seu pedido #${n.pedidoId}` : `${s} (pedido #${n.pedidoId})`;
}

/** «o valor DA sua mudança», e não «de a sua mudança». */
function doSujeito(n: Pick<NegociacaoNoTerreno, "serviceType" | "pedidoId">): string {
  return sujeito(n).replace(/^(o|a)s? /, (m) => `d${m}`);
}

function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "O profissional";
}

export function textoACaminho(n: NegociacaoNoTerreno, agora: Date): string {
  return [
    `${comoTratar(n.contactName, agora)} Aqui é a CLYON.`,
    `${primeiroNome(n.profissionalNome)} já vai a caminho para ${sujeito(n)}.`,
    "Se precisar de lhe dizer alguma coisa, responda a esta mensagem.",
  ].join("\n\n");
}

/** «Estou próximo» (30-10-2026). */
export function textoProximo(n: NegociacaoNoTerreno, agora: Date): string {
  return [
    `${comoTratar(n.contactName, agora)} Aqui é a CLYON.`,
    `${primeiroNome(n.profissionalNome)} está quase a chegar para ${sujeito(n)}.`,
  ].join("\n\n");
}

export function textoChegou(n: NegociacaoNoTerreno, agora: Date): string {
  return [
    `${comoTratar(n.contactName, agora)} Aqui é a CLYON.`,
    `${primeiroNome(n.profissionalNome)} chegou à sua morada para ${sujeito(n)}.`,
  ].join("\n\n");
}

/** O que o cliente paga por um valor do serviço — o mesmo número do ecrã do pedido. */
function totalDoCliente(n: NegociacaoNoTerreno, valor: number): number {
  return precoDoCliente(valor, taxasDaNegociacao(n), modeloDaNegociacao(n.createdAt)).aPagar;
}

export function textoDoPedidoDeAjuste(n: NegociacaoNoTerreno, a: Ajuste, link: string, agora: Date): string {
  return [
    `${comoTratar(n.contactName, agora)} Aqui é a CLYON.`,
    `${primeiroNome(n.profissionalNome)} está no local e pede para ajustar o valor ${doSujeito(n)}: «${a.motivo}»`,
    `O total a pagar passaria de ${eur(totalDoCliente(n, a.valorAntigo))} para ${eur(totalDoCliente(n, a.valorNovo))}. ` +
      `Veja as fotografias e responda aqui: ${link}`,
    "Só muda se disser que sim. O pedido fica de pé até às 23:59 de hoje.",
  ].join("\n\n");
}

export function textoDaDescida(n: NegociacaoNoTerreno, a: Ajuste, agora: Date): string {
  return [
    `${comoTratar(n.contactName, agora)} Aqui é a CLYON.`,
    `O valor ${doSujeito(n)} baixou: o total a pagar passa de ${eur(totalDoCliente(n, a.valorAntigo))} ` +
      `para ${eur(totalDoCliente(n, a.valorNovo))}. Motivo: «${a.motivo}»`,
    "Não precisa de fazer nada.",
  ].join("\n\n");
}

async function whatsAppAoCliente(n: NegociacaoNoTerreno, texto: string): Promise<boolean> {
  const tel = telemovelParaWhatsApp(n.contactPhone);
  if (!tel) return false;
  try {
    return await enviarAvisoWhatsApp(tel, texto);
  } catch (err) {
    console.error("[avisos-do-terreno] WhatsApp ao cliente não saiu:", err);
    return false;
  }
}

/**
 * AS HORAS MARCADAS — 31-10-2026. O WhatsApp ao cliente com o resumo («O
 * parceiro marcou das … às … = N h → total …») e o pedido para confirmar no
 * pedido. Não num Trabalho CLYON (o cliente desses fala com a CLYON).
 */
export async function avisarClienteDasHoras(
  n: NegociacaoNoTerreno,
  resumoParaOCliente: string,
  agora: Date = new Date(),
): Promise<boolean> {
  if (eTrabalhoClyon(n)) return false;
  return whatsAppAoCliente(
    n,
    [
      `${comoTratar(n.contactName, agora)} Aqui é a CLYON.`,
      `Sobre ${sujeito(n)}: ${resumoParaOCliente}`,
      "Confirme as horas no seu pedido, ou diga-nos se não concorda.",
    ].join("\n\n"),
  );
}

export async function avisarClienteDaEtapa(
  n: NegociacaoNoTerreno,
  etapa: "a_caminho" | "proximo" | "chegou",
  agora: Date = new Date(),
): Promise<boolean> {
  if (eTrabalhoClyon(n)) return false;
  const texto = etapa === "a_caminho" ? textoACaminho(n, agora) : etapa === "proximo" ? textoProximo(n, agora) : textoChegou(n, agora);
  return whatsAppAoCliente(n, texto);
}

/*
 * A APP SÓ DIZ «O CLIENTE FOI AVISADO» SE FOI — 28-10-2026 (d11).
 *
 * A rota da etapa respondia antes de o WhatsApp sair (ia num `after`), e a app
 * prometia «O cliente recebe um WhatsApp na hora» sem saber. Agora a rota
 * espera pelo envio até este prazo e responde com o que aconteceu; se o envio
 * demorar mais, responde que não saiu (ainda) e o registo do pedido guarda o
 * resultado verdadeiro quando ele chegar.
 */
export const PRAZO_DO_WHATSAPP_DA_ETAPA_MS = 8_000;

/** Espera por `p` até `ms`. Se o prazo acabar primeiro, a promessa continua — quem chama pode esperar por ela depois. */
export async function dentroDoPrazo<T>(p: Promise<T>, ms: number): Promise<{ chegou: true; valor: T } | { chegou: false }> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<{ chegou: false }>((resolver) => {
    relogio = setTimeout(() => resolver({ chegou: false }), ms);
  });
  try {
    return await Promise.race([p.then((valor) => ({ chegou: true as const, valor })), prazo]);
  } finally {
    clearTimeout(relogio);
  }
}

/** O que fica no histórico do pedido e no registo: a etapa e se o cliente foi avisado. */
export function resumoDaEtapa(
  nome: string,
  etapa: "a_caminho" | "proximo" | "chegou",
  aviso: "saiu" | "saiu_com_atraso" | "nao_saiu" | "trabalho_clyon",
): string {
  const feito =
    etapa === "a_caminho" ? "saiu a caminho do cliente" : etapa === "proximo" ? "está próximo da morada do cliente" : "chegou à morada do cliente";
  const doAviso = {
    saiu: " O cliente foi avisado por WhatsApp.",
    saiu_com_atraso: " O cliente foi avisado por WhatsApp, com atraso.",
    nao_saiu: " O WhatsApp ao cliente não saiu.",
    trabalho_clyon: "",
  }[aviso];
  return `${nome} ${feito}.${doAviso}`;
}

/**
 * O pedido de ajuste ao cliente, com um link novo para ele responder.
 *
 * O link vai novo porque o antigo não é recuperável (só se guarda o hash) —
 * o mesmo que o «está feito» já faz. Devolve o link, para a app o mostrar ao
 * profissional e ele o poder mandar à mão se o WhatsApp não chegar.
 */
export async function avisarClienteDoAjuste(
  n: NegociacaoNoTerreno,
  a: Ajuste,
  baseUrl: string,
  agora: Date = new Date(),
): Promise<{ link: string | null; whatsapp: boolean }> {
  if (eTrabalhoClyon(n)) return { link: null, whatsapp: false };
  try {
    if (a.estado === "descida") {
      return { link: null, whatsapp: await whatsAppAoCliente(n, textoDaDescida(n, a, agora)) };
    }
    const novo = gerarTokenDeAcesso(agora);
    await substituirTokenDoPedido(n.pedidoId, novo.hash, novo.expiraEm);
    const link = `${baseUrl.replace(/\/$/, "")}/pedido/${novo.token}`;
    const whatsapp = await whatsAppAoCliente(n, textoDoPedidoDeAjuste(n, a, link, agora));
    if (n.contactEmail) {
      await sendPushToUser(n.contactEmail, {
        title: "Pedido de ajuste do valor",
        body: `${primeiroNome(n.profissionalNome)} pede para ajustar o valor. Toque para ver e responder.`,
        url: link,
        tag: `ajuste-${n.pedidoId}`,
      }, "cliente");
    }
    return { link, whatsapp };
  } catch (err) {
    console.error("[avisos-do-terreno] o pedido de ajuste não chegou ao cliente:", err);
    return { link: null, whatsapp: false };
  }
}

/** Ao profissional: o cliente (ou a CLYON) respondeu ao ajuste. Abre o trabalho na app. */
export async function avisarProfissionalDaResposta(n: NegociacaoNoTerreno, a: Ajuste): Promise<void> {
  if (!n.profissionalEmail) return;
  const aprovado = a.estado === "aprovado";
  await sendPushToUser(n.profissionalEmail, {
    title: aprovado ? "Ajuste aprovado" : "Ajuste recusado",
    body: aprovado
      ? `O valor passou para ${eur(a.valorNovo)}. Pode avançar.`
      : `O valor fica em ${eur(a.valorAntigo)}. Veja as opções no trabalho.`,
    url: "/profissionais/painel",
    tag: `ajuste-${n.pedidoId}`,
    negociacaoId: n.id,
  }, "pro");
}
