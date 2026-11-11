import { SQL_DO_VERIFICADO } from "@/lib/parceiro-verificado";
import { negociacoesParaOCliente } from "@/lib/negociacoes-para-o-cliente";
import { historicoParaOCliente } from "@/lib/historico-para-o-cliente";
import { negociacaoParaAVista, type LinhaParaAVista } from "@/lib/negociacao-na-vista";
import { negociacaoParaOEcra, type NegociacaoNoEcra } from "@/lib/negociacao-no-ecra";
import { lerBase } from "@/lib/base-do-preco";
import { horasPrevistasDaLinha } from "@/lib/horas-do-trabalho";
import { trabalhoExigeGuia } from "@/lib/guia-antes-de-contratar";
import { resumoDoPedidoParaOCliente, type PedidoParaOResumo } from "@/lib/pedidos-do-cliente";
import { precoClyonParaOCliente } from "@/lib/preco-clyon-para-o-cliente";
import { fimDoTrabalhoClyonParaOCliente, type LinhaDoTrabalhoClyon } from "@/lib/fim-do-trabalho-clyon";

/**
 * OS PEDIDOS DA CONTA DO CLIENTE, PRONTOS PARA O ECRÃ — 28-10-2026 (d10).
 *
 * A conta lê os pedidos por dois caminhos — a primeira carga no servidor
 * (`loadContaData`) e a API que o ecrã chama depois (`/api/users/me/orders`) —
 * e os dois mandavam as negociações cruas ao navegador: o valor do
 * profissional, as propostas em bruto e a taxa do cliente, para o ecrã fazer
 * a conta. Agora os dois passam por aqui: a mesma consulta, a mesma regra de
 * todas as portas (`negociacoesParaOCliente`), a mesma conversão da página do
 * link (`negociacaoParaAVista`) e o mesmo ecrã (`negociacaoParaOEcra`).
 */

type Linha = Record<string, unknown> & { estado: string };

/** As negociações de uma lista de pedidos — o que a conversão precisa, e a marca da regra (d33). */
export function sqlDasNegociacoesDaConta(quantos: number): string {
  return `SELECT n.id, n.pedidoId, n.estado, n.valorAcordado, n.propostasJson,
                 n.taxaCliente, n.formaDePagamento, n.acrescimoPagamento,
                 n.execucaoEnviadaEm, n.provaJson, n.confirmadoEm, n.pagoEm, n.ajustesJson,
                 n.estrelas, n.avaliadoEm, n.dataCombinada, n.aCaminhoEm, n.proximoEm, n.chegouEm, n.chegadaConfirmadaEm, n.updatedAt,
                 -- As horas e os materiais de um trabalho por hora (31-10-2026).
                 n.valorPorHora, n.horasInicioEm, n.horasFimEm, n.horasMinutos, n.horasFaturadas, n.valorDasHoras,
                 n.horasMarcadasEm, n.horasConfirmadasEm, n.horasConfirmadasPor, n.horasContestadasEm, n.horasContestacao,
                 n.materiaisJson, n.materiaisUsadosJson,
                 -- A folha da mudança (11-11-2026): a folha, o histórico e a tarifa (o mínimo de horas).
                 n.folhaJson, n.folhaHistoricoJson, n.folhaNaMesaEm, n.tarifaCongeladaJson,
                 -- O modelo do preço: a abertura e a marca «sem fatura» (21-10-2026).
                 n.createdAt, n.semFactura,
                 -- Só para a regra a esconder (d33): não sai para o cliente.
                 n.ofertaClyon,
                 p.name AS profissionalNome, p.phone AS profissionalTelefone,
                 p.regimeIva, p.guiaVerificadaEm,
                 -- A transição de 7 dias da guia (d10 v2, 04-11-2026).
                 p.estado AS profissionalEstado, p.aprovadoEm,
                 -- «verificado» só com as três confirmações (01-11-2026).
                 ${SQL_DO_VERIFICADO} AS parceiroVerificado
            FROM negociacoes n
            JOIN providers p ON p.id = n.providerId
           WHERE n.pedidoId IN (${Array.from({ length: Math.max(1, quantos) }, () => "?").join(",")})
           ORDER BY n.updatedAt DESC`;
}

/** Junta as linhas por pedido, pela ordem em que vieram (a última actividade em cima). */
export function porPedido(linhas: Linha[]): Map<number, Linha[]> {
  const mapa = new Map<number, Linha[]>();
  for (const n of linhas) {
    const k = Number(n.pedidoId);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k)!.push(n);
  }
  return mapa;
}

/** As negociações de um pedido da conta, como o ecrã as mostra. */
export function negociacoesDaContaNoEcra(
  pedido: { id: unknown; trabalhoClyon?: unknown; baseDoPreco?: unknown },
  linhas: Linha[] | undefined,
  agora: Date = new Date(),
): NegociacaoNoEcra[] {
  const base = lerBase(pedido.baseDoPreco);
  const pedidoId = Number(pedido.id);
  /*
   * A MESMA REGRA DAS OUTRAS PORTAS — 26-10-2026 (d33): um Trabalho CLYON não
   * mostra negociação nenhuma (o valor dela é o que o profissional recebe), só
   * quem fez proposta, sem a taxa do profissional. Ver
   * `negociacoes-para-o-cliente.ts`.
   */
  return negociacoesParaOCliente(linhas, pedido.trabalhoClyon).map((n) =>
    negociacaoParaOEcra(
      negociacaoParaAVista(n as unknown as LinhaParaAVista, {
        porCarga: base === "carga",
        porHora: base === "hora",
        horasPrevistas: base === "hora" ? horasPrevistasDaLinha(pedido as Record<string, unknown>) : null,
        agora,
        // A guia antes de contratar (04-11-2026, d10.1): o entulho, ou a guia pedida.
        exigeGuia: trabalhoExigeGuia(pedido as Record<string, unknown>),
      }),
      base,
      agora,
      pedidoId,
    ),
  );
}

/**
 * Um pedido da conta, para o ecrã: as colunas do pedido, as negociações já
 * prontas, o histórico pela lista fechada (d33), e o estado em palavras e a
 * novidade pela mesma conta da app (S9: a conta deixa de dizer «Novo», «Em
 * análise», «Aprovado»). O histórico em bruto e as linhas das negociações não
 * saem daqui.
 */
export async function pedidoDaContaParaOEcra<T extends Record<string, unknown>>(
  pedido: T,
  linhas: Linha[] | undefined,
  agora: Date = new Date(),
) {
  const resumo = await resumoDoPedidoParaOCliente(
    pedido as unknown as PedidoParaOResumo,
    (linhas ?? []) as Parameters<typeof resumoDoPedidoParaOCliente>[1],
    agora,
  );
  return {
    ...pedido,
    estadoTexto: resumo.estadoTexto,
    novidade: resumo.novidade,
    negociacoes: negociacoesDaContaNoEcra(
      pedido as T & { id: unknown; trabalhoClyon?: unknown; baseDoPreco?: unknown },
      linhas,
      agora,
    ),
    // O histórico só pela lista fechada, como a página (d33, 26-10-2026).
    historyJson: historicoParaOCliente(pedido.historyJson, { trabalhoClyon: pedido.trabalhoClyon }),
    /*
     * O PREÇO DE UM TRABALHO CLYON (S20, P8 (a), 29-10-2026): só depois de
     * enviado, já em texto. O valor fixo (o que o profissional recebe) e a taxa
     * lêem-se aqui, no servidor, e não saem.
     */
    ...(await (async () => {
      const t = pedido.trabalhoClyon;
      if (!(t === true || Number(t) === 1)) return { precoClyon: null, fimClyon: null };
      const { getSimulatorOrderById, negociacoesDoPedido } = await import("@/lib/db");
      const completo = await getSimulatorOrderById(Number(pedido.id));
      if (!completo) return { precoClyon: null, fimClyon: null };
      const precoClyon = pedido.propostaEnviadaEm
        ? precoClyonParaOCliente(completo as unknown as Parameters<typeof precoClyonParaOCliente>[0])
        : null;
      /*
       * O FIM DO TRABALHO CLYON TAMBÉM NA CONTA — 05-11-2026 (d20): com o
       * parceiro escolhido, o preço já foi acordado; a conta mostra o dia, as
       * formas de pagar e, depois de feito, a avaliação — a mesma lista fechada
       * de campos do link e da app (`fim-do-trabalho-clyon.ts`).
       */
      const fimClyon = fimDoTrabalhoClyonParaOCliente(
        completo as unknown as Parameters<typeof fimDoTrabalhoClyonParaOCliente>[0],
        (await negociacoesDoPedido(Number(pedido.id))) as unknown as LinhaDoTrabalhoClyon[],
      );
      return { precoClyon, fimClyon };
    })()),
  };
}
