import { sendPushToUser } from "./webpush";
import { urlDeAccao } from "./url-do-site";

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
 * QUATRO MOMENTOS, e cada um responde à mesma pergunta: se esta pessoa
 * estivesse a fazer outra coisa, valia a pena interrompê-la?
 *
 *   Ao cliente   · chegou uma proposta          — está à espera dela
 *   Ao cliente   · o trabalho foi dado por feito — tem de ver e confirmar
 *   Ao profissional · há um pedido novo na zona  — quem responde primeiro ganha
 *   Ao profissional · foi contratado             — tem de organizar o dia
 *
 * Não entram aqui: propostas recusadas, mudanças de estado internas, resumos.
 * Isso é email, e o email não acorda ninguém.
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
  pedidoId: number;
  token?: string | null;
}): Promise<void> {
  if (!dados.email) return;
  await sendPushToUser(dados.email, {
    title: `Proposta de ${dados.profissionalNome.split(" ")[0]}`,
    body: `${euros(dados.valor)} para o pedido #${dados.pedidoId}. Toque para ver e responder.`,
    url: ligacao(dados.token ? `/pedido/${dados.token}` : "/conta"),
    /*
     * A ETIQUETA AGRUPA POR PEDIDO, e é de propósito.
     *
     * Cinco profissionais a propor ao mesmo pedido davam cinco notificações
     * empilhadas no telemóvel às sete da manhã. Com a mesma etiqueta, a última
     * substitui a anterior: fica uma, e é a mais recente.
     */
    tag: `proposta-${dados.pedidoId}`,
  });
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
    body: `${dados.profissionalNome.split(" ")[0]} enviou fotografias do pedido #${dados.pedidoId}. Veja e confirme.`,
    url: ligacao(dados.token ? `/pedido/${dados.token}` : "/conta"),
    tag: `feito-${dados.pedidoId}`,
  });
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
 * SEM VALOR NO CORPO. O que o cliente disse que queria pagar é informação da
 * negociação, e mostrá-la no ecrã de bloqueio ancorava a proposta dele antes
 * sequer de abrir o pedido.
 */
export async function avisarProfissionalDePedidoPorPush(dados: {
  email: string | null | undefined;
  servico: string;
  zona: string | null;
  token?: string | null;
}): Promise<void> {
  if (!dados.email) return;
  await sendPushToUser(dados.email, {
    title: "Pedido novo para si",
    body: dados.zona ? `${dados.servico} em ${dados.zona}.` : dados.servico,
    url: ligacao(dados.token ? `/profissionais/pedidos/${dados.token}` : "/profissionais/painel"),
    /*
     * Etiqueta fixa, e não por pedido: se entrarem três pedidos enquanto ele
     * conduz, o que interessa é que abra o painel — não que leia três avisos.
     */
    tag: "pedido-novo",
  });
}

/** AO PROFISSIONAL: o cliente fechou com ele. Agora tem um dia para organizar. */
export async function avisarProfissionalContratadoPorPush(dados: {
  email: string | null | undefined;
  servico: string;
  valorQueRecebe: number;
  pedidoId: number;
  token?: string | null;
}): Promise<void> {
  if (!dados.email) return;
  await sendPushToUser(dados.email, {
    title: "O trabalho é seu",
    body: `${dados.servico} — recebe ${euros(dados.valorQueRecebe)}. Combine o dia com o cliente.`,
    url: ligacao(dados.token ? `/profissionais/pedidos/${dados.token}` : "/profissionais/painel"),
    tag: `contratado-${dados.pedidoId}`,
  });
}
