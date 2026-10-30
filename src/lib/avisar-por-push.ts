import { sendPushToUser } from "./webpush";
import { precoComBase, type BaseDoPreco } from "./base-do-preco";
import { urlDeAccao } from "./url-do-site";
import { avisoDoConfirmado, type OndeEstaODinheiro } from "./fim-do-trabalho";
import {
  avisoDaContraproposta,
  avisoDePedidoNovo,
  avisoSemOTrabalho,
  type PorqueTerminou,
} from "./textos-dos-avisos-ao-profissional";

/**
 * OS AVISOS QUE APARECEM NO TELEMÓVEL — e os momentos em que valem a pena.
 *
 * A INFRAESTRUTURA JÁ ESTAVA TODA PAGA E NINGUÉM A CHAMAVA.
 *
 * Havia o `sw.js`, o `push-client.ts`, as rotas de subscrever e cancelar, a
 * tabela `pushSubscriptions`, o `webpush.ts` com as chaves VAPID — e zero
 * chamadas a `sendPushToUser` em todo o projeto. Um cliente que activasse os
 * avisos no ecrã das notificações não recebia nunca nenhum. O custo tinha sido
 * pago e o benefício era exactamente nenhum.
 *
 * PORQUE É QUE OS MOMENTOS VIVEM AQUI E NÃO EM CADA ROTA
 *
 * Porque são poucos e têm de continuar poucos. Uma notificação que chega
 * quando não devia é desligada, e quando é desligada leva consigo as que
 * importavam — não há segunda oportunidade de pedir a permissão. Ter os
 * momentos numa lista fechada obriga a passar por aqui para acrescentar mais
 * um, e a olhar para os outros ao fazê-lo.
 *
 * NOVE MOMENTOS (oito funções), e cada um responde à mesma pergunta: se esta pessoa
 * estivesse a fazer outra coisa, valia a pena interrompê-la?
 *
 *   Ao cliente   · chegou uma proposta          — está à espera dela
 *   Ao cliente   · o trabalho foi dado por feito — tem de ver e confirmar
 *   Ao profissional · há um pedido novo na zona  — quem responde primeiro ganha
 *   Ao profissional · o cliente respondeu com outro valor — a negociação está com ele (28-10-2026)
 *   Ao profissional · foi contratado             — tem de organizar o dia
 *   Ao profissional · ficou com outro profissional — para não ficar à espera (28-10-2026)
 *   Ao profissional · o cliente desistiu da proposta dele — idem (28-10-2026)
 *   Ao profissional · o trabalho foi confirmado  — o valor conta na carteira (27-10-2026)
 *   Ao profissional · a CLYON pagou-lhe          — o dinheiro está a caminho (27-10-2026)
 *
 * Os de 28-10-2026 (d5) fecham a negociação no telemóvel: a app promete
 * «Avisamos quando ele responder», e quem perdia não sabia que tinha perdido.
 *
 * Não entram aqui: propostas recusadas, mudanças de estado internas, resumos.
 * Isso é email, e o email não acorda ninguém. As frases vivem em
 * `textos-dos-avisos-ao-profissional.ts`, puras, para a app as poder usar.
 *
 * NUNCA LANÇA. O `sendPushToUser` já engole os erros dele, e estas funções são
 * chamadas depois de a coisa importante estar gravada — uma notificação que
 * falhe não pode transformar-se num erro para quem acabou de propor.
 */

const euros = (v: number) => v.toFixed(2).replace(".", ",") + " €";

/** O link absoluto para onde a notificação leva ao ser tocada. */
function ligacao(caminho: string): string {
  try {
    return new URL(caminho, urlDeAccao()).toString();
  } catch {
    return caminho;
  }
}

/**
 * AO CLIENTE: um profissional propôs.
 *
 * É o aviso mais rentável dos quatro. Uma proposta que fica duas horas por ver
 * é uma proposta que já não é a primeira — e a primeira ganha quase sempre.
 */
export async function avisarClientePorPush(dados: {
  email: string | null | undefined;
  profissionalNome: string;
  valor: number;
  /** Pelo trabalho todo, ou por carga. Por carga, o valor leva a unidade. */
  base?: BaseDoPreco;
  pedidoId: number;
  token?: string | null;
  negociacaoId?: number | null;
}): Promise<void> {
  if (!dados.email) return;
  await sendPushToUser(dados.email, {
    title: `Proposta de ${dados.profissionalNome.split(" ")[0]}`,
    body: `${precoComBase(euros(dados.valor), dados.base ?? "total")} para o pedido #${dados.pedidoId}. Toque para ver e responder.`,
    url: ligacao(dados.token ? `/pedido/${dados.token}` : "/conta"),
    /*
     * A ETIQUETA AGRUPA POR PEDIDO, e é de propósito.
     *
     * Cinco profissionais a propor ao mesmo pedido davam cinco notificações
     * empilhadas no telemóvel às sete da manhã. Com a mesma etiqueta, a última
     * substitui a anterior: fica uma, e é a mais recente.
     */
    tag: `proposta-${dados.pedidoId}`,
    // A app de cliente abre esse pedido (S10).
    pedidoId: dados.pedidoId,
    tipo: "proposta",
    negociacaoId: dados.negociacaoId ?? undefined,
  }, "cliente");
}

/** AO CLIENTE: o profissional diz que acabou, e há fotografias para ver. */
export async function avisarClienteDoTrabalhoFeitoPorPush(dados: {
  email: string | null | undefined;
  profissionalNome: string;
  pedidoId: number;
  token?: string | null;
}): Promise<void> {
  if (!dados.email) return;
  await sendPushToUser(dados.email, {
    title: "O trabalho está feito",
    body: `${dados.profissionalNome.split(" ")[0]} marcou o trabalho do pedido #${dados.pedidoId} como feito. Confirme que ficou feito.`,
    url: ligacao(dados.token ? `/pedido/${dados.token}` : "/conta"),
    tag: `feito-${dados.pedidoId}`,
    pedidoId: dados.pedidoId,
    tipo: "feito",
  }, "cliente");
}

/**
 * AO PROFISSIONAL: entrou um pedido na zona dele.
 *
 * "Ative as notificações para estar a par dos novos pedidos" é um ecrã inteiro
 * da app da Fixando, e não está lá por acaso: numa plataforma onde cinco
 * pessoas respondem ao mesmo pedido, o aviso que chega primeiro decide quem
 * trabalha. Era a maior peça em falta do nosso lado — o profissional só sabia
 * de um pedido novo se abrisse o email ou o painel por iniciativa própria.
 *
 * O QUE DECIDE, NO ECRÃ DE BLOQUEIO — 28-10-2026 (d5). Dizia só «Recolha de
 * móveis em Almada.», sem nenhum dos quatro dados que o fazem decidir. Agora
 * leva o serviço, quando, a que distância, quantas fotografias, e o que ele
 * recebe — o mesmo número do email e do WhatsApp (a sugestão CLYON já com a
 * taxa da plataforma descontada; num Trabalho CLYON, o valor fixo). Nunca o
 * valor bruto do cliente nem o preço de outro profissional.
 */
export async function avisarProfissionalDePedidoPorPush(dados: {
  email: string | null | undefined;
  /** O serviço em palavras («Recolha de móveis»). */
  servico: string;
  zona: string | null;
  token?: string | null;
  /** Para a app abrir este trabalho (18-10-2026). O navegador usa o `url`. */
  negociacaoId?: number | null;
  urgencia?: string | null;
  distanciaKm?: number | null;
  fotografias?: number | null;
  /** O que ele recebe (líquido). Nulo sem valor de partida. */
  recebe?: number | null;
  base?: BaseDoPreco;
  trabalhoClyon?: boolean;
}): Promise<void> {
  if (!dados.email) return;
  const aviso = avisoDePedidoNovo({
    servico: dados.servico,
    cidade: dados.zona,
    urgencia: dados.urgencia ?? null,
    distanciaKm: dados.distanciaKm ?? null,
    fotografias: dados.fotografias ?? null,
    recebe: dados.recebe ?? null,
    base: dados.base,
    trabalhoClyon: dados.trabalhoClyon,
  });
  await sendPushToUser(dados.email, {
    title: aviso.title,
    body: aviso.body,
    url: ligacao(dados.token ? `/profissionais/pedidos/${dados.token}` : "/profissionais/painel"),
    /*
     * Etiqueta fixa, e não por pedido: se entrarem três pedidos enquanto ele
     * conduz, o que interessa é que abra o painel — não que leia três avisos.
     */
    tag: "pedido-novo",
    negociacaoId: dados.negociacaoId ?? undefined,
  }, "pro");
}

/**
 * AO PROFISSIONAL: o trabalho ficou confirmado — 27-10-2026.
 *
 * Seja quem for que confirmou (o cliente, a CLYON ou o prazo), é o momento
 * em que o valor passa a contar na carteira dele.
 *
 * O CORPO DIZ O CASO — 28-10-2026 (d4). Era «Veja os detalhes na sua
 * carteira» para todos; agora diz onde está o dinheiro, com as frases de
 * `avisoDoConfirmado` (fim-do-trabalho.ts): na carteira, por cobrar, em
 * dinheiro, e o que entrega à CLYON. Sem o caso, a frase de antes.
 */
export async function avisarProfissionalConfirmadoPorPush(dados: {
  email: string | null | undefined;
  pedidoId: number;
  negociacaoId?: number | null;
  caso?: OndeEstaODinheiro | null;
  /** O que é dele, já com a taxa da plataforma descontada. */
  liquido?: number | null;
  /** Em dinheiro com IVA incluído: o IVA e a taxa da plataforma que entrega à CLYON. */
  aPagarAClyon?: number | null;
}): Promise<void> {
  if (!dados.email) return;
  try {
    const comCaso =
      dados.caso && dados.liquido != null && Number.isFinite(dados.liquido)
        ? avisoDoConfirmado({
            pedidoId: dados.pedidoId,
            caso: dados.caso,
            liquido: dados.liquido,
            aPagarAClyon: dados.aPagarAClyon ?? null,
          })
        : null;
    await sendPushToUser(dados.email, {
      title: "Trabalho confirmado",
      body: comCaso?.body ?? `O pedido #${dados.pedidoId} ficou confirmado. Veja os detalhes na sua carteira.`,
      url: ligacao("/profissionais/painel"),
      tag: `confirmado-${dados.pedidoId}`,
      negociacaoId: dados.negociacaoId ?? undefined,
    }, "pro");
  } catch (e) {
    console.error("[avisar-por-push] confirmado:", e);
  }
}

/**
 * AO PROFISSIONAL: «Já pagámos» — 27-10-2026.
 *
 * A CLYON transferiu-lhe o que ele recebe por um trabalho (o mesmo número que
 * o painel mostra: `quantoOProfissionalRecebe`), ou um levantamento que ele
 * pediu. Quem espera dinheiro quer sabê-lo sem ter de abrir o painel.
 */
export async function avisarProfissionalPagoPorPush(dados: {
  email: string | null | undefined;
  valor: number;
  /** O pedido do trabalho pago… */
  pedidoId?: number | null;
  /** …ou o levantamento transferido. */
  levantamentoId?: number | null;
  negociacaoId?: number | null;
}): Promise<void> {
  if (!dados.email || !Number.isFinite(dados.valor)) return;
  const pelo = dados.pedidoId
    ? `pelo #${dados.pedidoId}`
    : dados.levantamentoId
      ? `pelo levantamento #${dados.levantamentoId}`
      : "";
  try {
    await sendPushToUser(dados.email, {
      title: "Pagamento feito",
      body: `A CLYON pagou-lhe ${euros(dados.valor)}${pelo ? ` ${pelo}` : ""}.`,
      url: ligacao("/profissionais/painel"),
      tag: dados.pedidoId ? `pago-${dados.pedidoId}` : `levantamento-${dados.levantamentoId ?? ""}`,
      negociacaoId: dados.negociacaoId ?? undefined,
    }, "pro");
  } catch (e) {
    console.error("[avisar-por-push] pago:", e);
  }
}

/**
 * AO PROFISSIONAL: a CLYON marcou ou mudou o dia do trabalho — 29-10-2026
 * (S19, BO31). Descobri-lo ao chegar à porta não serve.
 */
export async function avisarProfissionalDoDiaPorPush(dados: {
  email: string | null | undefined;
  pedidoId: number;
  negociacaoId: number;
  diaTexto: string | null;
}): Promise<void> {
  if (!dados.email) return;
  try {
    await sendPushToUser(dados.email, {
      title: dados.diaTexto ? `Dia do trabalho #${dados.pedidoId}` : `Dia do trabalho #${dados.pedidoId} desmarcado`,
      body: dados.diaTexto
        ? `A CLYON marcou o trabalho do pedido #${dados.pedidoId} para ${dados.diaTexto}.`
        : `A CLYON desmarcou o dia do trabalho do pedido #${dados.pedidoId}. Combine outro com o cliente.`,
      url: ligacao("/profissionais/painel"),
      tag: `dia-${dados.negociacaoId}`,
      negociacaoId: dados.negociacaoId,
    }, "pro");
  } catch (e) {
    console.error("[avisar-por-push] dia:", e);
  }
}

/**
 * AO PROFISSIONAL: o cliente respondeu com outro valor — 28-10-2026 (d5).
 *
 * Só chegava por email, e a app dizia-lhe «Avisamos quando ele responder».
 * As contas são as do email da contraproposta: o valor proposto e o que ele
 * recebe por ele. A etiqueta é da negociação: uma resposta nova substitui a
 * anterior no ecrã de bloqueio.
 */
export async function avisarProfissionalDaContrapropostaPorPush(dados: {
  email: string | null | undefined;
  pedidoId: number;
  negociacaoId: number;
  valor: number;
  recebe: number;
  base?: BaseDoPreco;
  token?: string | null;
}): Promise<void> {
  if (!dados.email || !Number.isFinite(dados.valor) || !Number.isFinite(dados.recebe)) return;
  try {
    const aviso = avisoDaContraproposta({
      pedidoId: dados.pedidoId,
      valor: dados.valor,
      recebe: dados.recebe,
      base: dados.base,
    });
    await sendPushToUser(dados.email, {
      title: aviso.title,
      body: aviso.body,
      url: ligacao(dados.token ? `/profissionais/pedidos/${dados.token}` : "/profissionais/painel"),
      tag: `resposta-${dados.negociacaoId}`,
      negociacaoId: dados.negociacaoId,
    }, "pro");
  } catch (e) {
    console.error("[avisar-por-push] contraproposta:", e);
  }
}

/**
 * AO PROFISSIONAL: ficou sem o trabalho — 28-10-2026 (d5). Outro profissional
 * ficou com ele, ou o cliente não seguiu com a proposta dele. Sem preços dos
 * outros e sem nomes: só o pedido, e onde estão os pedidos novos.
 */
export async function avisarProfissionalSemOTrabalhoPorPush(dados: {
  email: string | null | undefined;
  pedidoId: number;
  negociacaoId: number;
  porque: PorqueTerminou;
  motivo?: string | null;
}): Promise<void> {
  if (!dados.email) return;
  try {
    const aviso = avisoSemOTrabalho({ pedidoId: dados.pedidoId, porque: dados.porque, motivo: dados.motivo });
    await sendPushToUser(dados.email, {
      title: aviso.title,
      body: aviso.body,
      url: ligacao("/profissionais/painel"),
      tag: `terminada-${dados.negociacaoId}`,
      negociacaoId: dados.negociacaoId,
    }, "pro");
  } catch (e) {
    console.error("[avisar-por-push] sem o trabalho:", e);
  }
}

/** AO PROFISSIONAL: o cliente fechou com ele. Agora tem um dia para organizar. */
export async function avisarProfissionalContratadoPorPush(dados: {
  email: string | null | undefined;
  servico: string;
  valorQueRecebe: number;
  pedidoId: number;
  token?: string | null;
  negociacaoId?: number | null;
}): Promise<void> {
  if (!dados.email) return;
  await sendPushToUser(dados.email, {
    title: "O trabalho é seu",
    body: `${dados.servico} — recebe ${euros(dados.valorQueRecebe)}. Combine o dia com o cliente.`,
    url: ligacao(dados.token ? `/profissionais/pedidos/${dados.token}` : "/profissionais/painel"),
    tag: `contratado-${dados.pedidoId}`,
    negociacaoId: dados.negociacaoId ?? undefined,
  }, "pro");
}
