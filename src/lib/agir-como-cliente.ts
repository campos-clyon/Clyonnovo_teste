import { after } from "next/server";
import { avisarProfissionalTrabalhoConfirmado } from "@/lib/avisar-confirmacao";
import { responderAoAjuste, respostaDoCorpo, type RespostaDaRota } from "@/lib/responder-ajuste";
import {
  negociacoesDoPedido,
  gravarNegociacao,
  encerrarOutrasNegociacoes,
  appendOrderHistory,
  confirmarExecucao,
  avaliarProfissional,
  getSimulatorOrderById,
  perfilDoProfissional,
  cancelarPedido,
  registarSemFalhar,
  aceitarPrecoClyon,
} from "@/lib/db";
import { precoDaPropostaClyon } from "@/lib/proposta-clyon-ao-cliente";
import { textosDaConta, isoOuNulo } from "@/lib/pedido-para-a-app";
import { notaDoPrecoParaOCliente } from "@/lib/itens-a-mais";
import { lerBase } from "@/lib/base-do-preco";
import { oQueSeDesfaz, resumoDoCancelamento } from "@/lib/cancelamento";
import { propor, aceitar, desistir, contratar, type Negociacao, type Proposta } from "@/lib/negociacao";
import { avisarQueFoiContratado, avisarQueOClienteRecusou } from "@/lib/email-trabalho";
import { avisarDaProposta } from "@/lib/avisar-da-proposta";
import { avisarProfissionalContratadoPorPush } from "@/lib/avisar-por-push";
import { avisarQuemFicouSemOTrabalho, quemFicaSemOTrabalho } from "@/lib/avisar-quem-perdeu";
import { avisarDoCancelamento } from "@/lib/avisar-cancelamento";
import { tService } from "@/lib/translations";
import { validarAvaliacao } from "@/lib/avaliacao-profissional";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { valorDaPropostaDoCliente } from "@/lib/preco-do-cliente";
import { modeloDaNegociacao } from "@/lib/iva-incluido";
import { dividaDoProfissional, temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { modoDaOferta } from "@/lib/oferta-clyon";

/**
 * O CLIENTE AGE NUM PEDIDO — uma função só, para as três portas (d8, R8,
 * 28-10-2026).
 *
 * Havia duas rotas a fazer o mesmo, cada uma à sua maneira: o link do email
 * (`/api/negociacao/[token]`, lado do cliente) e a conta
 * (`/api/users/me/negociacao`, que a app de cliente também usa, com o Bearer).
 * E não faziam o mesmo:
 *
 *   · CANCELAR O PEDIDO FALHAVA NAS DUAS. O ecrã manda `cancelar_pedido` sem
 *     `negociacaoId` — é o pedido que se cancela, não uma proposta. O link
 *     procurava a negociação antes de chegar ao cancelar e respondia 404; a
 *     conta pedia o id (400) e nem conhecia a acção.
 *   · CONTRATAR PELA CONTA NÃO AVISAVA O PROFISSIONAL. O link mandava o email
 *     com a morada e o aviso no telemóvel; a conta fechava o negócio calada.
 *   · A NOTA DE QUEM RECUSA O AJUSTE só passava pelo link.
 *
 * Agora as portas só provam de quem é o pedido — o token do link, ou o email
 * da sessão (cookie do site ou Bearer da app) — e tudo o resto passa por aqui.
 * Uma acção nova do cliente entra aqui, e chega às três ao mesmo tempo.
 *
 * Quem chama já confirmou que o pedido é do cliente. Esta função não lê
 * sessão nenhuma.
 */

/** As acções que só o cliente faz. O link do profissional recusa-as (403). */
export const ACCOES_SO_DO_CLIENTE = [
  "cancelar_pedido",
  "confirmar",
  "avaliar",
  "contratar",
  "aprovar_ajuste",
  "recusar_ajuste",
] as const;

export function eAccaoSoDoCliente(accao: unknown): boolean {
  return typeof accao === "string" && (ACCOES_SO_DO_CLIENTE as readonly string[]).includes(accao);
}

/** Por onde o cliente chegou — só para o histórico do pedido. */
export type PortaDoCliente = "link" | "conta" | "app";

const NO_HISTORICO: Record<PortaDoCliente, string> = {
  link: "contratado pelo cliente",
  conta: "contratado pelo cliente, na conta",
  app: "contratado pelo cliente, na app",
};

export type CorpoDoCliente = {
  accao?: unknown;
  /** O valor do profissional — só um ecrã de antes de 29-09-2026 o manda. */
  valor?: unknown;
  /** O que o cliente escreveu: o que ele paga — ver `valorDaPropostaDoCliente`. */
  preco?: unknown;
  negociacaoId?: unknown;
  /** O motivo de cancelar, ou a nota de quem recusa um ajuste. */
  motivo?: unknown;
  nota?: unknown;
  estrelas?: unknown;
  comentario?: unknown;
  /** A versão do preço da CLYON que ele viu (`valorClyon.versao`) — S7. */
  versao?: unknown;
};

const TRATADO_PELA_CLYON = "Este trabalho é tratado directamente pela CLYON.";

function falha(status: number, error: string, mais: Record<string, unknown> = {}): RespostaDaRota {
  return { status, corpo: { ok: false, error, ...mais } };
}

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

function textoCurto(v: unknown, maximo: number): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, maximo) : null;
}

export async function agirComoCliente(a: {
  /** O pedido, já provado como dele por quem chama. */
  pedido: { id: number; valorFixoClyon?: unknown };
  corpo: CorpoDoCliente;
  /** O nome de quem está a agir, quando se sabe (a sessão do site). */
  autorNome: string | null;
  porta: PortaDoCliente;
  /** O endereço dos links dos emails — `urlDeAccaoDoPedido(req.headers)`. */
  baseUrl: string;
  agora?: Date;
}): Promise<RespostaDaRota> {
  const pedidoId = Number(a.pedido.id);
  const corpo = a.corpo ?? {};
  const accao = corpo.accao;

  /*
   * «ACEITO ESTE PREÇO» — 28-10-2026 (S7; P2 do dono). A única acção que um
   * Trabalho CLYON aceita, e por agora só pela app (o site continua sem
   * mostrar o preço: P8 por responder).
   */
  if (accao === "aceitar_preco_clyon") {
    // Desde 29-10-2026 (S20, P8 (a)) também pelo link do pedido e pela conta do site.
    if (a.pedido.valorFixoClyon == null) return falha(403, TRATADO_PELA_CLYON);
    return aceitarOPrecoDaClyon(pedidoId, corpo.versao);
  }

  /*
   * UM TRABALHO CLYON NÃO SE TRATA PELO LADO DO CLIENTE — 02-10-2026. O
   * cliente combinou o preço com a CLYON e é com ela que fala; as negociações
   * do pedido são o que a CLYON paga ao profissional, e o cliente nem as vê
   * (`negociacoesParaOCliente`). Nenhuma acção passa — cancelar incluído.
   */
  if (a.pedido.valorFixoClyon != null) return falha(403, TRATADO_PELA_CLYON);

  try {
    /*
     * ── Cancelar o pedido inteiro ──────────────────────────────────────────
     *
     * "Essa opção deve ser absoluta: tanto a CLYON quanto o Valter devem ter
     * esse direito." Não precisa de negociação nenhuma: é o pedido que se
     * cancela. Passa sempre, mesmo com trabalho contratado ou já feito — aí o
     * motivo deixa de ser opcional, porque o profissional que perde o
     * trabalho tem direito a saber porquê.
     */
    if (accao === "cancelar_pedido") {
      const motivo = textoCurto(corpo.motivo, 300);
      const existentes = await negociacoesDoPedido(pedidoId);
      const desfaz = oQueSeDesfaz(existentes);

      if (desfaz.motivoObrigatorio && !motivo) {
        return falha(
          422,
          `Este pedido está ${desfaz.ponto} com ${desfaz.profissional}. ` +
            `Para cancelar diga porquê — o profissional tem direito a saber.`,
          { precisaDeMotivo: true, aviso: desfaz },
        );
      }

      const r = await cancelarPedido(pedidoId);
      if (!r) return falha(404, "Pedido não encontrado.");
      // Os profissionais com proposta ou contratados ficam a saber, com o motivo (S19, BO24).
      await avisarDoCancelamento({ pedidoId, negociacoes: existentes, motivo, porQuem: "cliente" });

      const frase = resumoDoCancelamento(desfaz, "o cliente", motivo);
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message: `${frase} ${r.encerradas} ${
          r.encerradas === 1 ? "negociação encerrada" : "negociações encerradas"
        }.`,
      });
      await registarSemFalhar({
        acontecimento: "pedido_cancelado",
        pedidoId,
        autorTipo: "cliente",
        autorNome: a.autorNome,
        valor: desfaz.valor,
        resumo: frase,
      });
      return { status: 200, corpo: { ok: true, cancelado: true, encerradas: r.encerradas } };
    }

    // ── O resto é sobre UMA negociação do pedido ─────────────────────────
    const negociacaoId = Number(corpo.negociacaoId);
    if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
      return falha(400, "Pedido ou negociação em falta.");
    }
    // Procura-se dentro das negociações DESTE pedido: um id de outra pessoa
    // não passa, porque o pedido já é dele.
    const todas = await negociacoesDoPedido(pedidoId);
    const linha = todas.find((n) => n.id === negociacaoId);
    if (!linha) return falha(404, "Negociação não encontrada.");
    if (modoDaOferta(linha.ofertaClyon)) return falha(403, TRATADO_PELA_CLYON);

    // ── O ajuste no local (18-10-2026), com a nota de quem recusa ────────
    const respostaAoAjuste = respostaDoCorpo(accao);
    if (respostaAoAjuste) {
      const r = await responderAoAjuste({
        negociacaoId,
        resposta: respostaAoAjuste,
        porQuem: "cliente",
        autorNome: a.autorNome,
        nota: textoCurto(corpo.motivo, 500) ?? textoCurto(corpo.nota, 500),
      });
      // O valor acordado novo é o do profissional (d10): ao cliente, só que respondeu.
      if (r.status !== 200) return r;
      return { status: 200, corpo: { ok: true, ajusteRespondido: true, estadoDoAjuste: r.corpo.estadoDoAjuste } };
    }

    // ── Confirmar que o trabalho está feito ──────────────────────────────
    // Não passa pelo motor das propostas: a regra desta fase está em trabalho.ts.
    if (accao === "confirmar") {
      const gravou = await confirmarExecucao(negociacaoId, pedidoId, undefined, "cliente");
      if (!gravou) return falha(409, "Este trabalho não está à espera de confirmação.");
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message: `Cliente confirmou o trabalho da negociação #${negociacaoId}. Valor libertado.`,
      });
      after(() => avisarProfissionalTrabalhoConfirmado({ pedidoId, negociacaoId }));
      return { status: 200, corpo: { ok: true, confirmado: true } };
    }

    // ── Avaliar o profissional ───────────────────────────────────────────
    // Só depois de confirmar, e uma vez: é a avaliação que conta no perfil.
    if (accao === "avaliar") {
      const validacao = validarAvaliacao(corpo);
      if (!validacao.ok) return falha(400, validacao.erros[0].mensagem);
      const gravou = await avaliarProfissional(
        negociacaoId,
        pedidoId,
        validacao.dados.estrelas,
        validacao.dados.comentario,
      );
      if (!gravou) return falha(409, "Só pode avaliar depois de confirmar o trabalho, e uma vez.");
      return { status: 200, corpo: { ok: true, avaliado: true } };
    }

    // ── O motor das propostas ────────────────────────────────────────────
    const agora = a.agora ?? new Date();
    const estadoActual: Negociacao = {
      estado: linha.estado as Negociacao["estado"],
      valorAcordado: linha.valorAcordado != null ? Number(linha.valorAcordado) : null,
      propostas: propostasDe(linha.propostasJson),
    };

    let resultado;
    switch (accao) {
      case "propor": {
        // O que ele escreveu é o que paga — vira aqui o valor do profissional,
        // com as taxas e no modelo DAQUELA negociação.
        const valor = valorDaPropostaDoCliente(
          corpo,
          taxasDaNegociacao(linha),
          modeloDaNegociacao(linha.createdAt),
        );
        resultado = propor(estadoActual, "cliente", valor, agora);
        break;
      }
      case "aceitar":
        resultado = aceitar(estadoActual, "cliente", agora);
        break;
      case "contratar":
        resultado = contratar(estadoActual, agora);
        break;
      case "desistir":
        resultado = desistir(estadoActual, "cliente", agora);
        break;
      default:
        return falha(400, "Acção desconhecida.");
    }

    if (!resultado.ok) return falha(409, resultado.erro);

    const nova = resultado.negociacao;
    await gravarNegociacao(negociacaoId, {
      estado: nova.estado,
      valorAcordado: nova.valorAcordado ?? null,
      propostasJson: JSON.stringify(nova.propostas),
    });

    /*
     * FECHAR UMA FECHA AS OUTRAS, e o profissional fica a saber — pelas três
     * portas. Sem o aviso, quem contratava pela conta deixava o profissional à
     * espera de abrir o site para descobrir que tinha trabalho.
     */
    if (nova.estado === "acordada") {
      // Quem fica sem o trabalho — lido antes de encerrar, avisado depois (28-10-2026, d5).
      const perdem = quemFicaSemOTrabalho(todas, negociacaoId);
      const encerradas = await encerrarOutrasNegociacoes(pedidoId, negociacaoId);
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message:
          `Negociação #${negociacaoId} fechada em ${nova.valorAcordado} € (${NO_HISTORICO[a.porta]}).` +
          (encerradas > 0 ? ` ${encerradas} outra(s) negociação(ões) encerrada(s).` : ""),
      });
      await avisarQueFoiContratadoSemFalhar({
        pedidoId,
        negociacaoId,
        providerId: Number(linha.providerId),
        linha,
        valorAcordado: nova.valorAcordado ?? null,
        baseUrl: a.baseUrl,
      });
      if (encerradas > 0) await avisarQuemFicouSemOTrabalho({ pedidoId, quem: perdem, porque: "outro" });
    }

    // O cliente não seguiu com a proposta dele: o profissional fica a saber (28-10-2026, d5).
    if (accao === "desistir" && nova.estado === "desistida") {
      await avisarQuemFicouSemOTrabalho({
        pedidoId,
        quem: [{ negociacaoId, providerId: Number(linha.providerId) }],
        porque: "desistiu",
      });
      // E por email, com o mesmo texto (S8): o link, a conta e a app.
      try {
        const alvo = await perfilDoProfissional(Number(linha.providerId));
        if (alvo?.email) {
          await avisarQueOClienteRecusou({
            paraEmail: String(alvo.email),
            paraNome: (alvo.name as string | null) ?? null,
            pedidoId,
            baseUrl: a.baseUrl,
          });
        }
      } catch (err) {
        console.error("[agir-como-cliente] email da recusa não saiu:", err);
      }
    }

    // Avisar o outro lado de uma proposta nova. Nunca lança: já está gravada.
    if (accao === "propor" && nova.valorAcordado == null) {
      const ultima = nova.propostas[nova.propostas.length - 1];
      if (ultima) {
        await avisarDaProposta({
          pedidoId,
          negociacaoId,
          quemPropos: "cliente",
          valor: ultima.valor,
          baseUrl: a.baseUrl,
        });
      }
    }

    /*
     * NENHUMA PORTA RECEBE OS VALORES DO MOTOR — a app desde f7910713, o site
     * desde 28-10-2026 (d10). `valorAcordado` e as `propostas` são valores do
     * profissional, sem taxa nem IVA. Quem mostra volta a ler o pedido (a app
     * pela R5; a página do link e a conta pelo servidor), que os dá já no
     * preço do cliente.
     */
    return { status: 200, corpo: { ok: true, estado: nova.estado } };
  } catch (err) {
    console.error("[agir-como-cliente]", err);
    return falha(500, "Não foi possível guardar. Tente novamente.");
  }
}

export const PRECO_MUDOU = "O preço mudou entretanto. Veja o novo valor.";
export const PRECO_JA_NAO_ESPERA = "Este preço já não está à espera de resposta.";

/**
 * O CLIENTE ACEITA O PREÇO DA CLYON (S7). Só o preço que ele viu (a versão) e
 * só enquanto espera resposta: sem preço enviado, já aceite, já com
 * profissional ou cancelado → 409. Avisa a equipa: o cartão e o selo dos
 * Trabalhos CLYON (pela data) e o histórico interno do pedido.
 */
async function aceitarOPrecoDaClyon(pedidoId: number, versao: unknown): Promise<RespostaDaRota> {
  try {
    const pedido = (await getSimulatorOrderById(pedidoId)) as
      | (Record<string, unknown> & { id: number; status?: string | null })
      | undefined;
    if (!pedido || pedido.valorFixoClyon == null) return falha(403, TRATADO_PELA_CLYON);
    const enviadoEm = pedido.propostaEnviadaEm as Date | string | null | undefined;
    const cancelado =
      ["cancelado", "rejeitado", "arquivado"].includes(String(pedido.status ?? "")) ||
      Number(pedido.canceladoPeloCliente) === 1;
    const comProfissional = (await negociacoesDoPedido(pedidoId)).some((n) => n.estado === "acordada");
    if (!enviadoEm || pedido.precoAceiteEm || comProfissional || cancelado) return falha(409, PRECO_JA_NAO_ESPERA);
    if (typeof versao !== "string" || versao !== isoOuNulo(enviadoEm)) return falha(409, PRECO_MUDOU);
    const momento = enviadoEm instanceof Date ? enviadoEm : new Date(enviadoEm);
    if (!(await aceitarPrecoClyon(pedidoId, momento))) return falha(409, PRECO_MUDOU);

    const preco = precoDaPropostaClyon({
      valorFixo: Number(pedido.valorFixoClyon),
      taxa: pedido.taxaClyon == null ? null : Number(pedido.taxaClyon),
      precoAoCliente: pedido.precoClienteClyon == null ? null : Number(pedido.precoClienteClyon),
    });
    const texto = preco
      ? textosDaConta(preco, notaDoPrecoParaOCliente(lerBase(pedido.baseDoPreco), "clyon")).principal
      : null;
    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message: texto ? `O cliente aceitou o preço de ${texto} na app.` : "O cliente aceitou o preço na app.",
    });
    return { status: 200, corpo: { ok: true, aceite: true } };
  } catch (err) {
    console.error("[agir-como-cliente] aceitar o preço:", err);
    return falha(500, "Não foi possível guardar. Tente novamente.");
  }
}

/**
 * O PROFISSIONAL FOI CONTRATADO: email (com a morada, que só agora lhe pode
 * ser dada) e aviso no telemóvel. Um aviso que falhe não desfaz o negócio:
 * fica no registo de erros e o trabalho continua na conta dele.
 */
export async function avisarQueFoiContratadoSemFalhar(c: {
  pedidoId: number;
  negociacaoId: number;
  providerId: number;
  linha: {
    taxaCliente?: string | number | null;
    taxaProfissional?: string | number | null;
    formaDePagamento?: string | null;
    createdAt?: Date | string | null;
  };
  valorAcordado: number | null;
  baseUrl: string;
}): Promise<void> {
  const { pedidoId, negociacaoId, providerId, linha } = c;
  try {
    const [alvo, doPedido] = await Promise.all([
      perfilDoProfissional(providerId),
      getSimulatorOrderById(pedidoId),
    ]);
    if (!alvo?.email) return;
    /*
     * As taxas e a forma DA LINHA — 29-09-2026. São elas que dizem quanto ele
     * recebe e se recebe da CLYON depois da confirmação ou do cliente, em mão.
     */
    await avisarQueFoiContratado({
      paraEmail: String(alvo.email),
      paraNome: String(alvo.name ?? ""),
      pedidoId,
      serviceType: doPedido?.serviceType ?? null,
      morada: doPedido?.address ?? null,
      contactoNome: doPedido?.contactName ?? null,
      contactoTelefone: doPedido?.contactPhone ?? null,
      recebeLiquido:
        c.valorAcordado != null
          ? quantoOProfissionalRecebe(c.valorAcordado, taxasDaNegociacao(linha))
          : null,
      formaDePagamento: linha.formaDePagamento ?? null,
      criadaEm: linha.createdAt ?? null,
      dividaEmDinheiro:
        c.valorAcordado != null &&
        temDividaDoProfissional(linha.formaDePagamento, modeloDaNegociacao(linha.createdAt))
          ? dividaDoProfissional(c.valorAcordado, taxasDaNegociacao(linha))
          : null,
      baseUrl: c.baseUrl,
    });

    // E no telemóvel: ele tem de combinar o dia com o cliente, e cada hora
    // que passa sem saber é uma hora a menos para o fazer.
    await avisarProfissionalContratadoPorPush({
      email: String(alvo.email),
      servico: tService(doPedido?.serviceType) || "Trabalho",
      valorQueRecebe:
        c.valorAcordado != null
          ? quantoOProfissionalRecebe(c.valorAcordado, taxasDaNegociacao(linha))
          : 0,
      pedidoId,
      negociacaoId,
    });
  } catch (err) {
    console.error("[agir-como-cliente] aviso de contratação não saiu:", err);
  }
}
