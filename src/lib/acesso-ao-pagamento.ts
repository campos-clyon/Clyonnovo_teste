import {
  getPool,
  getSimulatorOrderById,
  negociacoesDoPedido,
} from "./db";
import { hashDeToken, verificarTokenDeAcesso } from "./pedido-acesso";
import { regimeDeIva, taxasDaNegociacao, type RegimeIva, type Taxas } from "./taxas-plataforma";

/**
 * QUEM É QUE PODE PAGAR ESTE TRABALHO.
 *
 * Existe à parte das rotas porque a regra é UMA e as portas são DUAS: o link
 * do email (quem não tem conta) e a sessão (quem tem). Escrita duas vezes,
 * acabava com dois comportamentos — e o que se está a proteger aqui é o botão
 * que tira dinheiro da conta de alguém.
 *
 * O `pedidoId` do corpo NUNCA é a autorização. É sempre a credencial — o token
 * do pedido ou o email da sessão — que decide, e o pedido tem de bater certo
 * com ela. Sem isso, trocar um número no corpo do pedido gerava referências de
 * pagamento em nome de estranhos.
 */

export type TrabalhoAPagar = {
  pedidoId: number;
  negociacaoId: number;
  providerId: number;
  profissionalNome: string;
  /** O valor acordado entre os dois, sem taxa e sem imposto. */
  acordado: number;
  /** O regime de IVA de quem presta o serviço. */
  regime: RegimeIva;
  /** As taxas que ESTA negociação guardou — nunca as de hoje. */
  taxas: Taxas;
  /** O telemóvel que o cliente deixou no pedido, para sugerir no MB WAY. */
  telefoneDoCliente: string | null;
  /** O nome de quem pediu — a mensagem da referência trata-o por ele. */
  nomeDoCliente: string | null;
  /**
   * O email de quem pediu. Decide o portão de testador — ver `podeCobrar`.
   *
   * NÃO sai desta função para ecrã nenhum: é o pedido do cliente, e quem o vê
   * já o conhece. Serve só para a decisão do lado do servidor.
   */
  emailDoCliente: string | null;
};

export type Acesso =
  | { ok: true; trabalho: TrabalhoAPagar }
  | { ok: false; estado: number; erro: string };

/**
 * A MESMA RESPOSTA PARA «NÃO EXISTE» E PARA «NÃO É SEU».
 *
 * Distinguir as duas diz a quem anda a tentar que aquele número de pedido
 * existe — e é meio caminho andado para descobrir o resto por tentativa.
 */
const NAO_ENCONTRADO: Acesso = {
  ok: false,
  estado: 404,
  erro: "Trabalho não encontrado.",
};

/**
 * QUEM PERGUNTA, E COM QUE DIREITO.
 *
 * As duas primeiras são credenciais do CLIENTE: o token que lhe foi ao email,
 * ou a sessão em que ele entrou. A terceira não é uma credencial — é a marca
 * de que a porta já foi guardada por outra pessoa.
 *
 * ⚠️ `backoffice` NUNCA PODE VIR DE UM CORPO DE PEDIDO. Só o constrói
 * `trabalhoVistoPeloBackoffice`, e essa só é chamada por rotas que já correram
 * `requireAdmin`. Os dois caminhos públicos montam esta credencial campo a
 * campo — `{ token, email }` — e nunca por espalhamento do corpo, que é o que
 * impede um `"backoffice": true` de entrar por aí.
 */
export type CredencialDePagamento = {
  token?: unknown;
  email?: string | null;
  /** O administrador já foi autenticado à porta da rota. Ver o aviso acima. */
  backoffice?: boolean;
};

export async function trabalhoQueSePodePagar(
  pedidoId: number,
  negociacaoId: number,
  credencial: CredencialDePagamento,
  agora: Date = new Date(),
): Promise<Acesso> {
  if (!Number.isInteger(pedidoId) || !Number.isInteger(negociacaoId)) {
    return { ok: false, estado: 400, erro: "Pedido ou negociação em falta." };
  }

  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NAO_ENCONTRADO;

  const email = credencial.email?.trim().toLowerCase() || null;
  const porSessao = email != null && (pedido.contactEmail ?? "").trim().toLowerCase() === email;
  const porToken =
    credencial.token != null &&
    verificarTokenDeAcesso(
      credencial.token,
      (pedido as { acessoTokenHash?: string | null }).acessoTokenHash,
      (pedido as { acessoTokenExpiraEm?: Date | null }).acessoTokenExpiraEm,
      agora,
    ).valido;

  /*
   * ── O CLIENTE SEM EMAIL — corrigido a 21-09-2026 ────────────────────────
   *
   * "deu erro ao tentar gerar a entidade referencia"
   *
   * O #308 é do Manuel Pita, entrou pelo telefone, e no ecrã tem escrito «sem
   * email». Carregar em «Referência Multibanco» dava:
   *
   *   GET /api/admin/pagamentos/criar?negociacaoId=280 → 404
   *   "Trabalho não encontrado."
   *
   * E dava-o outra vez a cada pulso do painel, aos vinte segundos, para
   * sempre.
   *
   * A CAUSA ERA UMA ESPERTEZA MINHA. `trabalhoVistoPeloBackoffice` reutilizava
   * este caminho «com a credencial já dada por boa» — mas o que fazia era ir
   * buscar o email do cliente e passá-lo como se fosse o de quem perguntava.
   * Num pedido sem email, esse email é nulo: `porSessao` dava falso, `porToken`
   * dava falso, e a verificação que era suposto estar a ser dispensada
   * rejeitava o administrador.
   *
   * Ou seja: o backoffice não conseguia cobrar exactamente os clientes para
   * quem o backoffice existe — os do telefone e do WhatsApp, que nunca deram
   * email nenhum.
   *
   * Agora a autorização do backoffice DIZ O QUE É em vez de se disfarçar de
   * cliente. Forjar uma credencial para passar na própria porta é sempre isto:
   * funciona até ao dia em que o material com que se forja não existe.
   */
  if (credencial.backoffice !== true && !porSessao && !porToken) return NAO_ENCONTRADO;

  const linha = (await negociacoesDoPedido(pedidoId)).find((n) => n.id === negociacaoId);
  if (!linha) return NAO_ENCONTRADO;

  /*
   * SÓ SE PAGA UM TRABALHO FECHADO.
   *
   * Uma negociação a decorrer não tem valor nenhum a pagar — tem propostas. E
   * uma que o cliente ainda não contratou pode vir a ser de outro
   * profissional: cobrar antes disso era cobrar por um serviço que ninguém se
   * comprometeu a prestar.
   */
  if (linha.estado !== "acordada") {
    return { ok: false, estado: 409, erro: "Este trabalho ainda não está fechado." };
  }

  const acordado = linha.valorAcordado == null ? null : Number(linha.valorAcordado);
  if (acordado == null || !Number.isFinite(acordado) || acordado <= 0) {
    return { ok: false, estado: 409, erro: "Este trabalho não tem valor acordado." };
  }

  return {
    ok: true,
    trabalho: {
      pedidoId,
      negociacaoId,
      providerId: Number(linha.providerId),
      profissionalNome: linha.profissionalNome,
      acordado,
      regime: regimeDeIva(linha.regimeIva),
      taxas: taxasDaNegociacao(linha),
      telefoneDoCliente:
        ((pedido as { contactPhone?: string | null }).contactPhone ?? "").trim() || null,
      nomeDoCliente: ((pedido as { contactName?: string | null }).contactName ?? "").trim() || null,
      emailDoCliente: (pedido.contactEmail ?? "").trim().toLowerCase() || null,
    },
  };
}

/**
 * O MESMO TRABALHO, VISTO DO BACKOFFICE — sem credencial do cliente.
 *
 * *«Vamos colocar apenas para o admin gerar as referências.»* — 18-09-2026.
 *
 * Aqui não há token nem sessão de cliente: quem pergunta é um administrador
 * autenticado, e a prova disso fica à porta da rota. O que continua igual são
 * as regras do TRABALHO — tem de estar fechado e ter valor —, porque essas não
 * são sobre quem pergunta: são sobre o que se pode cobrar.
 *
 * Partilha a mesma forma de saída que o caminho do cliente. Duas formas do
 * mesmo trabalho acabavam com duas contas do mesmo dinheiro.
 *
 * ⚠️ E PASSA `backoffice: true`, em vez de ir buscar o email do cliente e o
 * fazer passar por credencial. Fazia isso até 21-09-2026, e partia em todos os
 * pedidos «sem email» — que são os do telefone, ou seja, a razão de ser deste
 * caminho. Ver a nota em `trabalhoQueSePodePagar`.
 */
export async function trabalhoVistoPeloBackoffice(negociacaoId: number): Promise<Acesso> {
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return { ok: false, estado: 400, erro: "Negociação não indicada." };
  }

  const pool = await getPool();
  if (!pool) return { ok: false, estado: 503, erro: "Base indisponível." };

  const [linhas] = (await pool.execute(
    "SELECT pedidoId FROM negociacoes WHERE id = ? LIMIT 1",
    [negociacaoId],
  )) as [Array<{ pedidoId: number }>, unknown];
  const pedidoId = linhas[0]?.pedidoId;
  if (pedidoId == null) {
    return { ok: false, estado: 404, erro: "Negociação não encontrada." };
  }

  /*
   * Reaproveita o caminho do cliente, dispensando SÓ a pergunta «é seu?» — que
   * é a única que não faz sentido aqui. As regras do trabalho continuam a ser
   * as mesmas, e é isso que garante que as duas portas concordam sobre o que é
   * um trabalho cobrável.
   */
  return trabalhoQueSePodePagar(Number(pedidoId), negociacaoId, { backoffice: true });
}

/** O hash do token, para quem precise dele sem repetir o import. */
export { hashDeToken };
