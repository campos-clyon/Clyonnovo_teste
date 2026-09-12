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

/**
 * O TERCEIRO CAMINHO: O NÚMERO À MÃO.
 *
 * "Também quero que ative o WhatsApp no painel sem a API por agora, pois
 * ainda não temos a API da Meta. Vamos ativar o número 931632622 por
 * enquanto." — 09-09-2026.
 *
 * Sem Meta e sem ponte, o site não tinha por onde falar: tudo devolvia false
 * e o cérebro calava-se. Agora há um caminho de pessoas: o que o cérebro
 * escreve fica na fila, e o painel mostra cada mensagem com um botão que
 * abre o WhatsApp do número da CLYON já com o texto e o destinatário — quem
 * está no backoffice carrega em enviar e marca como enviada. Não é
 * automático, mas é o que se faz hoje à mão, sem a pessoa ter de escrever
 * as propostas.
 *
 * O QUE NÃO FAZ SOZINHO: ler respostas. Sem API não há webhook; o que o
 * cliente responder chega ao WhatsApp Web (ou ao telemóvel) e não ao site.
 * Quem está no painel cola-a em "Chegou uma resposta" e o cérebro trata-a
 * como se tivesse entrado pela API — a resposta dele fica na fila, para sair
 * pelo WhatsApp Web com um clique.
 *
 * O número é o da CLYON, público em todo o site. Muda-se com
 * WHATSAPP_NUMERO_MANUAL; "off" desliga este caminho. A Meta e a ponte, quando
 * existirem, mandam sobre isto sem mais nada mudar.
 */
export const NUMERO_MANUAL_POR_OMISSAO = "351931632622";

export function numeroManualWhatsApp(): string | null {
  const bruto = (process.env.WHATSAPP_NUMERO_MANUAL ?? "").trim();
  if (bruto.toLowerCase() === "off") return null;
  const digitos = telefoneParaWhatsApp(bruto || NUMERO_MANUAL_POR_OMISSAO);
  return digitos.length >= 9 ? digitos : null;
}

/** O caminho à mão está de pé? Só quando não há nenhum automático. */
export function manualActivo(): boolean {
  return !whatsappConfigurado() && !ponteConfigurada() && numeroManualWhatsApp() !== null;
}

export type CanalWhatsApp = "meta" | "ponte" | "manual" | "nenhum";

/** Por onde saem as mensagens hoje — o painel diz isto em letras grandes. */
export function canalWhatsApp(): CanalWhatsApp {
  if (whatsappConfigurado()) return "meta";
  if (ponteConfigurada()) return "ponte";
  if (manualActivo()) return "manual";
  return "nenhum";
}

/** O link que abre o WhatsApp já com o destinatário e o texto — o gesto do caminho à mão. */
export function linkParaEnviarAMao(para: string, texto: string): string {
  return `https://wa.me/${telefoneParaWhatsApp(para)}?text=${encodeURIComponent(texto)}`;
}

/**
 * O mesmo gesto, mas no WhatsApp Web do computador — "ative usando o WhatsApp
 * Web por enquanto", 09-09-2026. O wa.me no PC pergunta primeiro se quer
 * abrir a aplicação; este endereço vai direito à conversa no separador do
 * web.whatsapp.com, onde o número da CLYON está emparelhado.
 */
export function linkParaEnviarNoWhatsAppWeb(para: string, texto: string): string {
  return `https://web.whatsapp.com/send?phone=${telefoneParaWhatsApp(para)}&text=${encodeURIComponent(texto)}`;
}

/** Há ALGUM caminho para falar com o cliente por WhatsApp? */
export function whatsappActivo(): boolean {
  return whatsappConfigurado() || ponteConfigurada() || manualActivo();
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
/**
 * O TECLADO DE QUEM ESTÁ DO OUTRO LADO.
 *
 * "Usa caracteres especiais sem precisar." As mensagens saíam com aspas
 * angulares («»), travessões longos (—) e pontos médios (·) — sinais de
 * tipografia de livro que ninguém escreve num telemóvel, e que num balão de
 * WhatsApp denunciam imediatamente que do outro lado está uma máquina.
 *
 * Aqui e não em cada frase: este é o estrangulamento por onde sai TUDO —
 * recolha, releitura e negociação, pelos três canais. Corrigir as trinta e
 * tal frases uma a uma deixava sempre a próxima por corrigir.
 *
 * Os acentos ficam, claro: «não» é português, «—» é tipografia.
 */
export function paraTeclado(texto: string): string {
  return texto
    .replace(/[«»“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*[—–]\s*/g, " - ")
    .replace(/\s*·\s*/g, ", ")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}

async function enviarTextoPorCanal(para: string, texto: string): Promise<boolean> {
  texto = paraTeclado(texto);
  let saiu = false;
  if (whatsappConfigurado()) {
    saiu = await enviar({
      to: telefoneParaWhatsApp(para),
      type: "text",
      text: { body: texto.slice(0, 4096), preview_url: false },
    });
  } else if (ponteConfigurada()) {
    saiu = await porNaFila(para, texto);
  } else if (manualActivo()) {
    // À mão: fica na fila para o painel, e só se regista como saída quando
    // alguém a marcar como enviada — antes disso ainda não saiu de lado nenhum.
    return porNaFila(para, texto);
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
    /*
     * Pela ponte não há botões — o whatsapp-web não os tem.
     *
     * ANTES ACRESCENTAVA-SE UM MANUAL DE INSTRUÇÕES: «Para "Fechar 300 €",
     * responda SIM. Para "Recusar", responda NÃO.» Ensinar o cliente a falar
     * por palavras-chave é a conversa de máquina que se quer acabar — e era
     * preciso porque do lado de cá só se liam expressões regulares.
     *
     * Deixou de ser. A mensagem convida a escrever à vontade, e quem lê a
     * resposta é o Gemini (ver `traduzirParaAMaquina` em whatsapp-negociacao).
     * O texto vai como foi escrito.
     */
    const degradado = texto;
    const saiu = await porNaFila(para, degradado);
    if (saiu) await registarSaida(para, degradado);
    return saiu;
  }
  if (manualActivo()) {
    // À mão também não há botões — e, pela mesma razão da ponte, também não
    // há manual de instruções: vai o texto, e a resposta lê-se do outro lado.
    return porNaFila(para, texto);
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
