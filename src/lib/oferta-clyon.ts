import {
  aceitar,
  desistir,
  type Negociacao,
  type Proposta,
  type ResultadoDaAccao,
} from "./negociacao";
import type { Taxas } from "./taxas-plataforma";
import { pedidoArrumado } from "./pedido-arrumado";

/**
 * OS TRABALHOS CLYON — valor fixo, aceitar ou recusar.
 *
 * *«Quero criar uma função no site para gerar trabalhos nas contas dos
 * profissionais (…) são trabalhos que nós já negociámos e já temos os valores,
 * só precisamos de alguém para realizar (…) vai como "pedido oferecido pela
 * CLYON, valor fixo"; os pros podem aceitar ou recusar, como se fosse uma
 * venda.»* — 02-10-2026.
 *
 * O dono decidiu, nesse dia, com as hipóteses à frente:
 *   · o valor fixo é O QUE O PROFISSIONAL RECEBE — sem comissão descontada. A
 *     margem da CLYON está no preço que ela combinou com o cliente, por fora;
 *   · distribuído a vários, quem aceita fica numa lista e A CLYON ESCOLHE;
 *     enviado só a um, aceitar fecha (a escolha já foi feita ao enviar);
 *   · o profissional é pago pela CLYON, na carteira, depois de confirmado;
 *   · o cliente não recebe mensagens automáticas destes trabalhos — só o aviso
 *     quando a data muda.
 *
 * NÃO É UM FLUXO NOVO: é uma negociação como as outras, com três diferenças.
 * Nasce com uma proposta da CLYON já em cima da mesa (o valor fixo, do lado do
 * cliente), com as taxas a zero (o que se propõe é o que se recebe), e o
 * profissional não pode contrapropor. A partir daí o motor é o de sempre:
 * aceitar deixa-a «à espera de contratação», contratar fecha-a, e o resto —
 * agenda, execução, confirmação, carteira, levantamento — já sabe o caminho.
 *
 * ESTE FICHEIRO É LEVE DE PROPÓSITO: os ecrãs (o cartão do profissional, a
 * página do backoffice) importam-no. Os textos do WhatsApp, que puxam o
 * assistente, vivem em `aviso-de-oferta-clyon.ts`, do lado do servidor.
 */

/** Como a oferta chegou a este profissional. */
export type ModoDaOferta =
  /** A vários: quem aceita fica numa lista, e a CLYON escolhe. */
  | "distribuida"
  /** Só a ele, escolhido pela CLYON: aceitar fecha. */
  | "directa";

export function modoDaOferta(v: unknown): ModoDaOferta | null {
  return v === "distribuida" || v === "directa" ? v : null;
}

/**
 * As taxas de uma negociação de valor fixo: zero dos dois lados.
 *
 * Do lado do profissional, porque o valor fixo é o que ele recebe. Do lado do
 * cliente, porque o cliente desta negociação é a própria CLYON — o preço que o
 * cliente verdadeiro paga foi combinado por fora, e não passa por esta conta.
 */
export const TAXAS_DA_OFERTA: Taxas = { cliente: 0, profissional: 0 };

export const VALOR_FIXO_MINIMO = 10;
export const VALOR_FIXO_MAXIMO = 20_000;

/** «250», «250,5», «250.50 €» → 250.5. Aos cêntimos. */
export function lerValorFixo(
  v: unknown,
): { ok: true; valor: number } | { ok: false; erro: string } {
  const texto = typeof v === "number" ? String(v) : typeof v === "string" ? v : "";
  const limpo = texto.replace("€", "").replace(/\s/g, "").replace(",", ".");
  const n = Number(limpo);
  if (!limpo || !Number.isFinite(n)) return { ok: false, erro: "Escreva o valor que o profissional recebe." };
  if (n < VALOR_FIXO_MINIMO) return { ok: false, erro: `O valor fixo tem de ser pelo menos ${VALOR_FIXO_MINIMO} €.` };
  if (n > VALOR_FIXO_MAXIMO) return { ok: false, erro: "Esse valor parece demasiado alto. Confirme." };
  return { ok: true, valor: Math.round(n * 100) / 100 };
}

/**
 * O PREÇO AO CLIENTE, sem IVA — 08-10-2026. O que a CLYON combinou com o
 * cliente; a comissão da sócia conta-se sobre ele (11 % deste valor). Os mesmos
 * limites do valor fixo, e o mesmo jeito de escrever: «400», «400,50 €».
 */
export function lerPrecoAoCliente(
  v: unknown,
): { ok: true; valor: number } | { ok: false; erro: string } {
  const lido = lerValorFixo(v);
  if (lido.ok) return lido;
  const texto = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!texto) return { ok: false, erro: "Escreva o preço combinado com o cliente, sem IVA." };
  return {
    ok: false,
    erro: lido.erro.replace("O valor fixo", "O preço ao cliente").replace(
      "Escreva o valor que o profissional recebe.",
      "Escreva o preço combinado com o cliente, sem IVA.",
    ),
  };
}

/**
 * A mesa com que a negociação nasce: a proposta da CLYON, pendente.
 *
 * Do lado do CLIENTE de propósito — é desse lado que está quem paga o trabalho
 * ao profissional. Aceitá-la é o `aceitar` de sempre, e o motor já sabe que
 * isso deixa a negociação «à espera de contratação».
 */
export function propostasDaOferta(valor: number, agora: Date): Proposta[] {
  return [{ por: "cliente", valor, criadaEm: agora, estado: "pendente" }];
}

export const SO_ACEITAR_OU_RECUSAR = "Este trabalho tem valor fixo: só pode aceitar ou recusar.";

/**
 * O profissional responde à oferta. O motor é o das negociações; aqui só se
 * fecha o que numa oferta não existe.
 *
 *   · `propor` — recusado: o valor é fixo;
 *   · `aceitar` — o `aceitar` de sempre: «à espera de contratação», com o
 *     valor fixo como acordado;
 *   · `desistir` (o «Recusar» do ecrã) — o de sempre.
 *
 * NUMA OFERTA DIRECTA, ACEITAR FECHA (`aceitarFechaLogo`) — mas não aqui. Quem
 * a fecha é `atribuirOfertaClyon`, numa transacção: esta função não sabe se
 * outro profissional ficou com o trabalho entretanto, e a base sabe.
 */
export function responderAOferta(n: Negociacao, accao: unknown, agora: Date): ResultadoDaAccao {
  if (accao === "propor") return { ok: false, erro: SO_ACEITAR_OU_RECUSAR };
  if (accao === "aceitar") return aceitar(n, "profissional", agora);
  if (accao === "desistir" || accao === "recusar") return desistir(n, "profissional", agora);
  return { ok: false, erro: "Acção desconhecida." };
}

/** Enviada só a ele, a escolha já está feita: aceitar dá-lhe o trabalho. */
export function aceitarFechaLogo(modo: ModoDaOferta): boolean {
  return modo === "directa";
}

/*
 * ── O BACKOFFICE: em que pé está cada trabalho ─────────────────────────────
 */

export type NegociacaoDaOferta = {
  negociacaoId: number;
  providerId: number;
  profissional: string;
  estado: string;
  modo: ModoDaOferta | null;
  atribuidaEm: string | null;
  execucaoEnviadaEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
};

export type FaseDaOferta =
  /** Ninguém respondeu ainda. */
  | "a_espera"
  /** Há quem tenha aceitado: falta a CLYON escolher. */
  | "escolher"
  /** Todos os que a receberam recusaram. */
  | "sem_ninguem"
  /** Tem profissional; ainda não foi feito. */
  | "atribuida"
  /** O profissional diz que está feito: falta a CLYON confirmar. */
  | "por_confirmar"
  /** Confirmado: o valor está na carteira dele. */
  | "confirmada"
  /** Transferido ao profissional. */
  | "paga"
  /** O pedido foi cancelado ou arquivado antes de o trabalho ser feito (08-10-2026). */
  | "cancelada";

export type ResumoDaOferta = {
  fase: FaseDaOferta;
  enviados: number;
  interessados: NegociacaoDaOferta[];
  recusaram: number;
  atribuida: NegociacaoDaOferta | null;
};

export function resumoDaOferta(
  negociacoes: NegociacaoDaOferta[],
  /**
   * O estado do pedido. Arquivado ou cancelado, o trabalho que não chegou a
   * ser feito é «cancelada» — e não «Ninguém aceitou», que era o que as
   * negociações encerradas davam a ler (08-10-2026).
   */
  estadoDoPedido: string | null = null,
): ResumoDaOferta {
  const atribuida = negociacoes.find((n) => n.estado === "acordada") ?? null;
  const interessados = negociacoes.filter((n) => n.estado === "aguarda_contratacao");
  const recusaram = negociacoes.filter((n) => n.estado === "desistida").length;
  const enviados = negociacoes.length;

  let fase: FaseDaOferta;
  if (atribuida) {
    if (atribuida.pagoEm) fase = "paga";
    else if (atribuida.confirmadoEm) fase = "confirmada";
    else if (atribuida.execucaoEnviadaEm) fase = "por_confirmar";
    else fase = "atribuida";
  } else if (interessados.length > 0) {
    fase = "escolher";
  } else if (enviados > 0 && negociacoes.every((n) => n.estado === "desistida" || n.estado === "morta")) {
    fase = "sem_ninguem";
  } else {
    fase = "a_espera";
  }
  if (pedidoArrumado(estadoDoPedido) && fase !== "por_confirmar" && fase !== "confirmada" && fase !== "paga") {
    fase = "cancelada";
  }
  return { fase, enviados, interessados, recusaram, atribuida };
}

export const ROTULO_DA_FASE: Record<FaseDaOferta, string> = {
  a_espera: "À espera de resposta",
  escolher: "Escolher profissional",
  sem_ninguem: "Ninguém aceitou",
  atribuida: "Atribuído",
  por_confirmar: "Feito — confirmar",
  confirmada: "Confirmado",
  paga: "Pago ao profissional",
  cancelada: "Cancelado",
};
