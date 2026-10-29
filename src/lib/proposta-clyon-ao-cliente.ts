import { comoTratar } from "./whatsapp-recolha";
import { servicoComArtigo } from "./mensagem-das-propostas";
import { precoDoCliente, semEComIva, type PrecoDoCliente } from "./preco-do-cliente";
import { TAXAS_DA_OFERTA } from "./oferta-clyon";
import { quandoPorExtenso } from "./aviso-de-data-ao-cliente";
import { servicoEmPalavras } from "./servico-em-palavras";
import { linkDeWhatsApp } from "./link-de-whatsapp";
import { lerBase, unidadeDaBase } from "./base-do-preco";
import { notaDoPrecoParaOCliente } from "./itens-a-mais";

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
    /**
     * Pelo trabalho todo, por carga ou por hora — 22-10-2026. A unidade vai
     * agarrada ao número, e por baixo a nota (`notaDoPrecoParaOCliente`): por
     * carga, que o total depende das cargas; pelo trabalho todo, os 32 € por
     * item a mais.
     */
    base?: string | null;
    /** A empresa que faz o trabalho, quando já está escolhida. */
    profissional?: string | null;
  },
  agora: Date,
): string {
  const base = lerBase(t.base);
  const comArtigo = servicoComArtigo(servicoEmPalavras(t.servico));
  const onde = t.localidade?.trim() ? ` em ${t.localidade.trim()}` : "";
  const oQue = comArtigo ? `${comArtigo}${onde}` : "o seu pedido";

  // O dia só se diz se ainda está para vir: uma proposta «para ontem» não se manda.
  const dia = t.quando ? new Date(t.quando) : null;
  const paraQuando =
    dia && !Number.isNaN(dia.getTime()) && dia.getTime() > agora.getTime()
      ? `, para ${quandoPorExtenso(dia, agora)}`
      : "";

  /*
   * QUEM FAZ, E PARA ONDE VAI O DINHEIRO — 27-10-2026 (d12, frase-padrão 4).
   * Dizia «A nossa proposta para…» e «combinamos o resto»: a CLYON a fazer o
   * trabalho. Quem o faz é um profissional verificado (nomeado, se já está
   * escolhido); a CLYON recebe e só lhe paga depois de o trabalho estar feito.
   */
  const profissional = t.profissional?.trim();
  const quem = profissional
    ? `o trabalho é feito por ${profissional}, parceiro verificado na CLYON`
    : "temos um parceiro verificado da sua zona";

  return [
    `${comoTratar(t.cliente, agora)} Aqui é a CLYON.`,
    `Para ${oQue}${paraQuando}, ${quem}:`,
    base === "total"
      ? `${semEComIva(t.preco)} — é o valor final a pagar, já com IVA.`
      : `${semEComIva(t.preco)}${unidadeDaBase(base)} — já com IVA.`,
    notaDoPrecoParaOCliente(base, "clyon"),
    "Paga à CLYON, que só paga ao parceiro depois de o trabalho estar feito.",
    profissional
      ? "Se estiver de acordo, é só responder a esta mensagem e confirmamos o dia consigo."
      : "Se estiver de acordo, é só responder a esta mensagem e dizemos-lhe quem vai e quando.",
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
    base?: string | null;
    profissional?: string | null;
  },
  agora: Date,
): { link: string; total: number } | null {
  const preco = precoDaPropostaClyon(t);
  if (!preco) return null;
  const link = linkDeWhatsApp(t.telefone, mensagemDaPropostaClyon({ ...t, preco }, agora));
  return link ? { link, total: preco.total } : null;
}
