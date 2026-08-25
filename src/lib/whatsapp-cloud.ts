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
 * DOIS CAMINHOS PARA FORA, POR ESTA ORDEM:
 *
 * 1. A Cloud API da Meta, quando as quatro variáveis dela existem — é a via
 *    oficial, com botões interactivos e sem risco para o número.
 * 2. A PONTE do Winapp, quando só PONTE_WHATSAPP_SEGREDO existe: as mensagens
 *    ficam na fila (whatsappFila) e o Winapp — que corre no PC com o WhatsApp
 *    emparelhado via whatsapp-web.js — vem buscá-las e envia-as. Os botões
 *    degradam para instruções SIM/NÃO em texto, porque esse canal não tem
 *    botões. AVISO ASSUMIDO: o whatsapp-web.js viola os termos do WhatsApp e
 *    o número pode ser banido; é o canal que a CLYON já usa hoje no Winapp, e
 *    a decisão de o usar é do dono. No dia em que a Meta estiver configurada,
 *    a via 1 passa a mandar sozinha — nada mais muda.
 *
 * FALHA FECHADA: sem nenhuma das duas, tudo aqui devolve false sem lançar —
 * o site funciona como antes, e o painel continua a ser o caminho.
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

/** A ponte do Winapp está combinada? (O segredo é o aperto de mão dela.) */
export function ponteConfigurada(): boolean {
  return Boolean(process.env.PONTE_WHATSAPP_SEGREDO);
}

/** Há ALGUM caminho para falar com o cliente por WhatsApp? */
export function whatsappActivo(): boolean {
  return whatsappConfigurado() || ponteConfigurada();
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

/** Deixa a mensagem na fila para o Winapp a vir buscar. */
async function porNaFila(para: string, texto: string): Promise<boolean> {
  try {
    const { guardarNaFilaWhatsApp } = await import("@/lib/db");
    await guardarNaFilaWhatsApp(telefoneParaWhatsApp(para), texto.slice(0, 4096));
    return true;
  } catch (e) {
    console.error("[whatsapp] fila falhou", e);
    return false;
  }
}

/** O gesto do painel manda em tudo: desligado, bloqueado ou interrompido — cala. */
async function autorizadoAFalarCom(para: string): Promise<boolean> {
  try {
    const { podeOWhatsAppFalarCom } = await import("@/lib/db");
    return await podeOWhatsAppFalarCom(telefoneParaWhatsApp(para));
  } catch {
    return false;
  }
}

/** O que saiu fica no registo — é o que faz o painel mostrar a conversa. */
async function registarSaida(para: string, texto: string): Promise<void> {
  try {
    const { registarMensagemWhatsApp } = await import("@/lib/db");
    await registarMensagemWhatsApp(telefoneParaWhatsApp(para), "out", texto);
  } catch {
    // O registo nunca pode impedir a mensagem — já saiu.
  }
}

/** O caminho comum dos envios de texto: canal, e registo se saiu. */
async function enviarTextoPorCanal(para: string, texto: string): Promise<boolean> {
  let saiu = false;
  if (whatsappConfigurado()) {
    saiu = await enviar({
      to: telefoneParaWhatsApp(para),
      type: "text",
      text: { body: texto.slice(0, 4096), preview_url: false },
    });
  } else if (ponteConfigurada()) {
    saiu = await porNaFila(para, texto);
  }
  if (saiu) await registarSaida(para, texto);
  return saiu;
}

export async function enviarTextoWhatsApp(para: string, texto: string): Promise<boolean> {
  if (!(await autorizadoAFalarCom(para))) return false;
  return enviarTextoPorCanal(para, texto);
}

/**
 * O envio À MÃO, do painel. NÃO passa pelo portão de propósito: o portão
 * cala o CÉREBRO (interruptor, bloqueio, conversa entregue) — aqui quem
 * escreve é a pessoa, e a pessoa manda no portão, não o contrário. O único
 * não que resta é o do próprio WhatsApp (janela de 24 h fechada).
 */
export async function enviarTextoManualWhatsApp(para: string, texto: string): Promise<boolean> {
  return enviarTextoPorCanal(para, texto);
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
  if (!(await autorizadoAFalarCom(para))) return false;
  if (whatsappConfigurado()) {
    const saiu = await enviar({
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
    if (saiu) {
      await registarSaida(
        para,
        `${texto}\n[botões: ${botoes.slice(0, 3).map((b) => b.titulo).join(" · ")}]`,
      );
    }
    return saiu;
  }
  if (ponteConfigurada()) {
    // Pela ponte não há botões — o whatsapp-web não os tem. O botão vira a
    // sua instrução em palavras, e o cérebro entende SIM e NÃO do outro lado.
    const instrucoes = botoes
      .slice(0, 3)
      .map((b) => {
        if (b.id.startsWith("ct:")) return `Para «${b.titulo}», responda SIM.`;
        if (b.id.startsWith("rc:")) return `Para «${b.titulo}», responda NÃO.`;
        return `— ${b.titulo}`;
      })
      .join("\n");
    const degradado = `${texto}\n\n${instrucoes}`;
    const saiu = await porNaFila(para, degradado);
    if (saiu) await registarSaida(para, degradado);
    return saiu;
  }
  return false;
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
