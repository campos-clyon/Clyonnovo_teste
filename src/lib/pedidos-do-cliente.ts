import {
  ensureSimulatorOrdersTable,
  getPool,
  getSimulatorOrderById,
  negociacoesDoPedido,
} from "@/lib/db";
import { negociacoesParaOCliente } from "@/lib/negociacoes-para-o-cliente";
import { negociacaoParaAVista, QUANDO_EM_PALAVRAS, type NegociacaoDoCliente } from "@/lib/negociacao-na-vista";
import { negociacoesDaVistaDoCliente } from "@/lib/vista-do-pedido";
import { historicoParaOCliente, type EntradaParaOCliente } from "@/lib/historico-para-o-cliente";
import { lerBase, avisoDaBaseParaOCliente } from "@/lib/base-do-preco";
import { avisoDosItens, notaDoPrecoParaOCliente } from "@/lib/itens-a-mais";
import { nomeDoServico } from "@/lib/service-categories";
import { faseDoTrabalho } from "@/lib/trabalho";
import { modeloDaLinha } from "@/lib/sem-factura";
import { temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { lerForma } from "@/lib/forma-de-pagamento";
import { trabalhoQueSePodePagar } from "@/lib/acesso-ao-pagamento";
import { estadoDoPagamentoParaOCliente } from "@/lib/pagamento-para-o-cliente";
import { pagamentosDaNegociacao } from "@/lib/pagamentos-na-base";
import { NOME_DO_METODO } from "@/lib/eupago";
import { precoDaPropostaClyon } from "@/lib/proposta-clyon-ao-cliente";
import { ORCAMENTOS_A_DISTANCIA, ORCAMENTO_A_DISTANCIA } from "@/lib/orcamento-a-distancia";
import {
  diaCurtoEmLisboa,
  esperaPeloCliente,
  estadoDoPedidoParaOCliente,
  isoOuNulo,
  negociacaoParaAApp,
  novidadeDoPedido,
  quandoEmLisboa,
  textosDaConta,
  type ContratadoDoPedido,
} from "@/lib/pedido-para-a-app";

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

function fotosDoPedido(filesJson: unknown): string[] {
  if (typeof filesJson !== "string") return [];
  try {
    const lista = JSON.parse(filesJson);
    if (!Array.isArray(lista)) return [];
    return lista
      .map((f) => (typeof f === "string" ? f : f && typeof f.url === "string" ? f.url : null))
      .filter((u): u is string => typeof u === "string" && u.length > 0);
  } catch {
    return [];
  }
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
      ? {
          fase: faseDoTrabalho({
            estado: a.estado,
            execucaoEnviadaEm: a.execucaoEnviadaEm,
            confirmadoEm: a.confirmadoEm,
            pagoEm: a.pagoEm,
          }),
          profissionalNome: String(a.profissionalNome ?? ""),
          dataCombinada: a.dataCombinada ?? null,
        }
      : null;
  }
  const a = visiveis.find((n) => n.estado === "acordada");
  return a ? { fase: a.fase, profissionalNome: a.profissionalNome, dataCombinada: a.dataCombinada ?? null } : null;
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
};

export async function listaDosPedidosDoCliente(
  email: string,
  pagina: number,
  agora: Date = new Date(),
): Promise<{ pedidos: PedidoNaLista[]; pagina: number; paginas: number; total: number }> {
  const emailNorm = email.trim().toLowerCase();
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("[pedidos-do-cliente] base de dados indisponível");

  const [contagem] = (await pool.execute(
    "SELECT COUNT(*) AS total FROM simulatorOrders WHERE LOWER(TRIM(contactEmail)) = ?",
    [emailNorm],
  )) as [Array<{ total: number }>, unknown];
  const total = Number(contagem[0]?.total ?? 0);
  const paginas = Math.max(1, Math.ceil(total / PEDIDOS_POR_PAGINA));
  const estaPagina = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
  const offset = (estaPagina - 1) * PEDIDOS_POR_PAGINA;

  const [linhas] = (await pool.execute(
    `SELECT o.id, o.serviceType, o.city, o.status, o.createdAt, o.canceladoPeloCliente, o.baseDoPreco,
            -- Só a marca: o valor fixo é o que a CLYON paga ao profissional.
            (o.valorFixoClyon IS NOT NULL) AS trabalhoClyon
       FROM simulatorOrders o
      WHERE LOWER(TRIM(o.contactEmail)) = ?
      ORDER BY o.createdAt DESC
      LIMIT ${PEDIDOS_POR_PAGINA} OFFSET ${Math.max(0, Math.floor(offset))}`,
    [emailNorm],
  )) as [Array<Record<string, unknown>>, unknown];

  const ids = linhas.map((r) => Number(r.id)).filter((n) => Number.isInteger(n));
  const porPedido = new Map<number, LinhaCrua[]>();
  if (ids.length > 0) {
    const [negs] = (await pool.execute(
      `SELECT n.id, n.pedidoId, n.providerId, n.estado, n.valorAcordado, n.propostasJson,
              n.taxaCliente, n.formaDePagamento, n.createdAt, n.semFactura,
              n.execucaoEnviadaEm, n.provaJson, n.confirmadoEm, n.pagoEm, n.ajustesJson,
              n.estrelas, n.dataCombinada,
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

  const pedidos = await Promise.all(
    linhas.map(async (r): Promise<PedidoNaLista> => {
      const trabalhoClyon = Number(r.trabalhoClyon) === 1 || r.trabalhoClyon === true;
      const cruas = porPedido.get(Number(r.id)) ?? [];
      const porCarga = lerBase(r.baseDoPreco) === "carga";
      const visiveis = negociacoesParaOCliente(cruas, trabalhoClyon).map((n) =>
        negociacaoParaAVista(n as LinhaCrua & { estado: string; id: number }, { porCarga, agora }),
      );
      const cancelado = eCancelado(r.status, r.canceladoPeloCliente);
      const acordada = visiveis.find((n) => n.estado === "acordada") ?? null;
      const novidade =
        cancelado || trabalhoClyon
          ? null
          : novidadeDoPedido({
              ajustePorResponder: Boolean(acordada?.ajuste?.pendente),
              porConfirmar: acordada?.fase === "a_confirmar",
              porPagar: acordada ? await temReferenciaPorPagar(acordada) : false,
              propostasPorResponder: visiveis.filter((n) => esperaPeloCliente(n, agora)).length,
            });
      return {
        id: Number(r.id),
        servico: nomeDoServico(r.serviceType as string | null),
        cidade: (r.city as string | null) ?? null,
        criadoEm: isoOuNulo(r.createdAt as Date | string | null),
        criadoEmTexto: diaCurtoEmLisboa(r.createdAt as Date | string | null),
        estadoTexto: estadoDoPedidoParaOCliente({
          status: r.status as string | null,
          canceladoPeloCliente: r.canceladoPeloCliente,
          trabalhoClyon,
          contratado: contratadoDe(trabalhoClyon, cruas, visiveis),
          comPropostas: visiveis.filter((n) => n.estado === "aberta" || n.estado === "aguarda_contratacao").length,
          enviado: cruas.length > 0,
        }),
        novidade,
        trabalhoClyon,
      };
    }),
  );

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

export async function pedidoDoClienteParaAApp(pedidoId: number, email: string, agora: Date = new Date()) {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return null;
  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido || !doEmail(pedido, email)) return null;

  const o = pedido as typeof pedido & {
    taxaClyon?: string | number | null;
    precoClienteClyon?: string | number | null;
    canceladoPeloCliente?: unknown;
    propostaEnviadaEm?: Date | string | null;
    precoAceiteEm?: Date | string | null;
  };
  const trabalhoClyon = pedido.valorFixoClyon != null;
  const base = lerBase(pedido.baseDoPreco);
  const [cruas, negociacoes] = await Promise.all([
    negociacoesDoPedido(pedido.id) as Promise<LinhaCrua[]>,
    negociacoesDaVistaDoCliente(pedido, agora),
  ]);

  const contratado = contratadoDe(trabalhoClyon, cruas, negociacoes);
  const cancelado = eCancelado(pedido.status, o.canceladoPeloCliente);

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
      pagamento: await pagamentoParaAApp(pedido.id, n, email).catch((err) => {
        console.error("[pedidos-do-cliente] pagamento:", err instanceof Error ? err.message : err);
        return null;
      }),
    })),
  );

  const status = String(pedido.status ?? "");
  const fechado = contratado && (contratado.fase === "confirmado" || contratado.fase === "pago");

  return {
    pedido: {
      id: pedido.id,
      servico: nomeDoServico(pedido.serviceType),
      estadoTexto: estadoDoPedidoParaOCliente({
        status: pedido.status,
        canceladoPeloCliente: o.canceladoPeloCliente,
        trabalhoClyon,
        contratado,
        comPropostas: negociacoes.filter((n) => n.estado === "aberta" || n.estado === "aguarda_contratacao").length,
        enviado: cruas.length > 0,
      }),
      // A morada é dele: foi ele que a escreveu.
      morada: pedido.address ?? null,
      cidade: pedido.city ?? null,
      quando: pedido.urgency ? (QUANDO_EM_PALAVRAS[pedido.urgency] ?? null) : null,
      descricao: pedido.description ?? null,
      fotos: fotosDoPedido(pedido.filesJson),
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
    textos: { sobreAsPropostas: ORCAMENTOS_A_DISTANCIA, sobreOValorCombinado: ORCAMENTO_A_DISTANCIA },
  };
}

export type PedidoNaApp = NonNullable<Awaited<ReturnType<typeof pedidoDoClienteParaAApp>>>;
