import { comoTratar } from "./whatsapp-recolha";
import { servicoComArtigo } from "./mensagem-das-propostas";
import { precoDoCliente, semEComIva, type PrecoDoCliente } from "./preco-do-cliente";
import { TAXAS_DA_OFERTA } from "./oferta-clyon";
import { quandoPorExtenso } from "./aviso-de-data-ao-cliente";
import { servicoEmPalavras } from "./servico-em-palavras";
import { linkDeWhatsApp } from "./link-de-whatsapp";

/**
 * A PROPOSTA DE UM TRABALHO CLYON, NO WHATSAPP DO CLIENTE — 08-10-2026.
 *
 * *«Crie um link que leva para o WhatsApp do cliente com uma mensagem com a
 * nossa proposta e valor final para pagar.»*
 *
 * Um Trabalho CLYON é um preço que a CLYON fecha com o cliente; até aqui esse
 * preço ia ao cliente escrito à mão, e o IVA por cima contado de cabeça. O
 * botão abre a conversa com o cliente e a mensagem já escrita — quem a manda
 * ainda a lê antes de carregar em enviar.
 *
 * O NÚMERO É O DE TODO O SITE desde o IVA incluído: o sem IVA ao lado, como
 * parte do com IVA — «330,00 € + IVA = 405,90 €» (`semEComIva`), e o valor a
 * pagar é o com IVA. Nunca o sem IVA sozinho: o cliente podia responder com
 * ele.
 *
 * SEM LINK DO SITE, como a mensagem das propostas desde 03-10-2026 (*«vamos
 * fazer manualmente»*): diz a proposta e pede-lhe que responda.
 */

/**
 * O preço ao cliente de um Trabalho CLYON, com IVA.
 *
 * O valor de um trabalho com taxa é o preço ao cliente, sem IVA; nos antigos
 * (sem taxa) o valor era o que o profissional recebia, e o preço ao cliente é
 * o que se escreveu à parte — sem ele não há proposta para mandar. Do lado do
 * cliente a taxa de um Trabalho CLYON é zero (`TAXAS_DA_OFERTA`): o valor já é
 * o preço dele.
 */
export function precoDaPropostaClyon(t: {
  valorFixo: number;
  taxa: number | null;
  precoAoCliente: number | null;
}): PrecoDoCliente | null {
  const semIva = t.taxa != null ? t.valorFixo : t.precoAoCliente;
  if (semIva == null || !Number.isFinite(semIva) || semIva <= 0) return null;
  return precoDoCliente(semIva, TAXAS_DA_OFERTA, "iva_incluido");
}

export function mensagemDaPropostaClyon(
  t: {
    cliente: string | null;
    servico: string | null;
    localidade: string | null;
    /** O dia marcado com o profissional, ou o que o cliente pediu. */
    quando: string | null;
    preco: PrecoDoCliente;
  },
  agora: Date,
): string {
  const comArtigo = servicoComArtigo(servicoEmPalavras(t.servico));
  const onde = t.localidade?.trim() ? ` em ${t.localidade.trim()}` : "";
  const oQue = comArtigo ? `${comArtigo}${onde}` : "o seu pedido";

  // O dia só se diz se ainda está para vir: uma proposta «para ontem» não se manda.
  const dia = t.quando ? new Date(t.quando) : null;
  const paraQuando =
    dia && !Number.isNaN(dia.getTime()) && dia.getTime() > agora.getTime()
      ? `, para ${quandoPorExtenso(dia, agora)}`
      : "";

  return [
    `${comoTratar(t.cliente, agora)} Aqui é a CLYON.`,
    `A nossa proposta para ${oQue}${paraQuando}:`,
    `${semEComIva(t.preco)} — é o valor final a pagar, já com IVA.`,
    "Se estiver de acordo, é só responder a esta mensagem e combinamos o resto.",
  ].join("\n\n");
}

/**
 * O link do botão: a conversa com o cliente, com a proposta escrita. `null`
 * quando não há preço ou o telefone não abre no WhatsApp — e aí o ecrã não
 * mostra o botão (ver `link-de-whatsapp.ts`: um número adivinhado manda o
 * preço de um cliente a um estranho).
 */
export function linkDaPropostaClyon(
  t: {
    cliente: string | null;
    telefone: string | null;
    servico: string | null;
    localidade: string | null;
    quando: string | null;
    valorFixo: number;
    taxa: number | null;
    precoAoCliente: number | null;
  },
  agora: Date,
): { link: string; total: number } | null {
  const preco = precoDaPropostaClyon(t);
  if (!preco) return null;
  const link = linkDeWhatsApp(t.telefone, mensagemDaPropostaClyon({ ...t, preco }, agora));
  return link ? { link, total: preco.total } : null;
}
