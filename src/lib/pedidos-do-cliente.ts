import {
  ensureSimulatorOrdersTable,
  getPool,
  getSimulatorOrderById,
  marcarVistoPeloCliente,
  negociacoesDoPedido,
} from "@/lib/db";
import { negociacoesParaOCliente } from "@/lib/negociacoes-para-o-cliente";
import { negociacaoParaAVista, QUANDO_EM_PALAVRAS, type NegociacaoDoCliente } from "@/lib/negociacao-na-vista";
import { negociacoesDaVistaDoCliente } from "@/lib/vista-do-pedido";
import { historicoParaOCliente, type EntradaParaOCliente, aClyonPrecisaDeSi, mensagensDoPedido } from "@/lib/historico-para-o-cliente";
import { lerBase, avisoDaBaseParaOCliente } from "@/lib/base-do-preco";
import { avisoDosItens, notaDoPrecoParaOCliente } from "@/lib/itens-a-mais";
import { nomeDoServico } from "@/lib/service-categories";
import { faseParaOCliente } from "@/lib/trabalho";
import { modeloDaLinha } from "@/lib/sem-factura";
import { temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { lerForma } from "@/lib/forma-de-pagamento";
import { trabalhoQueSePodePagar } from "@/lib/acesso-ao-pagamento";
import { estadoDoPagamentoParaOCliente } from "@/lib/pagamento-para-o-cliente";
import { pagamentosDaNegociacao } from "@/lib/pagamentos-na-base";
import { NOME_DO_METODO } from "@/lib/eupago";
import { precoDaPropostaClyon } from "@/lib/proposta-clyon-ao-cliente";
import { ORCAMENTOS_A_DISTANCIA, ORCAMENTO_A_DISTANCIA } from "@/lib/orcamento-a-distancia";
import { RECUSAR } from "@/lib/recusar-proposta";
import { negociacaoParaOEcra } from "@/lib/negociacao-no-ecra";
import { alteracoesParaAApp, faseDaAlteracao } from "@/lib/alteracoes-do-cliente";
import {
  RODAPE_DO_PEDIDO,
  acessoDoPedido,
  atalhosDaContraproposta,
  dataPreferidaTexto,
  fotografiasDoPedido,
  repeticaoEmPalavras,
  responderamEmPalavras,
  videosDoPedido,
} from "@/lib/pedido-completo-para-a-app";
import {
  contratadoDaLinha,
  diaCurtoEmLisboa,
  esperaPeloCliente,
  estadoDoPedidoParaOCliente,
  isoOuNulo,
  negociacaoParaAApp,
  novidadeDoPedido,
  pedidoFechado,
  pesoDaNovidade,
  quandoEmLisboa,
  textosDaConta,
  type ContratadoDoPedido,
} from "@/lib/pedido-para-a-app";
import { instanteDaBase } from "@/lib/hora-de-lisboa";

/**
 * OS PEDIDOS DO CLIENTE, PARA A APP — a lista (R4) e o pedido (R5). d8,
 * 28-10-2026.
 *
 * Só os pedidos do email da sessão, sempre: quem chama passa o email de
 * `emailDoCliente` e nunca outro. «Não existe» e «não é seu» dão o mesmo
 * `null` — distinguir dizia a quem tenta que aquele número existe.
 *
 * As negociações passam pela regra de todas as portas
 * (`negociacoesParaOCliente`) e pela conversão da página e da conta
 * (`negociacaoParaAVista`); o histórico pela lista fechada
 * (`historicoParaOCliente`). O texto do dinheiro sai de `pedido-para-a-app.ts`.
 */

export const PEDIDOS_POR_PAGINA = 20;

const emEuros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

function doEmail(pedido: { contactEmail?: string | null } | null | undefined, email: string): boolean {
  return !!pedido && (pedido.contactEmail ?? "").trim().toLowerCase() === email.trim().toLowerCase();
}

function eCancelado(status: unknown, canceladoPeloCliente: unknown): boolean {
  return ["cancelado", "rejeitado", "arquivado"].includes(String(status ?? "")) || Number(canceladoPeloCliente) === 1;
}

/** A linha crua de uma negociação, o bastante para o estado e para a conversão. */
type LinhaCrua = Record<string, unknown> & {
  id: number;
  estado: string;
  pedidoId?: number;
  ofertaClyon?: unknown;
  profissionalNome?: unknown;
  dataCombinada?: Date | string | null;
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
};

/** Quem tem o trabalho: a negociação fechada que o cliente vê, ou — num Trabalho CLYON — a da oferta. */
function contratadoDe(
  trabalhoClyon: boolean,
  cruas: LinhaCrua[],
  visiveis: NegociacaoDoCliente[],
): ContratadoDoPedido | null {
  if (trabalhoClyon) {
    const a = cruas.find((n) => n.estado === "acordada");
    return a
      ? contratadoDaLinha({
          // Para o cliente, pago ao profissional antes de confirmar não fecha (BO27).
          fase: faseParaOCliente({
            estado: a.estado,
            execucaoEnviadaEm: a.execucaoEnviadaEm,
            confirmadoEm: a.confirmadoEm,
            pagoEm: a.pagoEm,
          }),
          profissionalNome: a.profissionalNome,
          dataCombinada: a.dataCombinada ?? null,
          aCaminhoEm: (a.aCaminhoEm as Date | string | null | undefined) ?? null,
          chegouEm: (a.chegouEm as Date | string | null | undefined) ?? null,
          provaJson: (a.provaJson as string | null | undefined) ?? null,
        })
      : null;
  }
  const a = visiveis.find((n) => n.estado === "acordada");
  return a ? contratadoDaLinha(a) : null;
}

/** O cliente tem uma referência por pagar deste trabalho? Nunca lança: na dúvida, não. */
async function temReferenciaPorPagar(n: NegociacaoDoCliente): Promise<boolean> {
  if (n.estado !== "acordada" || (n.fase !== "a_executar" && n.fase !== "a_confirmar")) return false;
  // Em dinheiro com IVA incluído o cliente não paga nada à CLYON: a referência é a dívida do profissional.
  if (temDividaDoProfissional(lerForma(n.formaDePagamento), modeloDaLinha(n, n.criadaEm))) return false;
  try {
    const linhas = await pagamentosDaNegociacao(n.id);
    return linhas.some((p) => p.estado === "pendente") && !linhas.some((p) => p.estado === "pago");
  } catch {
    return false;
  }
}

/** O que o resumo de um pedido lê da linha do pedido. */
export type PedidoParaOResumo = {
  id: unknown;
  status?: unknown;
  canceladoPeloCliente?: unknown;
  trabalhoClyon?: unknown;
  baseDoPreco?: unknown;
  propostaEnviadaEm?: Date | string | null;
  precoAceiteEm?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  /** Para saber se a CLYON espera uma resposta dele (S18). */
  historyJson?: unknown;
};

function ms(v: unknown): number {
  const d = instanteDaBase((v as Date | string | null | undefined) ?? null);
  return d ? d.getTime() : 0;
}

/**
 * O ESTADO E A NOVIDADE DE UM PEDIDO — UMA SÓ CONTA (d8 fase 2, S9). A lista
 * da app (R4), o pedido da app (R5) e a conta do site leem o estado por aqui:
 * o mesmo pedido diz o mesmo em todo o lado. Devolve também as negociações que
 * o cliente vê (pela regra de todas as portas) e a última actividade, para a
 * ordem da lista.
 */
export async function resumoDoPedidoParaOCliente(
  r: PedidoParaOResumo,
  cruas: LinhaCrua[],
  agora: Date = new Date(),
): Promise<{
  estadoTexto: string;
  novidade: string | null;
  ultimaActividade: number;
  visiveis: NegociacaoDoCliente[];
  precisaDeSi: boolean;
}> {
  const trabalhoClyon = Number(r.trabalhoClyon) === 1 || r.trabalhoClyon === true;
  const porCarga = lerBase(r.baseDoPreco) === "carga";
  const visiveis = negociacoesParaOCliente(cruas, trabalhoClyon).map((n) =>
    negociacaoParaAVista(n as LinhaCrua & { estado: string; id: number }, { porCarga, agora }),
  );
  const cancelado = eCancelado(r.status, r.canceladoPeloCliente);
  const contratado = contratadoDe(trabalhoClyon, cruas, visiveis);
  const precoEnviado = trabalhoClyon && !!r.propostaEnviadaEm;
  const precoAceite = trabalhoClyon && !!r.precoAceiteEm;
  const acordada = visiveis.find((n) => n.estado === "acordada") ?? null;
  const precisaDeSi = !cancelado && aClyonPrecisaDeSi(r.status, r.historyJson);
  const estadoTexto = estadoDoPedidoParaOCliente({
    precisaDeSi,
    status: r.status as string | null,
    canceladoPeloCliente: r.canceladoPeloCliente,
    trabalhoClyon,
    contratado,
    comPropostas: visiveis.filter((n) => n.estado === "aberta" || n.estado === "aguarda_contratacao").length,
    enviado: cruas.length > 0,
    precoEnviado,
    precoAceite,
  });
  const novidade = cancelado
    ? null
    : novidadeDoPedido({
        precisaDeSi,
        ajustePorResponder: Boolean(acordada?.ajuste?.pendente),
        porConfirmar: acordada?.fase === "a_confirmar",
        porPagar: acordada ? await temReferenciaPorPagar(acordada) : false,
        precoPorResponder: precoEnviado && !precoAceite && !contratado,
        propostasPorResponder: trabalhoClyon ? 0 : visiveis.filter((n) => esperaPeloCliente(n, agora)).length,
      });
  const ultimaActividade = Math.max(
    ms(r.createdAt),
    ms(r.updatedAt),
    ms(r.propostaEnviadaEm),
    ms(r.precoAceiteEm),
    ...cruas.map((n) => ms(n.updatedAt)),
  );
  return { estadoTexto, novidade, ultimaActividade, visiveis, precisaDeSi };
}

/**
 * A ORDEM DA LISTA (E2): com novidade em cima, pela ordem do que urge; depois
 * os outros em aberto, pela última actividade; no fim os fechados (Concluído,
 * Cancelado), do mais recente para trás. O id desempata, para a ordem ser a
 * mesma de página para página.
 */
export function compararPedidosDaLista(
  a: { id: number; estadoTexto: string; novidade: string | null; ultimaActividade: number },
  b: { id: number; estadoTexto: string; novidade: string | null; ultimaActividade: number },
): number {
  const fa = pedidoFechado(a.estadoTexto) ? 1 : 0;
  const fb = pedidoFechado(b.estadoTexto) ? 1 : 0;
  if (fa !== fb) return fa - fb;
  if (!fa) {
    const pa = pesoDaNovidade(a.novidade);
    const pb = pesoDaNovidade(b.novidade);
    if (pa !== pb) return pa - pb;
  }
  if (a.ultimaActividade !== b.ultimaActividade) return b.ultimaActividade - a.ultimaActividade;
  return b.id - a.id;
}

/** Um cliente tem poucos pedidos: ordenam-se todos e pagina-se depois. */
const MAXIMO_DE_PEDIDOS_DA_LISTA = 500;

/**
 * O CLIENTE LEU ESTAS PROPOSTAS (S11) — a app (R5), a página do link e a conta.
 * Só as que ele vê (as que passaram pela regra de todas as portas). Nunca
 * lança: é uma medida, e não pode estragar a leitura.
 */
export async function marcarVistasPeloCliente(ids: number[]): Promise<void> {
  try {
    await marcarVistoPeloCliente(ids);
  } catch (err) {
    console.error("[visto-pelo-cliente]", err instanceof Error ? err.message : err);
  }
}

// ── R4 — a lista ────────────────────────────────────────────────────────────

export type PedidoNaLista = {
  id: number;
  servico: string;
  cidade: string | null;
  criadoEm: string | null;
  criadoEmTexto: string | null;
  estadoTexto: string;
  novidade: string | null;
  trabalhoClyon: boolean;
  /** A primeira fotografia do pedido, para o cartão (S22). */
  fotografia: string | null;
};

/** Os separadores da lista, os mesmos da conta do site (S22, 29-10-2026). */
export const FILTROS_DA_LISTA = ["todos", "em_aberto", "concluidos", "cancelados"] as const;
export type FiltroDaLista = (typeof FILTROS_DA_LISTA)[number];

export function noFiltro(estadoTexto: string, filtro: FiltroDaLista): boolean {
  if (filtro === "concluidos") return estadoTexto === "Concluído";
  if (filtro === "cancelados") return estadoTexto === "Cancelado";
  if (filtro === "em_aberto") return estadoTexto !== "Concluído" && estadoTexto !== "Cancelado";
  return true;
}

export async function listaDosPedidosDoCliente(
  email: string,
  pagina: number,
  agora: Date = new Date(),
  filtro: FiltroDaLista = "todos",
): Promise<{ pedidos: PedidoNaLista[]; pagina: number; paginas: number; total: number }> {
  const emailNorm = email.trim().toLowerCase();
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("[pedidos-do-cliente] base de dados indisponível");

  const [linhas] = (await pool.execute(
    `SELECT o.id, o.serviceType, o.city, o.status, o.createdAt, o.updatedAt, o.canceladoPeloCliente, o.baseDoPreco,
            -- Só a marca: o valor fixo é o que a CLYON paga ao profissional.
            (o.valorFixoClyon IS NOT NULL) AS trabalhoClyon,
            o.propostaEnviadaEm, o.precoAceiteEm,
            -- Só para saber se a CLYON espera resposta dele (S18): não sai para a app.
            o.historyJson,
            -- Só para a primeira fotografia do cartão (S22).
            o.filesJson
       FROM simulatorOrders o
      WHERE LOWER(TRIM(o.contactEmail)) = ?
      ORDER BY o.createdAt DESC
      LIMIT ${MAXIMO_DE_PEDIDOS_DA_LISTA}`,
    [emailNorm],
  )) as [Array<Record<string, unknown>>, unknown];

  const ids = linhas.map((r) => Number(r.id)).filter((n) => Number.isInteger(n));
  const porPedido = new Map<number, LinhaCrua[]>();
  if (ids.length > 0) {
    const [negs] = (await pool.execute(
      `SELECT n.id, n.pedidoId, n.providerId, n.estado, n.valorAcordado, n.propostasJson,
              n.taxaCliente, n.formaDePagamento, n.createdAt, n.updatedAt, n.semFactura,
              n.execucaoEnviadaEm, n.provaJson, n.confirmadoEm, n.pagoEm, n.ajustesJson,
              n.estrelas, n.dataCombinada, n.aCaminhoEm, n.chegouEm,
              -- Só para a regra a esconder (d33): não sai para o cliente.
              n.ofertaClyon,
              p.name AS profissionalNome, p.phone AS profissionalTelefone,
              p.regimeIva, p.guiaVerificadaEm
         FROM negociacoes n
         JOIN providers p ON p.id = n.providerId
        WHERE n.pedidoId IN (${ids.map(() => "?").join(",")})
        ORDER BY n.updatedAt DESC`,
      ids,
    )) as [LinhaCrua[], unknown];
    for (const n of negs) {
      const k = Number(n.pedidoId);
      if (!porPedido.has(k)) porPedido.set(k, []);
      porPedido.get(k)!.push(n);
    }
  }

  const todos = await Promise.all(
    linhas.map(async (r) => {
      const trabalhoClyon = Number(r.trabalhoClyon) === 1 || r.trabalhoClyon === true;
      const resumo = await resumoDoPedidoParaOCliente(r as PedidoParaOResumo, porPedido.get(Number(r.id)) ?? [], agora);
      const item: PedidoNaLista = {
        id: Number(r.id),
        servico: nomeDoServico(r.serviceType as string | null),
        cidade: (r.city as string | null) ?? null,
        criadoEm: isoOuNulo(r.createdAt as Date | string | null),
        criadoEmTexto: diaCurtoEmLisboa(r.createdAt as Date | string | null),
        estadoTexto: resumo.estadoTexto,
        novidade: resumo.novidade,
        trabalhoClyon,
        fotografia: fotografiasDoPedido(r.filesJson)[0] ?? null,
      };
      return { item, ultimaActividade: resumo.ultimaActividade };
    }),
  );
  todos.sort((a, b) =>
    compararPedidosDaLista(
      { ...a.item, ultimaActividade: a.ultimaActividade },
      { ...b.item, ultimaActividade: b.ultimaActividade },
    ),
  );

  const filtrados = todos.filter((t) => noFiltro(t.item.estadoTexto, filtro));
  const total = filtrados.length;
  const paginas = Math.max(1, Math.ceil(total / PEDIDOS_POR_PAGINA));
  const estaPagina = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
  const inicio = (estaPagina - 1) * PEDIDOS_POR_PAGINA;
  const pedidos = filtrados.slice(inicio, inicio + PEDIDOS_POR_PAGINA).map((t) => t.item);

  return { pedidos, pagina: estaPagina, paginas, total };
}

// ── R5 — o pedido ───────────────────────────────────────────────────────────

/** O pagamento de um trabalho fechado, em texto — o mesmo estado do `GET /api/pagamentos`. */
async function pagamentoParaAApp(pedidoId: number, n: NegociacaoDoCliente, email: string) {
  if (n.estado !== "acordada" || n.fase === "a_negociar") return null;
  const acesso = await trabalhoQueSePodePagar(pedidoId, n.id, { email });
  if (!acesso.ok) return null;
  const e = await estadoDoPagamentoParaOCliente(acesso.trabalho);
  const pago = e.doCliente ? e.pagamentos.find((p) => p.estado === "pago") ?? null : null;
  return {
    disponivel: e.disponivel,
    pago: e.doCliente && e.pago,
    pagoEmTexto: pago ? quandoEmLisboa(pago.pagoEm) : null,
    // Em dinheiro com IVA incluído paga tudo ao profissional, no local: a
    // referência que exista é a dívida DELE, e não sai para o cliente.
    emDinheiroAoProfissional: !e.doCliente,
    pendentes: e.doCliente
      ? e.pagamentos
          .filter((p) => p.estado === "pendente")
          .map((p) => ({
            metodo: p.metodo,
            metodoTexto: NOME_DO_METODO[p.metodo] ?? p.metodo,
            entidade: p.entidade,
            referencia: p.referencia,
            valorTexto: emEuros(Number(p.valor)),
            expiraEm: isoOuNulo(p.expiraEm),
            expiraEmTexto: quandoEmLisboa(p.expiraEm),
          }))
      : [],
    ivaIncluido: e.ivaIncluido,
    valoresTexto: { comFactura: emEuros(e.valores.comFactura), semFactura: emEuros(e.valores.semFactura) },
  };
}

export async function pedidoDoClienteParaAApp(
  pedidoId: number,
  email: string,
  agora: Date = new Date(),
  /** O link aberto na app sem conta (S16): quem chama já confirmou a sessão de convidado para este pedido. */
  opcoes: { convidado?: boolean } = {},
) {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return null;
  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido || (!opcoes.convidado && !doEmail(pedido, email))) return null;

  const o = pedido as typeof pedido & {
    taxaClyon?: string | number | null;
    precoClienteClyon?: string | number | null;
    canceladoPeloCliente?: unknown;
    propostaEnviadaEm?: Date | string | null;
    precoAceiteEm?: Date | string | null;
    alteracaoPendenteEm?: Date | string | null;
  };
  const trabalhoClyon = pedido.valorFixoClyon != null;
  const base = lerBase(pedido.baseDoPreco);
  const [cruas, negociacoes] = await Promise.all([
    negociacoesDoPedido(pedido.id) as Promise<LinhaCrua[]>,
    negociacoesDaVistaDoCliente(pedido, agora),
  ]);

  const contratado = contratadoDe(trabalhoClyon, cruas, negociacoes);
  const cancelado = eCancelado(pedido.status, o.canceladoPeloCliente);
  // O estado em palavras, pela mesma conta da lista e da conta do site (S9).
  const resumo = await resumoDoPedidoParaOCliente(
    { ...(pedido as unknown as PedidoParaOResumo), trabalhoClyon },
    cruas,
    agora,
  );

  /*
   * Um Trabalho CLYON: o preço que a CLYON fechou com ele (com IVA, e o sem IVA
   * ao lado) — SÓ DEPOIS DE ENVIADO (28-10-2026, S7). Antes, a equipa pode
   * ainda estar a acertá-lo, e a app diz «A CLYON está a rever o seu pedido.»
   */
  const enviadoEm = isoOuNulo(o.propostaEnviadaEm ?? null);
  const precoClyon = trabalhoClyon && enviadoEm
    ? precoDaPropostaClyon({
        valorFixo: Number(pedido.valorFixoClyon),
        taxa: o.taxaClyon == null ? null : Number(o.taxaClyon),
        precoAoCliente: o.precoClienteClyon == null ? null : Number(o.precoClienteClyon),
      })
    : null;

  const historico = (() => {
    const texto = historicoParaOCliente(pedido.historyJson, { trabalhoClyon });
    let lista: EntradaParaOCliente[] = [];
    try {
      lista = texto ? (JSON.parse(texto) as EntradaParaOCliente[]) : [];
    } catch {
      lista = [];
    }
    return lista.map((e) => ({ ...e, quandoTexto: quandoEmLisboa(e.createdAt) }));
  })();

  const negociacoesNaApp = await Promise.all(
    negociacoes.map(async (n) => ({
      ...negociacaoParaAApp(n, base, agora),
      ...(() => {
        /*
         * S22 (29-10-2026): a linha do tempo da proposta, os atalhos da
         * contraproposta e as duas entregas dos antigos em dinheiro — as mesmas
         * contas do site (`negociacaoParaOEcra`), já no preço do cliente.
         */
        const ecra = negociacaoParaOEcra(n, base, agora, pedido.id);
        return {
          historico: ecra.historico,
          emDuasEntregas: ecra.emDuasEntregas,
          atalhos: ecra.esperaPorSi && n.estado === "aberta" ? atalhosDaContraproposta(ecra.valores?.aPagar) : [],
        };
      })(),
      // O convidado não paga (R15): vê o estado na própria negociação, sem referência criada aqui.
      pagamento: opcoes.convidado ? null : await pagamentoParaAApp(pedido.id, n, email).catch((err) => {
        console.error("[pedidos-do-cliente] pagamento:", err instanceof Error ? err.message : err);
        return null;
      }),
    })),
  );

  const status = String(pedido.status ?? "");
  const fechado = contratado && (contratado.fase === "confirmado" || contratado.fase === "pago");
  // A primeira leitura das propostas pela app (S11).
  await marcarVistasPeloCliente(negociacoes.map((n) => n.id));

  return {
    pedido: {
      id: pedido.id,
      servico: nomeDoServico(pedido.serviceType),
      estadoTexto: resumo.estadoTexto,
      // A morada é dele: foi ele que a escreveu.
      morada: pedido.address ?? null,
      cidade: pedido.city ?? null,
      quando: pedido.urgency ? (QUANDO_EM_PALAVRAS[pedido.urgency] ?? null) : null,
      descricao: pedido.description ?? null,
      fotos: fotografiasDoPedido(pedido.filesJson),
      // S22: os vídeos à parte (a app abre-os no navegador), o dia preferido, o acesso e a repetição.
      videos: videosDoPedido(pedido.filesJson),
      dataPreferidaTexto: dataPreferidaTexto((pedido as { dataAgendada?: Date | string | null }).dataAgendada ?? null),
      acesso: acessoDoPedido(pedido as unknown as Parameters<typeof acessoDoPedido>[0]),
      repeticao: repeticaoEmPalavras((pedido as { recurrenceFrequency?: unknown }).recurrenceFrequency),
      /*
       * A CONVERSA COM A CLYON (S18, 29-10-2026): o pedido de mais detalhes, as
       * mensagens da CLYON e as respostas dele — «CLYON» ou «Eu», nunca o nome
       * de quem escreveu na equipa; a hora em Lisboa.
       */
      mensagens: mensagensDoPedido(pedido.historyJson).map((m) => ({ ...m, quandoTexto: quandoEmLisboa(m.em) })),
      precisaDeSi: resumo.precisaDeSi,
      // O que se pode alterar, e se há uma alteração à espera da CLYON (S17).
      alteracoes: alteracoesParaAApp({
        fase: faseDaAlteracao({
          status: pedido.status,
          canceladoPeloCliente: o.canceladoPeloCliente,
          trabalhoClyon,
          precoAceite: !!o.precoAceiteEm,
          contratado: cruas.some((n) => n.estado === "acordada"),
          enviado: cruas.length > 0,
        }),
        mudanca: pedido.serviceType === "mudanca",
        pendenteEm: o.alteracaoPendenteEm ?? null,
        contratadoCom: contratado?.profissionalNome ?? null,
      }),
      precisaFatura: Boolean(pedido.precisaFatura),
      precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
      avisos: [avisoDaBaseParaOCliente(base), avisoDosItens(base, "cliente")].filter(
        (a): a is string => typeof a === "string" && a.length > 0,
      ),
      criadoEm: isoOuNulo(pedido.createdAt),
      criadoEmTexto: diaCurtoEmLisboa(pedido.createdAt),
      trabalhoClyon,
      valorClyon:
        precoClyon && enviadoEm
          ? { ...textosDaConta(precoClyon, notaDoPrecoParaOCliente(base, "clyon")), versao: enviadoEm }
          : null,
      // «Aceito este preço» (S7): quando o cliente o aceitou.
      precoAceiteEm: trabalhoClyon ? isoOuNulo(o.precoAceiteEm ?? null) : null,
      precoAceiteEmTexto: trabalhoClyon ? quandoEmLisboa(o.precoAceiteEm ?? null) : null,
      // O que a R8 aceita neste pedido: num Trabalho CLYON, só aceitar o preço enviado.
      accoes:
        trabalhoClyon && enviadoEm && !o.precoAceiteEm && !contratado && !cancelado
          ? ["aceitar_preco_clyon"]
          : [],
      // Quem faz um Trabalho CLYON, depois de escolhido (a CLYON já o diz ao cliente na adjudicação).
      quemFaz: trabalhoClyon && contratado ? contratado.profissionalNome || null : null,
    },
    negociacoes: negociacoesNaApp,
    historico,
    podeCancelar: !trabalhoClyon && !cancelado && status !== "concluido" && !fechado,
    textos: {
      sobreAsPropostas: ORCAMENTOS_A_DISTANCIA,
      sobreOValorCombinado: ORCAMENTO_A_DISTANCIA,
      // «Recusar» (S8): as mesmas perguntas do site.
      recusar: { comOutras: RECUSAR.comOutras, semOutras: RECUSAR.semOutras },
      // S22: o rodapé do site e o título das propostas.
      rodape: RODAPE_DO_PEDIDO,
      responderam: responderamEmPalavras(negociacoes.filter((n) => n.estado === "aberta" || n.estado === "aguarda_contratacao").length),
    },
  };
}

export type PedidoNaApp = NonNullable<Awaited<ReturnType<typeof pedidoDoClienteParaAApp>>>;

/**
 * A VISTA DO CONVIDADO — 29-10-2026 (S16, R12 da Segurança). O link aberto na
 * app sem conta vê o pedido como o link do site: a ZONA e não a morada, e
 * nunca o telefone, o email ou o NIF. É uma lista própria de campos, escrita
 * aqui — não a vista da conta com campos tirados à mão: um campo novo na
 * vista da conta não chega ao convidado sem passar por aqui.
 */
export async function pedidoDoConvidadoParaAApp(pedidoId: number, agora: Date = new Date()) {
  const v = await pedidoDoClienteParaAApp(pedidoId, "", agora, { convidado: true });
  if (!v) return null;
  const p = v.pedido;
  return {
    convidado: true as const,
    pedido: {
      id: p.id,
      servico: p.servico,
      estadoTexto: p.estadoTexto,
      zona: p.cidade,
      quando: p.quando,
      dataPreferidaTexto: p.dataPreferidaTexto,
      descricao: p.descricao,
      fotos: p.fotos,
      videos: p.videos,
      repeticao: p.repeticao,
      mensagens: p.mensagens,
      precisaDeSi: p.precisaDeSi,
      alteracoes: p.alteracoes,
      avisos: p.avisos,
      criadoEm: p.criadoEm,
      criadoEmTexto: p.criadoEmTexto,
      trabalhoClyon: p.trabalhoClyon,
      valorClyon: p.valorClyon,
      precoAceiteEm: p.precoAceiteEm,
      precoAceiteEmTexto: p.precoAceiteEmTexto,
      accoes: p.accoes,
      quemFaz: p.quemFaz,
    },
    negociacoes: v.negociacoes,
    // Sem o nome de quem escreveu na equipa (R12).
    historico: v.historico.map((e) => ({ type: e.type, message: e.message, createdAt: e.createdAt, quandoTexto: e.quandoTexto })),
    podeCancelar: v.podeCancelar,
    textos: v.textos,
  };
}
