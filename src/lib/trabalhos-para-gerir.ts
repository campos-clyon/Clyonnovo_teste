import { ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "@/lib/db";
import { taxaAbaixoDoEscalao, taxaPeloValor } from "@/lib/oferta-clyon";
import { faseDoDinheiro } from "@/lib/dinheiro-do-trabalho";
import { lerComoPagou, lerParaQue, valorDoPagamento, type ComoPagou, type ParaQue } from "@/lib/pagamento-declarado";
import { quantoOProfissionalRecebe, taxasDaNegociacao, contaDoCliente, type Taxas } from "@/lib/taxas-plataforma";
import { eSemFactura, modeloDaLinha, paraQueDaLinha } from "@/lib/sem-factura";
import { dividaDoProfissional, temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { lerForma } from "@/lib/forma-de-pagamento";
import { contaDaLinha, eTrabalhoClyon, type ContaDoPagamento } from "@/lib/conta-do-pagamento";
import { precoClyonDesalinhado, precoDoTrabalhoClyonDaLinha } from "@/lib/corrigir-trabalho-clyon";

/*
 * OS TRABALHOS DOS PAGAMENTOS — cada negociação fechada, com as duas pontas
 * do dinheiro e a conta em degraus. Viveu dentro da rota dos Pagamentos até
 * 24-10-2026; saiu para aqui para o comprovativo em PDF
 * (`/api/admin/pagamentos/comprovativo`) ler exactamente os mesmos números —
 * uma rota do Next não pode emprestar funções a outra.
 */
export type TrabalhoParaGerir = {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  cliente: string | null;
  telefoneDoCliente: string | null;
  cidade: string | null;
  servico: string | null;
  profissional: string;
  /** Conta marcada como de teste nos Profissionais — exclui-se sem restrição. */
  contaDeTeste: boolean;
  /** O valor do trabalho, sem taxas — o número que se corrige. */
  valorAcordado: number;
  /** As taxas desta negociação, para o ecrã refazer a conta ao corrigir. */
  taxas: Taxas;
  /**
   * O que o cliente paga. Com factura (o total com IVA) a não ser que a
   * declaração diga «sem factura» — então é o trabalho mais a taxa.
   */
  clientePaga: number;
  /**
   * O que ficou dito ao dar o trabalho por feito — ver `pagamento-declarado.ts`.
   * `null` = confirmado antes de haver a pergunta, ou ainda não confirmado.
   */
  declarado: { paraQue: ParaQue; como: ComoPagou; em: string | null; por: string | null } | null;
  /** O que o profissional recebe, líquido. */
  profissionalRecebe: number;
  /**
   * EM DINHEIRO COM IVA INCLUÍDO — o IVA e a comissão que o profissional deve
   * à CLYON. Nulo em tudo o resto. 01-10-2026. Paga-se por referência (ou
   * regista-se à mão, «Já recebemos»), e é esse pagamento que dá a negociação
   * por paga.
   */
  dividaDoProfissional: number | null;
  /** Com IVA incluído (negociação aberta desde `IVA_INCLUIDO_DESDE`). */
  ivaIncluido: boolean;
  /** Marcada sem factura, e se ainda se pode mudar — 21-10-2026. */
  semFactura: boolean;
  podeMudarFactura: boolean;
  porqueNaoMudaFactura: string | null;
  formaDePagamento: string | null;
  comoEntrou: string | null;
  clientePagouEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  fase: string;
  /** O dinheiro do cliente conta como recebido (a mesma regra da conta em degraus) — 24-10-2026, para o comprovativo. */
  recebido: boolean;
  /*
   * O DIA DO TRABALHO — 01-10-2026, para os filtros por datas.
   *
   * As datas que aqui havia eram todas do DINHEIRO: quando o cliente pagou,
   * quando foi confirmado, quando se transferiu. Um trabalho por receber não
   * tem nenhuma delas, e «os trabalhos desta semana» não se podia perguntar.
   * É o dia combinado com o cliente, ou o que ele pediu, ou — se não houver
   * nenhum — o dia em que foi dado por feito.
   */
  dataDoTrabalho: string | null;
  /** Quando foi dado por feito (a prova enviada). */
  feitoEm: string | null;
  /** Quando o pedido entrou — 19-10-2026, «data de criação e de agendamento». */
  pedidoCriadoEm: string | null;
  /** O dia marcado: o combinado com o profissional, ou o que o cliente pediu. Nulo sem nenhum. */
  agendadoPara: string | null;
  /**
   * A CONTA EM DEGRAUS — 15-10-2026. O que o cliente paga, o IVA, as taxas
   * com a sua percentagem e o que vai para o profissional (`conta-do-pagamento.ts`).
   * Nula num Trabalho CLYON antigo sem o preço ao cliente escrito.
   */
  conta: ContaDoPagamento | null;
  /**
   * UM TRABALHO CLYON COM A TAXA ABAIXO DO ESCALÃO — 25-10-2026 (d18): a taxa,
   * a do escalão e o motivo escrito (nulo nos de antes da regra). Nulo em
   * todos os outros.
   */
  taxaAbaixo: { taxa: number; doEscalao: number; motivo: string | null } | null;
};

/**
 * Todos os trabalhos fechados, com as duas pontas do dinheiro numa linha.
 *
 * O `LEFT JOIN` ao pagamento pago é a peça nova: sem ele, «o cliente pagou»
 * era uma pergunta que só se respondia trabalho a trabalho. `negociacaoPaga`
 * tem índice único, por isso o join nunca duplica a linha.
 */
export async function trabalhosParaGerir(soA?: number): Promise<TrabalhoParaGerir[]> {
  // As colunas da declaração são de 29-09-2026: este ecrã pode ser o primeiro
  // a lê-las depois de um deploy, antes de qualquer outro caminho as criar.
  // O mesmo para o motivo da taxa, no pedido (25-10-2026).
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return [];

  const [linhas] = (await pool.execute(
    `SELECT n.id AS negociacaoId, n.pedidoId, n.providerId, n.valorAcordado,
            n.taxaCliente, n.taxaProfissional, n.formaDePagamento,
            n.confirmadoEm, n.pagoEm, n.dataCombinada, n.execucaoEnviadaEm,
            n.pagamentoParaQue, n.pagamentoComo, n.pagamentoDeclaradoEm, n.pagamentoDeclaradoPor,
            n.createdAt AS negociacaoCriadaEm, n.semFactura,
            -- Um Trabalho CLYON faz a conta pelo valor e pela taxa do pedido (15-10-2026).
            n.ofertaClyon, o.valorFixoClyon, o.taxaClyon, o.precoClienteClyon, o.motivoTaxaClyon,
            o.contactName, o.contactPhone, o.city, o.serviceType, o.dataAgendada,
            o.createdAt AS pedidoCriadoEm,
            pr.name AS profissional, COALESCE(pr.contaDeTeste, 0) AS contaDeTeste,
            pg.metodo AS comoEntrou, pg.pagoEm AS clientePagouEm
       FROM negociacoes n
       JOIN providers pr ON pr.id = n.providerId
       LEFT JOIN simulatorOrders o ON o.id = n.pedidoId
       LEFT JOIN pagamentos pg ON pg.negociacaoPaga = n.id
      WHERE n.estado = 'acordada' AND n.valorAcordado IS NOT NULL
        ${soA ? "AND n.id = ?" : ""}
      ORDER BY n.updatedAt DESC
      LIMIT 400`,
    // Só uma negociação — a do comprovativo (24-10-2026).
    soA ? [soA] : [],
  )) as [Array<Record<string, unknown>>, unknown];

  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

  return linhas.map((l) => {
    const acordado = Number(l.valorAcordado);
    const taxas = taxasDaNegociacao(l);
    // As taxas já estão juntas do lado do profissional (marcada sem factura, ou um Trabalho CLYON)?
    // Então mudar a factura só mexe no IVA, e o profissional recebe o mesmo (22-10-2026).
    const soOIva = taxas.cliente === 0;
    const paraQue = lerParaQue(l.pagamentoParaQue);
    const como = lerComoPagou(l.pagamentoComo);
    const modelo = modeloDaLinha(l, l.negociacaoCriadaEm as Date | string | null);
    const divida = temDividaDoProfissional(l.formaDePagamento, modelo)
      ? dividaDoProfissional(acordado, taxas).total
      : null;
    const declarado =
      paraQue && como
        ? {
            paraQue,
            como,
            em: l.pagamentoDeclaradoEm ? new Date(l.pagamentoDeclaradoEm as string).toISOString() : null,
            por: ((l.pagamentoDeclaradoPor as string) ?? "").trim() || null,
          }
        : null;
    /*
     * A CONTA EM DEGRAUS — 15-10-2026. O dinheiro do cliente conta como
     * recebido quando entrou (pagamento registado), quando ele disse que pagou
     * e se anotou, ou, em dinheiro, quando o trabalho está confirmado. Um
     * Trabalho CLYON nunca se cobra pela plataforma: conta como recebido ao
     * ser confirmado, como na carteira (`oClientePagou`).
     */
    const trabalhoClyon = eTrabalhoClyon(l);
    const recebido = trabalhoClyon
      ? l.confirmadoEm != null
      : l.clientePagouEm != null ||
        (declarado != null && declarado.como !== "ainda_nao") ||
        (lerForma(l.formaDePagamento) === "dinheiro" && l.confirmadoEm != null);
    const conta = contaDaLinha(l, recebido);
    // A taxa de um Trabalho CLYON abaixo do escalão, e porquê (25-10-2026, d18).
    const fixo = l.valorFixoClyon == null ? null : Number(l.valorFixoClyon);
    const taxaClyon = l.taxaClyon == null ? null : Number(l.taxaClyon);
    const taxaAbaixo =
      trabalhoClyon && fixo != null && taxaClyon != null && taxaAbaixoDoEscalao(fixo, taxaClyon)
        ? {
            taxa: taxaClyon,
            doEscalao: taxaPeloValor(fixo),
            motivo: ((l.motivoTaxaClyon as string) ?? "").trim() || null,
          }
        : null;
    const base = {
      formaDePagamento: (l.formaDePagamento as string) ?? null,
      comoEntrou: (l.comoEntrou as string) ?? null,
      clientePagouEm: iso(l.clientePagouEm),
      confirmadoEm: iso(l.confirmadoEm),
      pagoEm: iso(l.pagoEm),
      dividaDoProfissional: divida,
    };
    return {
      negociacaoId: Number(l.negociacaoId),
      pedidoId: Number(l.pedidoId),
      providerId: Number(l.providerId),
      cliente: ((l.contactName as string) ?? "").trim() || null,
      telefoneDoCliente: ((l.contactPhone as string) ?? "").trim() || null,
      cidade: (l.city as string) ?? null,
      servico: (l.serviceType as string) ?? null,
      profissional: String(l.profissional ?? ""),
      contaDeTeste: Number(l.contaDeTeste) === 1,
      valorAcordado: acordado,
      taxas,
      // Num Trabalho CLYON o cliente paga o preço dele com IVA — num antigo, o
      // valor era o do profissional, e a conta das taxas dava outro número.
      clientePaga:
        trabalhoClyon && conta ? conta.total : valorDoPagamento(contaDoCliente(acordado, taxas), paraQueDaLinha(l), modelo),
      ivaIncluido: modelo === "iva_incluido",
      // Com ou sem factura (21-10-2026): muda-se antes de o pagamento do cliente entrar.
      semFactura: eSemFactura(l),
      // Quando só mexe no IVA o profissional recebe o mesmo: muda-se também depois de lhe pagar.
      podeMudarFactura:
        lerForma(l.formaDePagamento) !== "dinheiro" &&
        l.clientePagouEm == null &&
        (l.pagoEm == null || soOIva),
      porqueNaoMudaFactura:
        lerForma(l.formaDePagamento) === "dinheiro"
          ? "Em dinheiro o profissional recebe em mão — aqui não se muda."
          : l.clientePagouEm != null
            ? "O pagamento do cliente já está registado — para mudar agora, corrija o valor."
            : l.pagoEm != null && !soOIva
              ? "Já se pagou ao profissional, e sem factura as taxas juntam-se — ele receberia outro valor. Para mudar agora, corrija o valor."
              : null,
      declarado,
      profissionalRecebe: quantoOProfissionalRecebe(acordado, taxas),
      // O preço do Trabalho CLYON não bate com o valor acordado (19-10-2026, o #447).
      valorDesalinhado: trabalhoClyon && precoClyonDesalinhado(precoDoTrabalhoClyonDaLinha(l), acordado),
      ...base,
      fase: faseDoDinheiro(base),
      recebido,
      dataDoTrabalho: iso(l.dataCombinada) ?? iso(l.dataAgendada) ?? iso(l.execucaoEnviadaEm),
      feitoEm: iso(l.execucaoEnviadaEm),
      pedidoCriadoEm: iso(l.pedidoCriadoEm),
      agendadoPara: iso(l.dataCombinada) ?? iso(l.dataAgendada),
      conta,
      taxaAbaixo,
    };
  });
}
