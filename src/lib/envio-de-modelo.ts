import { EQUIPA_DA_CLYON_NO_MODELO, PODE_RESPONDER_COM_O_QUE_FALTA } from "./mensagem-do-que-falta";
import { SE_JA_NAO_PRECISAR } from "./lembrete-do-que-falta";
import { semMarcaDeMao } from "./rajada-do-whatsapp";

/**
 * O ENVIO DE MODELO — 22-11-2026 (decisão d86).
 *
 * A equipa carregou em «Pedir o que falta» num pedido em «precisa info»; saiu
 * pelo WhatsApp a mensagem de modelo (`mensagemDoQueFalta`), a cliente
 * respondeu catorze minutos depois com tudo menos a fotografia — e a Vitória
 * calou-se e nada entrou no pedido. A mensagem sai pela mão da equipa (o
 * WhatsApp dela abre com o texto pronto), e por isso chega ao fio como escrita
 * à mão («[à mão]»): a ponte entregava a conversa a uma pessoa e a regra das
 * 12 horas da d73 (`aEquipaFalouHaPouco`) calava a Vitória.
 *
 * Uma mensagem de modelo que PEDE dados ao cliente não é a equipa a conversar:
 * é um pedido feito com as palavras do sistema. Não entrega a conversa, não
 * conta para as 12 horas, e a resposta do cliente é da Vitória
 * (`resposta-ao-que-falta.ts`). Uma mensagem da equipa escrita à mão DEPOIS
 * dele volta a valer como sempre.
 *
 * Não há marca nenhuma que a ponte possa pôr: quem envia é uma pessoa, no
 * WhatsApp dela. Reconhece-se pelos marcadores estáveis do modelo — as duas
 * frases fixas e o número do pedido — e nunca por semelhança:
 *
 *   · o «Pedir o que falta» (d31): «Aqui é a equipa da CLYON.» e «Pode
 *     responder a esta mensagem com o que falta.»;
 *   · os lembretes do que falta (d71), que saem pela fila do site: «Aqui é a
 *     equipa da CLYON» e «Se já não precisar do orçamento, responda 2…».
 *
 * Se a equipa mudar o texto no WhatsApp antes de o enviar (tirar uma das
 * frases), deixa de ser o modelo: conta como escrito à mão, como hoje.
 */

/** Sem quebras de linha nem espaços a mais — o WhatsApp pode trocar «\n» por «\r\n». */
function plano(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** O número do pedido do modelo: «o seu pedido #812», «sobre o seu pedido #812». */
const PEDIDO_DO_MODELO = /\bpedido #(\d{1,7})\b/;

/**
 * O PEDIDO DE UM ENVIO DE MODELO QUE PEDE DADOS AO CLIENTE — o número do
 * pedido, ou null quando não é um. Com ou sem a marca «[à mão]» à frente.
 */
export function pedidoDoEnvioDeModelo(texto: string | null | undefined): number | null {
  if (typeof texto !== "string") return null;
  const t = plano(semMarcaDeMao(texto));
  if (!t.includes(plano(EQUIPA_DA_CLYON_NO_MODELO).replace(/\.$/, ""))) return null;
  const doQueFalta = t.includes(plano(PODE_RESPONDER_COM_O_QUE_FALTA).replace(/\.$/, ""));
  const doLembrete = t.includes(plano(SE_JA_NAO_PRECISAR));
  if (!doQueFalta && !doLembrete) return null;
  const m = PEDIDO_DO_MODELO.exec(t);
  const id = m ? Number(m[1]) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** É um envio de modelo que pede dados ao cliente? */
export function eEnvioDeModelo(texto: string | null | undefined): boolean {
  return pedidoDoEnvioDeModelo(texto) != null;
}
