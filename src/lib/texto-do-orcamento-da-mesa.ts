import { lerBase } from "./base-do-preco";
import { mensagemDasPropostas, propostasParaOCliente, trabalhoFechado, type PropostaParaOCliente } from "./mensagem-das-propostas";
import { SERVICE_CATEGORIES } from "./service-categories";
import { comValidade } from "./validade-do-orcamento";
import { mensagemDoValorUnico } from "./valor-unico";

/**
 * A MENSAGEM DO ORÇAMENTO DA MESA — a do «Enviar orçamento» e a do «Enviar pela
 * CLYON» (23-10-2026), num sítio só desde a d88 (23-11-2026): o painel da Mesa
 * e a Vitória, quando envia as propostas ao cliente sozinha, escrevem-na com a
 * MESMA função. Uma regra mudada aqui muda nos dois.
 *
 *   · com o valor único (d39) e nada fechado: o valor único, sem nomes;
 *   · com propostas a escolher: as propostas, cada uma com o valor sem e com
 *     IVA, e a validade (d62: «Esta proposta é válida até…», 3 dias depois);
 *   · já contratado: «Está combinado com…», sem validade.
 *
 * PURA: os dados e o relógio vêm de quem chama.
 */

/** O que a mensagem precisa de uma negociação — o que a Mesa recebe da rota. */
export type NegociacaoDoOrcamento = Parameters<typeof propostasParaOCliente>[0][number] & {
  escolhidoPeloCliente?: number | string | boolean | null;
};

export type PedidoDoOrcamento = {
  contactName: string | null;
  serviceType: string | null;
  city: string | null;
  baseDoPreco?: string | null;
  horasPrevistas?: number | null;
  valorUnicoCliente?: number | null;
  negociacoes: NegociacaoDoOrcamento[];
};

/** O serviço em palavras, em minúsculas — «recolha de monos» —, ou null. */
export function nomeDoServicoDoOrcamento(id: string | null): string | null {
  if (!id) return null;
  const c = SERVICE_CATEGORIES.find((x) => x.id === id);
  return (c?.label ?? id.replace(/_/g, " ")).toLowerCase();
}

/** A mensagem do orçamento, tal como sai pela Mesa. */
export function textoDoOrcamentoDaMesa(
  p: PedidoDoOrcamento,
  agora: Date,
  propostas: PropostaParaOCliente[] = propostasParaOCliente(p.negociacoes),
): string {
  /*
   * O VALOR ÚNICO (d39, 15-11-2026): com ele, o «Enviar orçamento» e o «Enviar
   * pela CLYON» mandam um valor só, sem nomes nem lista. Já fechado, a
   * mensagem de sempre («Está combinado com…»).
   */
  /*
   * O ORÇAMENTO TEM VALIDADE — 18-11-2026 (d62): «Esta proposta é válida até
   * {dia da semana, dd/mm}», 3 dias depois do envio (Lisboa). Só quando há
   * proposta a escolher; o «Está combinado com…» não a leva.
   */
  if (p.valorUnicoCliente != null && !trabalhoFechado(p.negociacoes)) {
    return comValidade(
      mensagemDoValorUnico(
        {
          nomeCliente: p.contactName,
          servico: nomeDoServicoDoOrcamento(p.serviceType),
          servicoId: p.serviceType,
          cidade: p.city,
          valorSemIva: p.valorUnicoCliente,
          base: lerBase(p.baseDoPreco),
        },
        agora,
      ),
      agora,
    );
  }
  const comPropostas = !trabalhoFechado(p.negociacoes) && propostas.length > 0;
  const texto = mensagemDasPropostas({
    nomeCliente: p.contactName,
    servico: nomeDoServicoDoOrcamento(p.serviceType),
    servicoId: p.serviceType,
    cidade: p.city,
    propostas,
    fechado: trabalhoFechado(p.negociacoes),
    // Por carga, diz-se em cada valor — a Célia (#375) leu-os como o total.
    base: lerBase(p.baseDoPreco),
    // Por hora, a estimativa pelas horas previstas (31-10-2026).
    horasPrevistas: p.horasPrevistas ?? null,
    // Numa mudança da lista, o mínimo é o de cada parceiro (d7, 11-11-2026).
    mudancaDaLista: p.negociacoes.some((n) => Number(n.escolhidoPeloCliente) === 1),
  });
  return comPropostas ? comValidade(texto, agora) : texto;
}
