import { lerBase } from "./base-do-preco";
import { nomeEmPortugues } from "./coverage";
import { mensagemDasPropostas, propostasParaOCliente, trabalhoFechado, type PropostaParaOCliente } from "./mensagem-das-propostas";
import { SERVICE_CATEGORIES } from "./service-categories";
import { escolherAVariante, mensagemDasPropostasVariada, tipoDaMensagem, type PropostaCurta } from "./propostas-curtas";
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
  /** O n.º do pedido: a variante A/B da mensagem das propostas (d91). */
  id?: number | string | null;
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

/**
 * A LOCALIDADE EM PORTUGUÊS — «Lisbon» (como a morada do Google às vezes a
 * grava) é «Lisboa» na mensagem em português (o #659, d88); a tradução diz
 * depois a forma da língua do cliente. Sem «, Portugal» no fim.
 */
export function localidadeDoOrcamento(cidade: string | null | undefined): string | null {
  const limpa = String(cidade ?? "").replace(/\s*,?\s*portugal\s*$/i, "").trim();
  return limpa ? nomeEmPortugues(limpa) : null;
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
          cidade: localidadeDoOrcamento(p.city),
          valorSemIva: p.valorUnicoCliente,
          base: lerBase(p.baseDoPreco),
        },
        agora,
      ),
      agora,
    );
  }
  const comPropostas = !trabalhoFechado(p.negociacoes) && propostas.length > 0;
  /*
   * O TEXTO CURTO — 26-11-2026 (d136). O «Enviar orçamento» e o «Enviar pela
   * CLYON» mandavam ainda a lista longa («O valor de cada uma é o total a
   * pagar…», «Inclui o que está nas fotografias…»), quando a rotina das
   * propostas já diz o mesmo em 3 a 5 linhas (d123, `propostas-curtas.ts`).
   * Agora a Mesa manda a mesma mensagem curta, com a validade (d62) no fim. O
   * «Está combinado com…» (já fechado) fica como estava.
   */
  const pedidoId = Number(p.id);
  if (comPropostas && Number.isInteger(pedidoId) && pedidoId > 0) {
    const base = lerBase(p.baseDoPreco);
    const daNegociacao = new Map(p.negociacoes.map((n) => [Number((n as { id?: unknown }).id), n]));
    const curtas: PropostaCurta[] = propostas.map((x) => ({
      negociacaoId: x.negociacaoId ?? null,
      parceiro: x.profissional,
      semIva: x.semIva,
      total: x.total,
      isento: x.contaDoNovoModelo?.regime === "isento",
      aceitou: (daNegociacao.get(Number(x.negociacaoId)) as { estado?: unknown } | undefined)?.estado === "aguarda_contratacao",
    }));
    const curto = mensagemDasPropostasVariada({
      pedidoId,
      nome: p.contactName,
      servico: nomeDoServicoDoOrcamento(p.serviceType),
      propostas: curtas,
      agora,
      unidade: base === "carga" || base === "hora" ? base : null,
      nova: false,
      variante: escolherAVariante(tipoDaMensagem(false, curtas.length), pedidoId, 0),
    });
    if (curto) return comValidade(curto, agora);
  }
  const texto = mensagemDasPropostas({
    nomeCliente: p.contactName,
    servico: nomeDoServicoDoOrcamento(p.serviceType),
    servicoId: p.serviceType,
    // d91: A/B pelo n.º do pedido (par A, ímpar B).
    pedidoId: p.id ?? null,
    cidade: localidadeDoOrcamento(p.city),
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
