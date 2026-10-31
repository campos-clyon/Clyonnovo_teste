import { configuracaoDoEupago, podeCobrar, quantoOClientePaga } from "@/lib/eupago";
import { O_CLIENTE_PAGA_SOZINHO } from "@/lib/pagamento-na-plataforma";
import { temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { pagamentosDaNegociacao, type Pagamento } from "@/lib/pagamentos-na-base";
import type { TrabalhoAPagar } from "@/lib/acesso-ao-pagamento";
import { acertoDoFim } from "@/lib/horas-do-trabalho";

/**
 * O ESTADO DO PAGAMENTO DE UM TRABALHO, COMO O CLIENTE O VÊ — uma função só
 * (d8, R5, 28-10-2026).
 *
 * Era o corpo do `GET /api/pagamentos`. Saiu para aqui porque a app de cliente
 * recebe o mesmo estado dentro do pedido (`/api/cliente/pedidos/[id]`), e duas
 * contas do mesmo pagamento acabam por discordar — e o dia em que discordam é
 * o dia em que o cliente vê um valor e o banco lhe pede outro.
 *
 * Quem chama já provou que o trabalho é do cliente (`trabalhoQueSePodePagar`).
 */

/** O que o cliente vê de um pagamento. Nunca a linha inteira. */
export function pagamentoVistoPeloCliente(p: Pagamento) {
  return {
    id: p.id,
    metodo: p.metodo,
    estado: p.estado,
    valor: p.valor,
    comFactura: p.comFactura,
    referencia: p.referencia,
    entidade: p.entidade,
    expiraEm: p.expiraEm,
    pagoEm: p.pagoEm,
    criadoEm: p.criadoEm,
  };
}

export type EstadoDoPagamentoParaOCliente = {
  disponivel: boolean;
  pagamentos: Array<ReturnType<typeof pagamentoVistoPeloCliente>>;
  pago: boolean;
  valores: { semFactura: number; comFactura: number };
  ivaIncluido: boolean;
  doCliente: boolean;
  /**
   * A DIFERENÇA DAS HORAS — 31-10-2026. Só num trabalho por hora, com o
   * trabalho pago e as horas confirmadas: `aPagar` > 0 quando o total
   * confirmado passa o que se pagou (paga-se pela mesma rota, `parte:
   * "diferenca"`); `aDevolver` > 0 quando fica abaixo (a equipa trata —
   * nunca se devolve sozinho). `null` nos outros.
   */
  diferenca: {
    aPagar: number;
    aDevolver: number;
    pago: boolean;
    pagamentos: Array<ReturnType<typeof pagamentoVistoPeloCliente>>;
  } | null;
};

/** O valor que um pagamento pago trouxe: o que o euPago disse, ou o pedido. */
const valorPagoDe = (l: Pagamento) => (l.valorPago != null && l.valorPago > 0 ? l.valorPago : l.valor);

/**
 * O ACERTO DAS HORAS de um trabalho por hora, depois de confirmadas. Exportado
 * para a rota (que cobra a diferença) e para o backoffice (que mostra o «a
 * devolver»). `null` quando não há acerto a fazer: não é por hora, as horas
 * não estão confirmadas, ou o trabalho ainda não foi pago.
 */
export function acertoDasHoras(
  trabalho: Pick<TrabalhoAPagar, "porHora" | "acordado" | "taxas" | "modelo">,
  linhas: Pagamento[],
): { aPagar: number; aDevolver: number; pagoAteAgora: number; final: number; comFactura: boolean } | null {
  if (!trabalho.porHora?.horasConfirmadas) return null;
  const doTrabalho = linhas.find((l) => l.parte !== "diferenca" && l.estado === "pago");
  if (!doTrabalho) return null;
  const pagos = linhas.filter((l) => l.estado === "pago");
  const pagoAteAgora = Math.round(pagos.reduce((soma, l) => soma + valorPagoDe(l), 0) * 100) / 100;
  const final = quantoOClientePaga(trabalho.acordado, trabalho.taxas, trabalho.modelo, doTrabalho.comFactura);
  return { ...acertoDoFim(pagoAteAgora, final), pagoAteAgora, final, comFactura: doTrabalho.comFactura };
}

export async function estadoDoPagamentoParaOCliente(
  trabalho: TrabalhoAPagar,
): Promise<EstadoDoPagamentoParaOCliente> {
  const linhas = await pagamentosDaNegociacao(trabalho.negociacaoId);
  /*
   * `disponivel` EXISTE PARA O ECRÃ NÃO APARECER QUANDO NÃO SERVE.
   *
   * Se a porta estiver fechada, o cliente não pode ver uma caixa de
   * pagamento que responde 503 quando ele carrega. E o navegador não tem
   * como saber se estamos em sandbox ou em produção — isso é uma variável do
   * servidor. Por isso a resposta di-lo, e o ecrã decide-se com ela.
   */
  const conf = configuracaoDoEupago(process.env);
  const disponivel =
    conf.ok &&
    podeCobrar(conf.config, O_CLIENTE_PAGA_SOZINHO, {
      email: trabalho.emailDoCliente,
      // O valor mais alto dos dois: se o tecto de teste travar o com
      // factura, é melhor o ecrã não aparecer do que aparecer e falhar
      // quando ele escolher a factura.
      valor: quantoOClientePaga(trabalho.acordado, trabalho.taxas, trabalho.modelo, true),
    }).pode &&
    /*
     * EM DINHEIRO COM IVA INCLUÍDO O CLIENTE NÃO PAGA NADA À CLYON —
     * 01-10-2026. Paga tudo ao profissional, em notas; quem deve à CLYON é o
     * profissional. A caixa de pagamento não aparece.
     */
    !temDividaDoProfissional(trabalho.formaDePagamento, trabalho.modelo);

  /*
   * A DÍVIDA DO PROFISSIONAL NÃO SAI PARA O CLIENTE — 28-10-2026 (d10).
   *
   * Em dinheiro com IVA incluído, as referências deste trabalho são o que o
   * profissional deve à CLYON (o IVA e a comissão): o valor delas dizia ao
   * cliente quanto fica a plataforma. O cliente pagou tudo ao profissional e
   * não tem nada a pagar aqui — por isso não recebe nenhuma, nem o «pago».
   */
  const doCliente = !temDividaDoProfissional(trabalho.formaDePagamento, trabalho.modelo);
  // A diferença das horas (31-10-2026) vai à parte: as de cima são as do trabalho.
  const doClienteMesmo = doCliente ? linhas.filter((l) => l.parte !== "diferenca") : [];
  const daDiferenca = doCliente ? linhas.filter((l) => l.parte === "diferenca") : [];
  const acerto = doCliente ? acertoDasHoras(trabalho, linhas) : null;

  return {
    disponivel,
    pagamentos: doClienteMesmo.map(pagamentoVistoPeloCliente),
    pago: doClienteMesmo.some((l) => l.estado === "pago"),
    /*
     * Os dois números, calculados no SERVIDOR e enviados juntos — se o ecrã os
     * calculasse outra vez para o botão, passavam a existir duas contas para o
     * mesmo pagamento.
     */
    valores: {
      semFactura: quantoOClientePaga(trabalho.acordado, trabalho.taxas, trabalho.modelo, false),
      comFactura: quantoOClientePaga(trabalho.acordado, trabalho.taxas, trabalho.modelo, true),
    },
    /*
     * Com IVA incluído (01-10-2026) os dois números são o mesmo — há factura
     * em todas as vendas — e o ecrã deixa de perguntar se ele a quer.
     */
    ivaIncluido: trabalho.modelo === "iva_incluido",
    /*
     * O PAGAMENTO REGISTADO É DO CLIENTE? — 27-10-2026 (d16). Em dinheiro com
     * IVA incluído, o que se paga pela referência é a dívida do profissional:
     * o ecrã do cliente não o mostra como «recebemos o seu pagamento».
     */
    doCliente,
    diferenca: acerto
      ? {
          aPagar: acerto.aPagar,
          aDevolver: acerto.aDevolver,
          pago: daDiferenca.some((l) => l.estado === "pago"),
          pagamentos: daDiferenca.map(pagamentoVistoPeloCliente),
        }
      : null,
  };
}
