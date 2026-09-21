import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
import {
  DIAS_ATE_LIBERTAR_SOZINHO,
  faseDoTrabalho,
  type Trabalho,
} from "./trabalho";
import {
  oClientePagou,
  foiPagoEmMao,
  type Carteira,
  type ComoLerACarteira,
  type Levantamento,
  type TrabalhoNaCarteira,
} from "./carteira";

/**
 * O LIVRO DE MOVIMENTOS DA CARTEIRA — a fundação para a CLYON segurar dinheiro.
 *
 * Fase 1 do `docs/plano-pagamentos-eupago.md`. Não cobra nada a ninguém e não
 * muda um número em ecrã nenhum: é a mesma carteira, calculada de outra maneira.
 *
 * PORQUE É QUE A CARTEIRA DE HOJE NÃO CHEGA
 *
 * Ela é CALCULADA a partir das linhas de `negociacoes`: percorre os trabalhos,
 * aplica a percentagem, e soma. Isso chegava enquanto o dinheiro era uma
 * promessa — não havia nada para reconciliar, nem nada que pudesse discordar.
 *
 * Com dinheiro a sério deixa de chegar, e por três razões concretas:
 *
 *   · não há como responder «porque é que o saldo dele é 282 e não 300». A
 *     conta refaz-se, mas não há rasto de que ela tenha sido feita;
 *   · não há como comparar o nosso total com o saldo na conta do euPago. Uma
 *     soma derivada não se reconcilia com um extracto;
 *   · um reembolso PARCIAL não tem onde ser escrito. Metade de um trabalho
 *     devolvida ao cliente não é um estado de uma negociação — é um movimento,
 *     e não há tabela para ele.
 *
 * O QUE MUDA: o saldo passa a ser a SOMA DE LINHAS, e cada linha é um facto que
 * aconteceu e não se reescreve. Corrigir um engano é lançar um movimento novo,
 * nunca mexer num antigo — é a única forma de o livro continuar a explicar-se
 * daqui a um ano.
 *
 * ESTE FICHEIRO É PURO. Não sabe o que é uma base de dados, e é por isso que
 * pode ser interrogado com cem formas de carteira sem nada estar ligado.
 */

/** O que é que este movimento é. */
export type TipoDeMovimento =
  /** O que o profissional ganhou num trabalho, líquido da comissão. */
  | "trabalho"
  /** Pediu transferência: sai da carteira e fica a caminho. */
  | "levantamento_pedido"
  /** A transferência foi feita. */
  | "levantamento_pago"
  /**
   * Devolvido ao cliente, total ou parcialmente.
   *
   * Ainda não é usado — não há reembolsos na plataforma. Está aqui porque é a
   * razão nº 3 de o livro existir, e um tipo que falta é uma coluna que depois
   * se acrescenta a correr no dia em que faz falta.
   */
  | "reembolso"
  /** Uma correcção à mão, com motivo. Nunca se apaga uma linha: acrescenta-se. */
  | "acerto";

export type MovimentoDaCarteira = {
  /** De quem é a carteira. */
  providerId: number;
  tipo: TipoDeMovimento;
  /**
   * SINAL: positivo entra na carteira, negativo sai.
   *
   * Um só campo com sinal, e não «valor» mais «direcção». Com dois campos, a
   * soma exige lembrar-se de olhar para o segundo — e o dia em que alguém se
   * esquecer, o saldo fica errado e soma na mesma.
   */
  valor: number;
  /**
   * QUANDO É QUE ISTO FICA DISPONÍVEL PARA LEVANTAR. `null` = ainda preso.
   *
   * É uma DATA e não um booleano de propósito: a libertação por prazo acontece
   * sozinha, sem ninguém correr nada. Um booleano obrigaria a um processo que
   * passasse a marcá-lo — e entre o prazo passar e esse processo correr, o
   * profissional via o dinheiro preso sem razão.
   */
  disponivelEm: Date | null;
  /**
   * A CHAVE QUE IMPEDE O MESMO FACTO DE SER LANÇADO DUAS VEZES.
   *
   * `trabalho:312`, `levantamento:45:pago`. É única na base, não no código: um
   * `if` esquece-se, um índice único não. É esta coluna que faz um webhook
   * repetido não creditar a dobrar.
   */
  chave: string;
  negociacaoId?: number | null;
  pedidoId?: number | null;
  levantamentoId?: number | null;
  /** A referência do lado do euPago (`trid`), quando houver. */
  referencia?: string | null;
  nota?: string | null;
};

function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function data(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * QUANDO É QUE O DINHEIRO DESTE TRABALHO DEIXA DE ESTAR PRESO.
 *
 * As três portas, e são as de hoje — `estaLibertado` em `trabalho.ts`:
 *
 *   · o cliente confirmou       → na hora em que confirmou;
 *   · já foi pago               → idem (a confirmação veio antes);
 *   · a prova foi enviada e o cliente não disse nada → sete dias depois dela.
 *
 * Antes da prova não há nada a libertar: o trabalho ainda nem foi feito.
 *
 * Devolver a DATA em vez de «sim/não» é o que permite escrever o movimento uma
 * vez, no momento em que o trabalho fecha, e nunca mais lhe tocar. O prazo
 * cumpre-se sozinho.
 */
export function quandoLiberta(t: Trabalho): Date | null {
  const fase = faseDoTrabalho(t);
  if (fase === "pago" || fase === "confirmado") {
    // `pagoEm` como alternativa: uma linha antiga pode ter sido paga sem a data
    // da confirmação ter ficado gravada, e é melhor uma data do que nenhuma.
    return data(t.confirmadoEm) ?? data(t.pagoEm);
  }
  if (fase === "a_confirmar") {
    const enviada = data(t.execucaoEnviadaEm);
    if (!enviada) return null;
    return new Date(enviada.getTime() + DIAS_ATE_LIBERTAR_SOZINHO * 86_400_000);
  }
  return null;
}

/**
 * O movimento de um trabalho — ou nada, se ele ainda não é um trabalho.
 *
 * Uma negociação que ainda se está a negociar não gera linha nenhuma: não há
 * dinheiro nenhum por trás dela, e escrever um movimento a zero seria pôr no
 * livro uma coisa que não aconteceu.
 */
export function movimentoDoTrabalho(
  t: TrabalhoNaCarteira & { providerId: number; pedidoId?: number | null },
  opcoes: ComoLerACarteira = {},
): MovimentoDaCarteira | null {
  if (faseDoTrabalho(t) === "a_negociar") return null;
  /*
   * E UM TRABALHO PAGO EM MÃO TAMBÉM NÃO — 21-09-2026.
   *
   * O livro regista dinheiro que passou pela CLYON. Em dinheiro, o cliente
   * entregou o valor ao profissional no local e a CLYON nunca lhe tocou: não
   * entrou, não ficou cativo, não se liberta, não se transfere. Uma linha aqui
   * punha-o em «disponível» e a CLYON transferia dinheiro que nunca recebeu.
   * Vê-se em `recebidoEmMao`, que vem de fora — como `porCobrar`.
   */
  if (foiPagoEmMao(t)) return null;
  /*
   * UM TRABALHO POR PAGAR NÃO GERA MOVIMENTO NENHUM.
   *
   * E não é uma omissão — é a definição de movimento. O livro regista dinheiro
   * que SE MOVEU; enquanto o cliente não paga, não se moveu nada. Escrever cá
   * uma linha a zero, ou uma linha «pendente», era pôr no livro uma coisa que
   * não aconteceu, e o livro deixava de se poder comparar com o extracto.
   *
   * O que o profissional tem a receber continua a ver-se — em `porCobrar`, que
   * se calcula das negociações e não daqui. Ver `porCobrarDe` em `carteira.ts`.
   */
  if (!oClientePagou(t, opcoes)) return null;
  const v = t.valorAcordado;
  if (v == null || !Number.isFinite(v)) return null;

  return {
    providerId: t.providerId,
    tipo: "trabalho",
    // A comissão é a que ESTA negociação guardou — nunca a de hoje. Ver
    // `taxasDaNegociacao`: a taxa pode mudar no backoffice, e o que já foi
    // prometido não muda com ela.
    valor: aosCentimos(quantoOProfissionalRecebe(v, taxasDaNegociacao(t))),
    disponivelEm: quandoLiberta(t),
    chave: `trabalho:${t.negociacaoId}`,
    negociacaoId: t.negociacaoId,
    pedidoId: t.pedidoId ?? null,
  };
}

/**
 * Os movimentos de um levantamento.
 *
 * «Pedido» e «pago» são DOIS FACTOS, e é por isso que são duas linhas: o
 * dinheiro sai da carteira quando ele pede (senão pedia duas vezes o mesmo
 * saldo) e chega-lhe à conta quando se transfere. Entre um e outro há dias, e o
 * livro tem de saber dizer em qual dos dois está.
 *
 * «Recusado» não gera linha nenhuma — o dinheiro nunca saiu, e uma linha a
 * dizer que saiu e outra a dizer que voltou seria escrever duas coisas que não
 * aconteceram para chegar ao mesmo sítio.
 */
export function movimentosDoLevantamento(
  l: Levantamento & { providerId: number; criadoEm?: Date | string | null },
): MovimentoDaCarteira[] {
  if (l.estado === "recusado") return [];
  const saida: MovimentoDaCarteira = {
    providerId: l.providerId,
    tipo: "levantamento_pedido",
    valor: -aosCentimos(l.valor),
    // Já saiu: não há nada a libertar. A data serve para o livro poder ser
    // lido por ordem, não para prender nada.
    disponivelEm: data(l.criadoEm),
    chave: `levantamento:${l.id}:pedido`,
    levantamentoId: l.id,
  };
  if (l.estado !== "pago") return [saida];
  return [
    saida,
    {
      ...saida,
      tipo: "levantamento_pago",
      // A segunda linha NÃO volta a tirar dinheiro: o dinheiro saiu na
      // primeira. Esta só marca que chegou à conta dele.
      valor: 0,
      chave: `levantamento:${l.id}:pago`,
    },
  ];
}

/**
 * A CARTEIRA, LIDA DO LIVRO.
 *
 * Tem de dar EXACTAMENTE o mesmo que `carteiraDe` dá hoje, ao cêntimo, para
 * todos os profissionais. É essa a única coisa que esta fase promete, e há um
 * ficheiro de testes inteiro a exigi-la.
 */
export function carteiraDoLivro(
  movimentos: MovimentoDaCarteira[],
  agora: Date,
  /*
   * O POR COBRAR VEM DE FORA, e é a única coisa desta carteira que não sai do
   * livro. Tem de ser: é trabalho feito e não pago, ou seja, precisamente o que
   * ainda não é um movimento. Quem chama calcula-o com `porCobrarDe` sobre as
   * mesmas negociações — a mesma função que a carteira de hoje usa, para os
   * dois caminhos não poderem divergir aqui.
   */
  porCobrar = 0,
  /** O recebido em mão, pela mesma razão: nunca foi um movimento. `recebidoEmMaoDe`. */
  recebidoEmMao = 0,
): Carteira {
  let cativo = 0;
  let ganhoLibertado = 0;
  let aCaminho = 0;
  let levantado = 0;

  const pagos = new Set<number>();
  for (const m of movimentos) {
    if (m.tipo === "levantamento_pago" && m.levantamentoId != null) {
      pagos.add(m.levantamentoId);
    }
  }

  for (const m of movimentos) {
    if (m.tipo === "trabalho" || m.tipo === "acerto" || m.tipo === "reembolso") {
      const livre = m.disponivelEm != null && m.disponivelEm.getTime() <= agora.getTime();
      if (livre) ganhoLibertado += m.valor;
      else cativo += m.valor;
      continue;
    }
    if (m.tipo === "levantamento_pedido" && m.levantamentoId != null) {
      // Uma saída conta como «a caminho» enquanto não houver a linha do pago.
      if (pagos.has(m.levantamentoId)) levantado += -m.valor;
      else aCaminho += -m.valor;
    }
  }

  return {
    porCobrar: aosCentimos(porCobrar),
    cativo: aosCentimos(cativo),
    disponivel: Math.max(0, aosCentimos(ganhoLibertado - aCaminho - levantado)),
    aCaminho: aosCentimos(aCaminho),
    levantado: aosCentimos(levantado),
    recebidoEmMao: aosCentimos(recebidoEmMao),
    totalGanho: aosCentimos(porCobrar + cativo + ganhoLibertado + recebidoEmMao),
  };
}

/**
 * O livro de um profissional, construído do que já existe.
 *
 * É isto que permite provar a equivalência sem gravar nada: pegar nos mesmos
 * trabalhos e levantamentos que a carteira de hoje recebe, e ver que os dois
 * caminhos chegam ao mesmo número.
 *
 * E é também o que vai escrever as linhas quando a tabela existir — a mesma
 * função, para não haver duas versões da mesma verdade.
 */
export function livroDe(
  providerId: number,
  trabalhos: TrabalhoNaCarteira[],
  levantamentos: Array<Levantamento & { criadoEm?: Date | string | null }>,
  opcoes: ComoLerACarteira = {},
): MovimentoDaCarteira[] {
  const saida: MovimentoDaCarteira[] = [];
  for (const t of trabalhos) {
    const m = movimentoDoTrabalho({ ...t, providerId }, opcoes);
    if (m) saida.push(m);
  }
  for (const l of levantamentos) {
    saida.push(...movimentosDoLevantamento({ ...l, providerId }));
  }
  return saida;
}
