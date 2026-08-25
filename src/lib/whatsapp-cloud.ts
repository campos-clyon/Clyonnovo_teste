import crypto from "node:crypto";

/**
 * O WhatsApp como ecrã do cliente — o transporte, e só ele.
 *
 * A VISÃO, nas palavras dele: "seria como se o site falasse com o cliente,
 * como se o WhatsApp fosse a tela do cliente no site, onde ele pode receber
 * as propostas, contrapropor, aceitar e até escolher data — tudo falando com
 * o site". Hoje é ele a escrever as propostas à mão no WhatsApp pessoal.
 *
 * Este ficheiro fala com a API OFICIAL (Meta Cloud API) e nada mais: enviar
 * texto, enviar botões, validar a assinatura do webhook. A decisão de QUANDO
 * falar e O QUE fazer com as respostas vive noutro sítio — o motor da
 * negociação não sabe que o WhatsApp existe, como nunca soube que o browser
 * existia.
 *
 * PORQUE A API OFICIAL E NÃO UMA BIBLIOTECA "whatsapp-web"
 *
 * As bibliotecas que fingem ser um telemóvel violam os termos do WhatsApp e
 * acabam com o número banido — o número do NEGÓCIO, com as conversas dos
 * clientes lá dentro. A Cloud API é gratuita nas conversas de serviço e é
 * feita para isto.
 *
 * FALHA FECHADA: sem as quatro variáveis de ambiente, tudo aqui devolve
 * false/erro sem lançar — o site funciona como antes, e o painel continua a
 * ser o caminho.
 */

const API = "https://graph.facebook.com/v21.0";

export function whatsappConfigurado(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_VERIFY_TOKEN &&
      process.env.WHATSAPP_APP_SECRET,
  );
}

/** Normaliza um telefone para o formato da API: dígitos, com indicativo. */
export function telefoneParaWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  // Nove dígitos a começar em 9: número português sem indicativo.
  if (/^9\d{8}$/.test(digitos)) return `351${digitos}`;
  return digitos;
}

async function enviar(corpo: Record<string, unknown>): Promise<boolean> {
  if (!whatsappConfigurado()) return false;
  try {
    const res = await fetch(
      `${API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({ messaging_product: "whatsapp", ...corpo }),
      },
    );
    if (!res.ok) {
      // O corpo do erro da Meta diz porquê (janela de 24 h fechada, template
      // em falta, número não registado) — sem ele, cada falha é um mistério.
      console.error("[whatsapp] envio falhou", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[whatsapp] envio falhou", e);
    return false;
  }
}

export async function enviarTextoWhatsApp(para: string, texto: string): Promise<boolean> {
  return enviar({
    to: telefoneParaWhatsApp(para),
    type: "text",
    text: { body: texto.slice(0, 4096), preview_url: false },
  });
}

/**
 * Mensagem com botões de resposta — o "ecrã" da negociação.
 *
 * Três botões no máximo (limite da API), 20 caracteres por título. O id de
 * cada botão volta intacto no webhook: é lá que se codifica a acção e a
 * negociação ("ct:123" = contratar a #123), para a resposta não depender de
 * interpretar texto livre.
 */
export async function enviarBotoesWhatsApp(
  para: string,
  texto: string,
  botoes: Array<{ id: string; titulo: string }>,
): Promise<boolean> {
  return enviar({
    to: telefoneParaWhatsApp(para),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: texto.slice(0, 1024) },
      action: {
        buttons: botoes.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id.slice(0, 256), title: b.titulo.slice(0, 20) },
        })),
      },
    },
  });
}

/**
 * A assinatura do webhook — sem ela, qualquer pessoa que descubra o endereço
 * "responde" pelos clientes. A Meta assina cada entrega com HMAC-SHA256 do
 * corpo cru; compara-se em tempo constante.
 */
export function assinaturaValida(corpoCru: string, cabecalho: string | null): boolean {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  if (!segredo || !cabecalho?.startsWith("sha256=")) return false;
  const esperada = crypto.createHmac("sha256", segredo).update(corpoCru, "utf8").digest("hex");
  const recebida = cabecalho.slice("sha256=".length);
  try {
    return crypto.timingSafeEqual(Buffer.from(esperada, "hex"), Buffer.from(recebida, "hex"));
  } catch {
    return false;
  }
}
