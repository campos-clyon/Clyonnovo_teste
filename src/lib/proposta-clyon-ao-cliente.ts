import { servicoComArtigo } from "./mensagem-das-propostas";
import { parceiroNaFrase } from "./parceiro-verificado";
import { precoDoCliente, type PrecoDoCliente } from "./preco-do-cliente";
import { TAXAS_DA_OFERTA } from "./oferta-clyon";
import { quandoPorExtenso } from "./aviso-de-data-ao-cliente";
import { servicoEmPalavras } from "./servico-em-palavras";
import { linkDeWhatsApp } from "./link-de-whatsapp";
import { lerBase } from "./base-do-preco";
import { mensagemDoOrcamento } from "./mensagem-do-orcamento";

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
     * carga, que o total depende das cargas; pelo trabalho todo, os itens a
     * mais pela tabela das peças (eram 32 € por item, 22-10-2026).
     */
    base?: string | null;
    /** A empresa que faz o trabalho, quando já está escolhida. */
    profissional?: string | null;
    /** NIF, identidade e contacto confirmados — só então se diz «verificado» (01-11-2026). */
    profissionalVerificado?: boolean;
    /**
     * O Trabalho CLYON segue o modelo de 15-11 (d54, `trabalhoClyonDoNovoModelo`):
     * o cliente paga ao parceiro — «Paga ao parceiro no dia.», nunca «Paga à CLYON».
     */
    novoModelo?: boolean;
  },
  agora: Date,
): string {
  /*
   * CURTA, EM QUATRO PARTES — 15-11-2026 (d47): o valor com o IVA ao lado, o
   * que cobre, o extra com preço, e como se paga. Ver `mensagem-do-orcamento.ts`.
   * Era seis parágrafos («temos um parceiro da sua zona», «é o valor final a
   * pagar, já com IVA», «Paga à CLYON, que só paga ao parceiro…»).
   */
  const base = lerBase(t.base);
  const dia = t.quando ? new Date(t.quando) : null;
  const paraQuando =
    dia && !Number.isNaN(dia.getTime()) && dia.getTime() > agora.getTime() ? `, para ${quandoPorExtenso(dia, agora)}` : "";
  return mensagemDoOrcamento(
    {
      cliente: t.cliente,
      servicoComArtigo: servicoComArtigo(servicoEmPalavras(t.servico)),
      servicoId: t.servico,
      localidade: t.localidade,
      semIva: t.preco.semIva,
      total: t.preco.total,
      base,
      modelo: t.novoModelo === true ? "parceiro" : "clyon",
      paraQuando,
      comQuemJaEscolhido: Boolean(t.profissional?.trim()),
      // Quem faz, quando já está escolhido (d12) — «verificado» só com as três confirmações.
      quemFaz: t.profissional?.trim() ? parceiroNaFrase(t.profissional.trim(), t.profissionalVerificado === true) : null,
    },
    agora,
  );
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
    /** O modelo de 15-11 (d54): «Paga ao parceiro». */
    novoModelo?: boolean;
  },
  agora: Date,
): { link: string; total: number; texto: string } | null {
  const preco = precoDaPropostaClyon(t);
  if (!preco) return null;
  const texto = mensagemDaPropostaClyon({ ...t, preco }, agora);
  const link = linkDeWhatsApp(t.telefone, texto);
  // O texto vai também, para o botão o pôr na língua do cliente antes de abrir (d47).
  return link ? { link, total: preco.total, texto } : null;
}
