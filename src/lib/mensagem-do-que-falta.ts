import { pecasEmLisboa } from "./hora-de-lisboa";
import { linkDeWhatsApp } from "./link-de-whatsapp";
import { servicoEmPalavras } from "./servico-em-palavras";

/**
 * A MENSAGEM QUE PEDE AO CLIENTE O QUE FALTA NO PEDIDO — 26-10-2026 (d31).
 *
 * *«Boa tarde, aqui é a equipa da CLYON, estamos a entrar em contacto devido
 * ao pedido #N. Gostaríamos que nos ajudasse com algumas informações que
 * estão em falta: por exemplo, falta a imagem do objecto — precisamos dela
 * para analisar e enviar um orçamento mais adequado.»* — o dono. Se falta a
 * morada, pede a morada; se falta o elevador, pede o elevador; se faltam
 * várias, pede todas.
 *
 * O que falta decide-o `oQueFaltaNoPedido` (`o-que-falta-no-pedido.ts`, do
 * lado do servidor); aqui só se escreve. Este ficheiro não fala com a base:
 * é o painel da Mesa que o usa para abrir o WhatsApp ou o email com a
 * mensagem pronta. NADA SE ENVIA SOZINHO — quem envia é a pessoa da equipa.
 *
 * O tom é o da mensagem de adjudicação (`mensagem-de-adjudicacao.ts`): uma
 * pessoa a escrever, sem emojis nem caracteres que cheguem ao cliente como
 * «?» (nada de reticências, travessões ou aspas tipográficas no corpo). Sem
 * preços, e só com o pedido de quem a recebe.
 */

/**
 * Tudo o que pode faltar, PELA ORDEM EM QUE SE PEDE: primeiro o que mostra o
 * trabalho (fotografias, o que é, quanto é), depois onde é, quando, e o nome.
 */
export const CHAVES_DAS_FALTAS = [
  "servico",
  "fotografias",
  "descricao",
  "volume",
  "tipologia",
  "morada",
  "numeroDaPorta",
  "codigoPostal",
  "localidade",
  "andar",
  "elevador",
  "estacionamento",
  "moradaDestino",
  "codigoPostalDestino",
  "localidadeDestino",
  "andarDestino",
  "elevadorDestino",
  "estacionamentoDestino",
  "data",
  "nome",
] as const;

export type ChaveDaFalta = (typeof CHAVES_DAS_FALTAS)[number];

/** O pedido, no que a mensagem precisa dele: o número, o serviço e a localidade. */
export type PedidoDaMensagem = {
  id: number;
  serviceType?: string | null;
  city?: string | null;
};

export type CanalDoPedido = "whatsapp" | "email" | "copiar";

const limpo = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const RECOLHA = new Set(["recolha_moveis", "recolha_monos"]);
const ESVAZIAMENTO = new Set([
  "esvaziamento_casa",
  "esvaziamento_apartamento",
  "esvaziamento_garagem",
  "esvaziamento_sotao",
  "esvaziamento_cave",
]);

/** Uma chave que o painel recebeu e esta lista conhece — o resto deita-se fora. */
export function eChaveDaFalta(v: unknown): v is ChaveDaFalta {
  return typeof v === "string" && (CHAVES_DAS_FALTAS as readonly string[]).includes(v);
}

/** As faltas pela ordem de pedir, sem repetidas nem desconhecidas. */
export function arrumarAsFaltas(faltas: readonly unknown[] | null | undefined): ChaveDaFalta[] {
  const dadas = new Set((faltas ?? []).filter(eChaveDaFalta));
  return CHAVES_DAS_FALTAS.filter((c) => dadas.has(c));
}

/**
 * O NOME CURTO DE CADA FALTA — para a lista do botão e para o histórico do
 * pedido. «fotografias», «número da porta», «elevador».
 */
export function rotuloDaFalta(chave: ChaveDaFalta, servico?: string | null): string {
  const s = limpo(servico);
  switch (chave) {
    case "servico":
      return "serviço";
    case "fotografias":
      return "fotografias";
    case "descricao":
      if (s === "mudanca") return "o que é para mudar";
      if (s === "manutencao_casa") return "o que é para reparar";
      if (s === "recolha_entulho") return "de que é o entulho";
      if (ESVAZIAMENTO.has(s)) return "o que é para esvaziar";
      if (RECOLHA.has(s)) return "o que é para levar";
      return "o que é para fazer";
    case "volume":
      return "quantidade de entulho";
    case "tipologia":
      return "tipologia da casa";
    case "morada":
      return "morada";
    case "numeroDaPorta":
      return "número da porta";
    case "codigoPostal":
      return "código postal";
    case "localidade":
      return "localidade";
    case "andar":
      return "andar";
    case "elevador":
      return "elevador";
    case "estacionamento":
      return "estacionamento";
    case "moradaDestino":
      return "morada de destino";
    case "codigoPostalDestino":
      return "código postal do destino";
    case "localidadeDestino":
      return "localidade do destino";
    case "andarDestino":
      return "andar no destino";
    case "elevadorDestino":
      return "elevador no destino";
    case "estacionamentoDestino":
      return "estacionamento no destino";
    case "data":
      return "data pretendida";
    case "nome":
      return "nome";
  }
}

/**
 * A LINHA DA MENSAGEM PARA CADA FALTA — o que se pede e, quando ajuda, o
 * porquê, curto: «Fotografias do que é para levar, para os profissionais
 * avaliarem o volume.»
 */
export function linhaDaFalta(chave: ChaveDaFalta, servico?: string | null): string {
  const s = limpo(servico);
  const mudanca = s === "mudanca";
  const origem = mudanca ? " de origem" : "";
  switch (chave) {
    case "servico":
      return "Que serviço precisa: recolha, esvaziamento, mudança ou manutenção da casa.";
    case "fotografias":
      if (mudanca) return "Algumas fotografias das divisões e dos móveis maiores, para os parceiros avaliarem o volume.";
      if (s === "manutencao_casa") return "Fotografias do que é para reparar, para os parceiros perceberem o trabalho.";
      if (s === "recolha_entulho") return "Fotografias do entulho, para os parceiros avaliarem o volume.";
      if (ESVAZIAMENTO.has(s)) return "Fotografias das divisões a esvaziar, para os parceiros avaliarem o volume.";
      if (RECOLHA.has(s)) return "Fotografias do que é para levar, para os parceiros avaliarem o volume.";
      return "Algumas fotografias, para os parceiros perceberem o trabalho.";
    case "descricao":
      if (mudanca) return "O que é para mudar: os móveis maiores, os electrodomésticos e se há caixas.";
      if (s === "manutencao_casa") return "O que é para reparar ou fazer, com o máximo de pormenor que conseguir.";
      if (s === "recolha_entulho") return "De que é o entulho: restos de obra, azulejos ou terra, por exemplo.";
      if (ESVAZIAMENTO.has(s)) return "O que há para esvaziar: as divisões e mais ou menos quanta coisa.";
      if (RECOLHA.has(s)) return "O que é para levar e quantas peças são (por exemplo, um sofá e dois colchões).";
      return "O que precisa que seja feito, com o máximo de pormenor que conseguir.";
    case "volume":
      return "Mais ou menos quanto entulho é, em sacos ou em metros cúbicos, para se saber que viatura é precisa.";
    case "tipologia":
      return "O tamanho da casa (T1, T2 ou T3, por exemplo), para se saber quantas horas e quantas pessoas são precisas.";
    case "morada":
      return mudanca
        ? "A morada de onde sai a mudança (rua e número da porta)."
        : "A morada do serviço (rua e número da porta).";
    case "numeroDaPorta":
      return `O número da porta da morada${origem}.`;
    case "codigoPostal":
      return `O código postal da morada${origem}.`;
    case "localidade":
      return mudanca ? "A localidade de origem." : "A localidade.";
    case "andar":
      return mudanca ? "O andar na morada de origem (ou se é moradia ou rés-do-chão)." : "O andar (ou se é moradia ou rés-do-chão).";
    case "elevador":
      if (mudanca) return "Se há elevador no prédio de origem.";
      if (RECOLHA.has(s) || ESVAZIAMENTO.has(s)) return "Se há elevador no prédio e se lá cabe o que é para levar.";
      return "Se há elevador no prédio.";
    case "estacionamento":
      return mudanca
        ? "Se há onde estacionar perto da porta, na origem."
        : "Se há onde estacionar perto da porta.";
    case "moradaDestino":
      return "A morada para onde vai a mudança (rua e número da porta).";
    case "codigoPostalDestino":
      return "O código postal do destino.";
    case "localidadeDestino":
      return "A localidade do destino.";
    case "andarDestino":
      return "O andar no destino (ou se é moradia ou rés-do-chão).";
    case "elevadorDestino":
      return "Se há elevador no prédio de destino.";
    case "estacionamentoDestino":
      return "Se há onde estacionar perto da porta, no destino.";
    case "data":
      return "Para quando precisa do serviço (um dia certo, ou se tem flexibilidade).";
    case "nome":
      return "O seu nome, para o pedido ficar em seu nome.";
  }
}

/**
 * «Bom dia», «Boa tarde», «Boa noite» — PELA HORA DE LISBOA, e não pela do
 * computador de quem carrega no botão (o do dono está em França). As mesmas
 * horas da Vitória (`saudacao` em `whatsapp-recolha.ts`, que um teste
 * compara com esta hora a hora): esse ficheiro é do servidor, e este vai ao
 * painel.
 */
export function cumprimentoPelaHora(quando: Date): string {
  const h = pecasEmLisboa(quando).hora;
  if (!Number.isFinite(h)) return "Olá";
  if (h >= 5 && h < 13) return "Bom dia";
  if (h >= 13 && h < 20) return "Boa tarde";
  return "Boa noite";
}

/** «recolha de monos em Almada» — o pedido em meia dúzia de palavras, ou nada. */
function oPedidoEmPalavras(p: PedidoDaMensagem): string {
  const servico = limpo(p.serviceType) ? servicoEmPalavras(limpo(p.serviceType)) : "";
  const localidade = limpo(p.city).replace(/\s*,?\s*portugal\s*$/i, "");
  // «serviço» sozinho (o «Outro serviço») não diz nada ao cliente.
  const util = servico && servico !== "serviço" ? servico : "";
  if (util && localidade) return `${util} em ${localidade}`;
  return util || (localidade ? `em ${localidade}` : "");
}

/**
 * A MENSAGEM, para o WhatsApp e para o corpo do email. Pede só o que falta,
 * uma linha por falta. Sem faltas, devolve "" — um pedido completo não se
 * pede a ninguém.
 */
export function mensagemDoQueFalta(
  pedido: PedidoDaMensagem,
  faltas: readonly ChaveDaFalta[],
  quando: Date,
): string {
  const lista = arrumarAsFaltas(faltas);
  if (lista.length === 0) return "";
  const emPalavras = oPedidoEmPalavras(pedido);
  const doPedido = `#${pedido.id}${emPalavras ? ` (${emPalavras})` : ""}`;
  const precisamos =
    lista.length === 1
      ? "Para lhe enviarmos o orçamento mais adequado, precisamos de uma informação que está em falta:"
      : "Para lhe enviarmos o orçamento mais adequado, precisamos de algumas informações que estão em falta:";
  return [
    `${cumprimentoPelaHora(quando)}! Aqui é a equipa da CLYON.`,
    `Estamos a contactar por causa do seu pedido ${doPedido}. ${precisamos}`,
    lista.map((c) => `- ${linhaDaFalta(c, pedido.serviceType)}`).join("\n"),
    "Pode responder a esta mensagem com o que falta.",
    "Obrigado,\nEquipa CLYON",
  ].join("\n\n");
}

/** O assunto do email: «Pedido #812 — informações em falta». */
export function assuntoDoQueFalta(pedido: PedidoDaMensagem): string {
  return `Pedido #${pedido.id} — informações em falta`;
}

/** Um email que se pode pôr num `mailto:` — sem espaços, com uma @ e um domínio. */
export function emailParaOMailto(email: string | null | undefined): string | null {
  const e = limpo(email);
  if (!/^[^\s@?&#,;]+@[^\s@?&#,;]+\.[^\s@?&#,;]+$/.test(e)) return null;
  return e;
}

/**
 * O `mailto:` com o assunto e o corpo codificados. As quebras de linha vão
 * como CRLF (`%0D%0A`), que é o que a norma dos `mailto` pede e o que os
 * programas de email lêem sem juntar as linhas.
 */
export function linkDoEmail(email: string | null | undefined, assunto: string, corpo: string): string | null {
  const para = emailParaOMailto(email);
  if (!para) return null;
  const codificar = (t: string) => encodeURIComponent(t.replace(/\r?\n/g, "\r\n"));
  return `mailto:${encodeURIComponent(para).replace(/%40/g, "@")}?subject=${codificar(assunto)}&body=${codificar(corpo)}`;
}

/** Os dois caminhos e o texto, de uma vez — o que o botão da Mesa desenha. */
export function caminhosDoQueFalta(
  pedido: PedidoDaMensagem & { contactPhone?: string | null; contactEmail?: string | null },
  faltas: readonly ChaveDaFalta[],
  quando: Date,
): { texto: string; assunto: string; whatsapp: string | null; email: string | null } {
  const texto = mensagemDoQueFalta(pedido, faltas, quando);
  const assunto = assuntoDoQueFalta(pedido);
  if (!texto) return { texto, assunto, whatsapp: null, email: null };
  return {
    texto,
    assunto,
    whatsapp: linkDeWhatsApp(pedido.contactPhone, texto),
    email: linkDoEmail(pedido.contactEmail, assunto, texto),
  };
}

/** «fotografias, número da porta e elevador» */
export function listaPorExtenso(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/**
 * O QUE FICA NO HISTÓRICO DO PEDIDO — quem, por onde e a lista; nunca a
 * mensagem inteira (leva o número do pedido e a localidade do cliente, e o
 * histórico também se lê na conta dele). O quando é o da entrada.
 */
export function registoDoQueFalta(
  quem: string | null | undefined,
  canal: CanalDoPedido,
  faltas: readonly ChaveDaFalta[],
  servico?: string | null,
): string {
  const lista = listaPorExtenso(arrumarAsFaltas(faltas).map((c) => rotuloDaFalta(c, servico)));
  const pessoa = limpo(quem) || "A equipa";
  const oQue = lista ? `: ${lista}.` : ", mas o pedido já estava completo.";
  if (canal === "copiar") return `${pessoa} copiou a mensagem que pede ao cliente as informações em falta${oQue}`;
  const por = canal === "whatsapp" ? "por WhatsApp" : "por email";
  return `${pessoa} pediu ao cliente, ${por}, as informações em falta${oQue}`;
}
