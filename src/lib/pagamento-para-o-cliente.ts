import { configuracaoDoEupago, podeCobrar, quantoOClientePaga } from "@/lib/eupago";
import { O_CLIENTE_PAGA_SOZINHO } from "@/lib/pagamento-na-plataforma";
import { temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { pagamentosDaNegociacao, type Pagamento } from "@/lib/pagamentos-na-base";
import { eDoCliente } from "@/lib/parte-do-pagamento";
import type { TrabalhoAPagar } from "@/lib/acesso-ao-pagamento";
import { acertoDoFim } from "@/lib/horas-do-trabalho";
import { contaDoCliente } from "@/lib/taxas-plataforma";
import {
  METODO_TRANSFERENCIA,
  chegaParaTransferencia,
  transferenciaParaOCliente,
  type ContaDaTransferencia,
  type TransferenciaParaOCliente,
} from "@/lib/transferencia-bancaria";

/**
 * A conta da transferência, das Configs. Nunca rebenta: sem base, ou sem conta,
 * o método simplesmente não aparece.
 */
async function contaDaTransferenciaSemFalhar(): Promise<ContaDaTransferencia | null> {
  try {
    const { contaDaTransferencia } = await import("@/lib/db");
    return typeof contaDaTransferencia === "function" ? await contaDaTransferencia() : null;
  } catch {
    return null;
  }
}

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

/**
 * UM MB WAY SEM RESPOSTA NÃO FICA «PENDENTE» PARA SEMPRE — 02-11-2026 (#551).
 *
 * O MB WAY dá cinco minutos; se o cliente não confirma (ou a notificação não
 * chega), o euPago nem sempre avisa. A linha ficava «pendente» na base, e o
 * cliente via «Confirme na app MB WAY» sem fim, sem poder pedir outro nem
 * escolher o Multibanco. Passado o prazo (com um minuto de folga para o aviso
 * a caminho), ao cliente mostra-se «expirado». A base não se escreve aqui: se
 * o pagamento entrar mesmo assim, o aviso ainda encontra a linha (ver
 * `pagamentos-na-base.ts`, os estados que ainda podem ser pagos).
 */
export const FOLGA_DO_MBWAY_MS = 60_000;

export function estadoVistoPeloCliente(
  p: Pick<Pagamento, "metodo" | "estado" | "expiraEm">,
  agora: number = Date.now(),
): Pagamento["estado"] {
  if (p.estado !== "pendente" || p.metodo !== "mbway" || !p.expiraEm) return p.estado;
  const fim = new Date(p.expiraEm).getTime();
  return Number.isFinite(fim) && fim + FOLGA_DO_MBWAY_MS < agora ? "expirado" : p.estado;
}

/** O que o cliente vê de um pagamento. Nunca a linha inteira. */
export function pagamentoVistoPeloCliente(p: Pagamento) {
  return {
    id: p.id,
    metodo: p.metodo,
    estado: estadoVistoPeloCliente(p),
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
  /**
   * O MODELO DE 15-11-2026 — d10: o cliente paga diretamente ao parceiro (o
   * IBAN e o MB WAY dele vêm na negociação, depois de contratar), e não há
   * nada a pagar aqui. Falso antes da data.
   */
  pagaAoParceiro: boolean;
  pagamentos: Array<ReturnType<typeof pagamentoVistoPeloCliente>>;
  pago: boolean;
  valores: { semFactura: number; comFactura: number };
  ivaIncluido: boolean;
  doCliente: boolean;
  /**
   * O PREÇO DO BLOCO DE PAGAR — 02-11-2026: o serviço sem IVA, o IVA e o total
   * que se paga, da mesma conta que dá o `valores.comFactura` (o total é esse
   * número). Só com IVA incluído; antes dele, `null`.
   */
  desdobramento: { semIva: number; iva: number; total: number } | null;
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
  /**
   * TRANSFERÊNCIA BANCÁRIA — 02-11-2026. Só quando o total com IVA chega a
   * `LIMITE_DA_TRANSFERENCIA` e há conta nas Configs: o IBAN, o titular, o
   * valor com e sem IVA e o descritivo «Pedido #N». `null` nos outros.
   */
  transferencia: TransferenciaParaOCliente | null;
  /** O cliente escolheu a transferência e ela ainda não foi dada por recebida. */
  aEsperaDaTransferencia: boolean;
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
  // A dívida do profissional num pago em mão não é do cliente (04-11-2026, d9).
  linhas = linhas.filter(eDoCliente);
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
  // Só as do cliente: a dívida do profissional num pago em mão nunca sai para ele (04-11-2026, d9).
  const linhas = (await pagamentosDaNegociacao(trabalho.negociacaoId)).filter(eDoCliente);
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
    !temDividaDoProfissional(trabalho.formaDePagamento, trabalho.modelo) &&
    // O modelo de 15-11 (d10): paga ao parceiro; a caixa não aparece.
    !trabalho.novoModelo;

  /*
   * A DÍVIDA DO PROFISSIONAL NÃO SAI PARA O CLIENTE — 28-10-2026 (d10).
   *
   * Em dinheiro com IVA incluído, as referências deste trabalho são o que o
   * profissional deve à CLYON (o IVA e a comissão): o valor delas dizia ao
   * cliente quanto fica a plataforma. O cliente pagou tudo ao profissional e
   * não tem nada a pagar aqui — por isso não recebe nenhuma, nem o «pago».
   */
  const doCliente = !temDividaDoProfissional(trabalho.formaDePagamento, trabalho.modelo) && !trabalho.novoModelo;
  // A diferença das horas (31-10-2026) vai à parte: as de cima são as do trabalho.
  const doClienteMesmo = doCliente ? linhas.filter((l) => l.parte !== "diferenca") : [];
  const daDiferenca = doCliente ? linhas.filter((l) => l.parte === "diferenca") : [];
  const acerto = doCliente ? acertoDasHoras(trabalho, linhas) : null;
  const pago = doClienteMesmo.some((l) => l.estado === "pago");
  const totalComIva = quantoOClientePaga(trabalho.acordado, trabalho.taxas, trabalho.modelo, true);
  const totalSemIva =
    trabalho.modelo === "iva_incluido"
      ? contaDoCliente(trabalho.acordado, trabalho.taxas).semIva
      : quantoOClientePaga(trabalho.acordado, trabalho.taxas, trabalho.modelo, false);
  const transferencia = transferenciaParaOCliente({
    // Só se lê a conta (uma ida à base) quando ela pode servir.
    conta: !pago && doCliente && chegaParaTransferencia(totalComIva) ? await contaDaTransferenciaSemFalhar() : null,
    totalComIva,
    totalSemIva,
    pedidoId: trabalho.pedidoId,
    pago,
    doCliente,
  });

  return {
    disponivel,
    pagaAoParceiro: trabalho.novoModelo === true,
    pagamentos: doClienteMesmo.map(pagamentoVistoPeloCliente),
    pago,
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
    desdobramento:
      trabalho.modelo === "iva_incluido"
        ? (({ semIva, iva, total }) => ({ semIva, iva, total }))(contaDoCliente(trabalho.acordado, trabalho.taxas))
        : null,
    /*
     * O PAGAMENTO REGISTADO É DO CLIENTE? — 27-10-2026 (d16). Em dinheiro com
     * IVA incluído, o que se paga pela referência é a dívida do profissional:
     * o ecrã do cliente não o mostra como «recebemos o seu pagamento».
     */
    doCliente,
    transferencia,
    aEsperaDaTransferencia:
      !pago &&
      doClienteMesmo.some(
        (l) =>
          l.estado === "pendente" &&
          String(l.metodo) === METODO_TRANSFERENCIA &&
          (!l.expiraEm || new Date(l.expiraEm).getTime() > Date.now()),
      ),
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
