import { marcasDasNegociacoes } from "./marcas-da-divida-na-base";
import { lerAcordoFinal } from "@/lib/acordo-final";
import { reservasDe } from "@/lib/reserva-na-base";
import { reservaDaLinha } from "@/lib/reserva";
import type { MarcaDaParte } from "./cobrancas-ao-profissional";
import { ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "@/lib/db";
import { taxaAbaixoDoEscalao, taxaPeloValor } from "@/lib/oferta-clyon";
import { faseDoDinheiro, recebidoDoCliente } from "@/lib/dinheiro-do-trabalho";
import { lerComoPagou, lerParaQue, valorDoPagamento, type ComoPagou, type ParaQue } from "@/lib/pagamento-declarado";
import { quantoOProfissionalRecebe, taxasDaNegociacao, contaDoCliente, type Taxas } from "@/lib/taxas-plataforma";
import { eSemFactura, modeloDaLinha, pagouSemFactura, paraQueDaLinha } from "@/lib/sem-factura";
import { dividaDoProfissional, temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { lerForma } from "@/lib/forma-de-pagamento";
import { contaDaLinha, eTrabalhoClyon, type ContaDoPagamento } from "@/lib/conta-do-pagamento";
import { precoClyonDesalinhado, precoDoTrabalhoClyonDaLinha } from "@/lib/corrigir-trabalho-clyon";
import { taxaDoPagoEmMao, type TaxaDoPagoEmMao } from "@/lib/a-quem-foi-o-dinheiro";
import { PREFIXO_DO_ABATIMENTO_A_PARTE } from "@/lib/pago-em-mao";
import { CORRIGEM_SE, valoresDeReferencia } from "@/lib/corrigir-pagamento-registado";
import type { ComoEntrou } from "@/lib/dinheiro-do-trabalho";
import { contaDoNovoModelo, contaDoRegistoNoNovoModelo } from "@/lib/conta-do-pagamento";

const aosCentimosDaLinha = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
import { contaDoValorAcordado } from "@/lib/pagamento-directo";
import { regimeDaNegociacao } from "@/lib/total-ao-cliente";
import { taxaAPassarAClyon } from "@/lib/taxa-a-passar-a-clyon";
import { contratadasNoNovoModelo } from "@/lib/novo-modelo-no-servidor";
import { agoraDoModelo } from "@/lib/relogio-do-modelo";
import { dividaDoRegistoEmMao, pagoAoProfissionalRegistado } from "@/lib/pago-em-mao";
import { instanteDaBase } from "@/lib/hora-de-lisboa";

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
  /**
   * O CLIENTE PAGOU SEM FACTURA, e porquê — 25-10-2026 (d19). Marcada nos
   * Pagamentos ou declarada ao confirmar (`pagouSemFactura`); o motivo é nulo
   * nos de antes da regra («sem motivo registado»).
   */
  pagouSemFactura: boolean;
  motivoSemFactura: string | null;
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
   * É o dia em que foi feito (`feitoEm`, d36), ou o combinado com o cliente,
   * ou o que ele pediu, ou — se não houver nenhum — o dia do «Está feito».
   */
  dataDoTrabalho: string | null;
  /** Quando foi feito (`feitoEm`, d36 — o fim da folha num trabalho à hora); nos de antes, o «Está feito». */
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
  /**
   * PAGO EM MÃO: A PARTE DA CLYON, E SE JÁ ESTÁ COBRADA — 03-11-2026 (d3).
   * Nula nos que o cliente paga à CLYON. Ver `taxaDoPagoEmMao`.
   */
  taxaEmMao: TaxaDoPagoEmMao | null;
  /**
   * CORRIGIR O PAGAMENTO REGISTADO À MÃO — 04-11-2026 (d9). O valor que ficou
   * registado, o que a declaração diz, e o que a conta dá com e sem fatura.
   * Nulo onde não se corrige (euPago, dinheiro, por registar).
   */
  correccao: {
    valorRegistado: number | null;
    declarado: ParaQue | null;
    comFactura: number | null;
    semFactura: number | null;
  } | null;
  /**
   * O MODELO DE 15-11-2026 — d31 (`contratadasNoNovoModelo`). O cliente pagou
   * ao profissional diretamente: `clientePaga` é o total que lhe pagou,
   * `dividaDoProfissional` a taxa e o IVA dela que ele passa à CLYON, e o
   * pagamento da negociação (`clientePagouEm`) é o DELE. Nunca «por receber do
   * cliente» nem «por pagar ao profissional». Ausente no modelo antigo.
   */
  novoModelo?: true;
  /**
   * d82 (21-11-2026): um Trabalho CLYON (o botão «O cliente paga à CLYON» só
   * existe nestes) e a passagem do administrador ao caminho em que o cliente
   * paga à CLYON — quando, por quem e porquê. Nula = o caminho de sempre.
   */
  trabalhoClyon?: boolean;
  clientePagaAClyon?: { em: string | null; por: string | null; motivo: string | null } | null;
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
    `SELECT n.id AS negociacaoId, n.pedidoId, n.providerId, n.valorAcordado, n.estado, n.provaJson,
            -- O regime do modelo de 15-11 (d31): o congelado ao contratar, ou o do perfil.
            n.regimeDoProfissional, pr.regimeIva, pr.regimeIvaConfirmadoEm,
            n.taxaCliente, n.taxaProfissional, n.formaDePagamento,
            n.confirmadoEm, n.pagoEm, n.dataCombinada, n.execucaoEnviadaEm, n.feitoEm,
            n.pagamentoParaQue, n.pagamentoComo, n.pagamentoDeclaradoEm, n.pagamentoDeclaradoPor,
            n.createdAt AS negociacaoCriadaEm, n.semFactura, n.motivoSemFactura,
            -- O acordo final com o cliente, abaixo do pago ao profissional (d78).
            n.acordoFinalCliente, n.acordoFinalMotivo,
            -- O cliente paga à CLYON, por decisão do administrador (d82).
            n.clientePagaAClyonEm, n.clientePagaAClyonPor, n.clientePagaAClyonMotivo,
            -- Um Trabalho CLYON faz a conta pelo valor e pela taxa do pedido (15-10-2026).
            n.ofertaClyon, o.valorFixoClyon, o.taxaClyon, o.precoClienteClyon, o.motivoTaxaClyon,
            o.contactName, o.contactPhone, o.city, o.serviceType, o.dataAgendada,
            o.createdAt AS pedidoCriadoEm,
            pr.name AS profissional, COALESCE(pr.contaDeTeste, 0) AS contaDeTeste,
            pg.metodo AS comoEntrou, pg.pagoEm AS clientePagouEm, pg.valorPago AS valorQueEntrou,
            -- Pago em mão num trabalho da plataforma: a parte da CLYON fecha-se
            -- numa linha à parte, pelo trid (03-11-2026, d3) — com o método e o
            -- valor, para dizer como se fechou (04-11-2026, d9). O trid é único:
            -- a junção nunca duplica a linha.
            ap.pagoEm AS taxaAParteEm, ap.metodo AS taxaAParteComo,
            COALESCE(ap.valorPago, ap.valor) AS taxaAParteValor
       FROM negociacoes n
       JOIN providers pr ON pr.id = n.providerId
       LEFT JOIN simulatorOrders o ON o.id = n.pedidoId
       LEFT JOIN pagamentos pg ON pg.negociacaoPaga = n.id
       LEFT JOIN pagamentos ap
              ON ap.trid = CONCAT(?, n.id) AND ap.estado = 'pago' AND ap.negociacaoPaga IS NULL
      WHERE n.estado = 'acordada' AND n.valorAcordado IS NOT NULL
        ${soA ? "AND n.id = ?" : ""}
      ORDER BY n.updatedAt DESC
      LIMIT 400`,
    // Só uma negociação — a do comprovativo (24-10-2026). O prefixo vem
    // primeiro: está na lista das colunas, antes do WHERE.
    soA ? [PREFIXO_DO_ABATIMENTO_A_PARTE, soA] : [PREFIXO_DO_ABATIMENTO_A_PARTE],
  )) as [Array<Record<string, unknown>>, unknown];

  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

  /*
   * AS PARTES DA DÍVIDA PAGAS À PARTE — 11-11-2026 (dono). O IVA (ou a taxa)
   * marcado nos Pagamentos › A receber dos profissionais, sem linha em
   * `pagamentos`: a parte da CLYON por cobrar desconta-o.
   */
  const marcas = await marcasDasNegociacoes(
    (linhas as Array<Record<string, unknown>>).map((l) => Number(l.negociacaoId)).filter((n) => n > 0),
  ).catch(() => new Map<number, MarcaDaParte[]>());
  const pagoEmPartes = (negociacaoId: number) =>
    Math.round(
      (marcas.get(negociacaoId) ?? []).filter((m) => m.pagamentoId == null).reduce((s, m) => s + m.valor, 0) * 100,
    ) / 100;

  /*
   * O MODELO DE 15-11-2026 — d31. Que trabalhos seguem o modelo novo: a regra
   * de `segueONovoModelo`, com os pagamentos de todos lidos de uma vez. Se a
   * leitura falhar, a lista falha (a rota diz o porquê): adivinhar o modelo
   * mostrava «por receber do cliente» dinheiro que nunca vem à CLYON.
   */
  const doNovoModelo = await contratadasNoNovoModelo(
    (linhas as Array<Record<string, unknown>>).map((l) => ({
      id: Number(l.negociacaoId),
      ofertaClyon: l.ofertaClyon,
      // d33: a criação do pedido decide o modelo de um Trabalho CLYON.
      pedidoCriadoEm: (l.pedidoCriadoEm as Date | string | null) ?? null,
      estado: l.estado,
      execucaoEnviadaEm: l.execucaoEnviadaEm,
      provaJson: l.provaJson,
      confirmadoEm: l.confirmadoEm,
      pagoEm: l.pagoEm,
    })),
    agoraDoModelo(),
  );

  // A reserva do valor único (d39), só nos do modelo de 15-11.
  const reservas = await reservasDe([...doNovoModelo]).catch(() => new Map<number, number>());

  const lComAReserva = (l: (typeof linhas)[number]) => ({ ...l, reservaCent: reservas.get(Number(l.negociacaoId)) ?? null });

  return linhas.map((l) => {
    const acordado = Number(l.valorAcordado);
    const taxas = taxasDaNegociacao(l);
    // Registado «pago ao profissional» à mão também é do modelo novo (o #588): a parte da
    // CLYON segue a regra de sempre do pago em mão, a mesma da carteira — ver `noNovoModelo`.
    const novoModelo = doNovoModelo.has(Number(l.negociacaoId));
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
     * Trabalho CLYON segue a mesma regra desde 27-10-2026 (d16) — ver
     * `recebidoDoCliente`.
     */
    const trabalhoClyon = eTrabalhoClyon(l);
    const recebido = recebidoDoCliente({
      clientePagouEm: l.clientePagouEm,
      declaradoComo: declarado?.como ?? null,
      formaDePagamento: l.formaDePagamento,
      confirmadoEm: l.confirmadoEm,
    });
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
    const linha: TrabalhoParaGerir & { valorDesalinhado: boolean } = {
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
        lerAcordoFinal(l) != null && conta ? conta.total : trabalhoClyon && conta ? conta.total : valorDoPagamento(contaDoCliente(acordado, taxas), paraQueDaLinha(l), modelo),
      ivaIncluido: modelo === "iva_incluido",
      // Com ou sem factura (21-10-2026): muda-se antes de o pagamento do cliente entrar.
      semFactura: eSemFactura(l),
      // E, se foi sem, porquê (25-10-2026, d19).
      pagouSemFactura: pagouSemFactura(l, l.negociacaoCriadaEm as Date | string | null),
      motivoSemFactura: ((l.motivoSemFactura as string) ?? "").trim() || null,
      trabalhoClyon,
      clientePagaAClyon: l.clientePagaAClyonEm
        ? {
            em: instanteDaBase(l.clientePagaAClyonEm as Date | string | null)?.toISOString() ?? null,
            por: (l.clientePagaAClyonPor as string) ?? null,
            motivo: (l.clientePagaAClyonMotivo as string) ?? null,
          }
        : null,
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
              ? "Já se pagou ao profissional, e sem fatura as taxas juntam-se — ele receberia outro valor. Para mudar agora, corrija o valor."
              : null,
      declarado,
      profissionalRecebe: quantoOProfissionalRecebe(acordado, taxas),
      // O preço do Trabalho CLYON não bate com o valor acordado (19-10-2026, o #447).
      valorDesalinhado: trabalhoClyon && precoClyonDesalinhado(precoDoTrabalhoClyonDaLinha(l), acordado),
      ...base,
      fase: faseDoDinheiro(base),
      recebido,
      // d36 (15-11-2026): feito, é o dia em que foi feito; senão o combinado, o pedido, ou o «Está feito».
      dataDoTrabalho: iso(l.feitoEm) ?? iso(l.dataCombinada) ?? iso(l.dataAgendada) ?? iso(l.execucaoEnviadaEm),
      feitoEm: iso(l.feitoEm) ?? iso(l.execucaoEnviadaEm),
      pedidoCriadoEm: iso(l.pedidoCriadoEm),
      agendadoPara: iso(l.dataCombinada) ?? iso(l.dataAgendada),
      conta,
      taxaAbaixo,
      taxaEmMao: taxaDoPagoEmMao({
        formaDePagamento: (l.formaDePagamento as string) ?? null,
        comoEntrou: (l.comoEntrou as string) ?? null,
        dividaDoProfissional: divida,
        clientePagouEm: l.clientePagouEm ?? null,
        valorAcordado: acordado,
        taxas,
        valorQueEntrou: l.valorQueEntrou == null ? null : Number(l.valorQueEntrou),
        taxaAParteEm: l.taxaAParteEm ?? null,
        taxaAParteComo: (l.taxaAParteComo as string) ?? null,
        taxaAParteValor: l.taxaAParteValor == null ? null : Number(l.taxaAParteValor),
        jaPagoEmPartes: pagoEmPartes(Number(l.negociacaoId)),
      }),
      /*
       * CORRIGIR O PAGAMENTO REGISTADO — 04-11-2026 (d9). Só nos registados à
       * mão (transferência, numerário, pago ao profissional), fora do dinheiro
       * combinado: o valor registado e o que a conta dá com e sem fatura.
       */
      correccao:
        l.clientePagouEm != null &&
        lerForma(l.formaDePagamento) !== "dinheiro" &&
        CORRIGEM_SE.includes(String(l.comoEntrou ?? "") as ComoEntrou)
          ? {
              valorRegistado: l.valorQueEntrou == null ? null : Number(l.valorQueEntrou),
              declarado: lerParaQue(l.pagamentoParaQue),
              ...valoresDeReferencia(l),
            }
          : null,
    };
    return novoModelo
      ? noNovoModelo(linha, lComAReserva(l), pagoEmPartes(Number(l.negociacaoId)))
      : linha;
  });
}

/**
 * UM TRABALHO DO MODELO DE 15-11-2026 NOS PAGAMENTOS — d31 (CEO e dono,
 * 15-11-2026). O cliente pagou-lhe diretamente; o pagamento da negociação é o
 * do profissional (a taxa e o IVA dela), como no dinheiro. Por isso:
 *
 *   · `clientePaga` é o total que o cliente pagou ao profissional;
 *   · `profissionalRecebe` é a fatura dele (o que fica com ele);
 *   · `dividaDoProfissional` é a taxa por receber dele (a taxa + o IVA dela);
 *   · a conta em degraus é a do modelo novo (`contaDoNovoModelo`) — nunca
 *     «A receber do cliente» nem «A pagar ao profissional»;
 *   · a fase e os separadores lêem `novoModelo` (`pagouAoProfissional`):
 *     nunca «Por receber do cliente» nem «Por pagar ao profissional»;
 *   · sem comprovativo de recebimento ao cliente, sem mudar a fatura e sem
 *     corrigir o pagamento do cliente — a CLYON não o recebeu.
 *
 * Exportada para os testes provarem os dois modelos sem base.
 */
export function noNovoModelo<T extends TrabalhoParaGerir>(
  linha: T,
  l: Record<string, unknown>,
  jaPagoEmPartes = 0,
): T {
  const acordado = linha.valorAcordado;
  /*
   * REGISTADO «PAGO AO PROFISSIONAL» (o #588). A linha da negociação é o
   * registo de que o cliente lhe pagou; a parte da CLYON é a da regra do pago
   * em mão (`taxaEmMao`, a linha à parte), a mesma que a carteira dele cobra —
   * não se inventa outro número. `clientePagouEm` passa a ser o da taxa.
   */
  if (pagoAoProfissionalRegistado(linha.formaDePagamento, linha.comoEntrou)) {
    const entrou = l.valorQueEntrou == null ? null : Number(l.valorQueEntrou);
    const d = dividaDoRegistoEmMao(acordado, linha.taxas, entrou);
    const taxaPaga = linha.taxaEmMao?.cobrada === true;
    const taxaEm = taxaPaga && l.taxaAParteEm ? new Date(l.taxaAParteEm as string).toISOString() : null;
    const base = {
      formaDePagamento: linha.formaDePagamento,
      comoEntrou: linha.comoEntrou,
      clientePagouEm: taxaPaga ? (taxaEm ?? linha.clientePagouEm) : null,
      confirmadoEm: linha.confirmadoEm,
      pagoEm: linha.pagoEm,
      dividaDoProfissional: d.total,
      novoModelo: true,
    };
    return {
      ...linha,
      ...base,
      novoModelo: true,
      clientePaga: d.recebidoDoCliente,
      profissionalRecebe: aosCentimosDaLinha(d.recebidoDoCliente - d.total),
      fase: faseDoDinheiro(base),
      recebido: false,
      podeMudarFactura: false,
      porqueNaoMudaFactura:
        "No modelo de 15/11 o cliente paga ao profissional, e a fatura do trabalho é dele — aqui não se muda.",
      conta: contaDoRegistoNoNovoModelo(d, linha.taxas.cliente + linha.taxas.profissional, taxaPaga),
    };
  }
  const regime = regimeDaNegociacao(l);
  // A reserva do valor único (d39), lida à parte e posta na linha por quem chama.
  const reserva = reservaDaLinha(l);
  const c = contaDoValorAcordado(acordado, linha.taxas, regime, reserva);
  const taxa = taxaAPassarAClyon(acordado, linha.taxas, regime, reserva);
  const divida = taxa ? taxa.total : null;
  const base = {
    formaDePagamento: linha.formaDePagamento,
    comoEntrou: linha.comoEntrou,
    clientePagouEm: linha.clientePagouEm,
    confirmadoEm: linha.confirmadoEm,
    pagoEm: linha.pagoEm,
    dividaDoProfissional: divida,
    novoModelo: true,
  };
  return {
    ...linha,
    ...base,
    novoModelo: true,
    clientePaga: c ? c.totalAoClienteCent / 100 : linha.clientePaga,
    profissionalRecebe: c ? c.ficaAoProfissionalCent / 100 : linha.profissionalRecebe,
    fase: faseDoDinheiro(base),
    recebido: false,
    podeMudarFactura: false,
    porqueNaoMudaFactura:
      "No modelo de 15/11 o cliente paga ao profissional, e a fatura do trabalho é dele — aqui não se muda.",
    conta: contaDoNovoModelo(acordado, linha.taxas, regime, linha.clientePagouEm != null, reserva),
    taxaEmMao: taxaDoPagoEmMao({
      formaDePagamento: linha.formaDePagamento,
      comoEntrou: linha.comoEntrou,
      dividaDoProfissional: divida,
      clientePagouEm: linha.clientePagouEm,
      valorAcordado: acordado,
      taxas: linha.taxas,
      jaPagoEmPartes,
      novoModelo: true,
    }),
    correccao: null,
  };
}

/**
 * A MORADA INTEIRA — dono, 30-10-2026: o comprovativo do cliente leva a morada
 * exacta (ele mostra-o na câmara). Junta o que houver, sem repetir a localidade
 * quando a morada já a traz.
 */
export function moradaCompleta(rua: unknown, andar: unknown, codigoPostal: unknown, localidade: unknown): string | null {
  const r = String(rua ?? "").trim();
  const a = String(andar ?? "").trim();
  const cp = String(codigoPostal ?? "").trim();
  const loc = String(localidade ?? "").trim();
  const fim = [cp && !r.includes(cp) ? cp : "", loc && !r.toLowerCase().includes(loc.toLowerCase()) ? loc : ""].filter(Boolean).join(" ");
  const texto = [r, a && !r.includes(a) ? a : "", fim].filter(Boolean).join(", ");
  return texto || null;
}
