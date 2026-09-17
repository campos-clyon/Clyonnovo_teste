import {
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

export async function trabalhoQueSePodePagar(
  pedidoId: number,
  negociacaoId: number,
  credencial: { token?: unknown; email?: string | null },
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

  if (!porSessao && !porToken) return NAO_ENCONTRADO;

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
    },
  };
}

/** O hash do token, para quem precise dele sem repetir o import. */
export { hashDeToken };
